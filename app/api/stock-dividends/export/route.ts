// @ts-nocheck
import { NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/apiHelpers";
import { queryAll, queryAllInKeysetPages } from "../../../../lib/db";
import {
  buildCsv,
  writeOperationAudit,
  isValidIso8601Date,
} from "../../../../lib/auditHelpers";
import { getRequestIpFromHeaders } from "../../../../lib/loginHelpers";
import {
  hasAmbiguousLegacyStockDividendTransactions,
  hasUnmatchedLegacyStockDividendTransactions,
} from "../../../../lib/stockHelpers";
import {
  createXlsxExportResponse,
  mapXlsxRows,
  resolveExportFormat,
  type XlsxColumn,
} from "../../../../lib/xlsxExport";

// xlsx 產生依賴 Node stream 與 write-excel-file，明確宣告 nodejs runtime，
// 避免被推論為 edge runtime。
export const runtime = "nodejs";

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const format = resolveExportFormat(searchParams.get("format"));

  try {
    const legacyStockIds = queryAll(
      "SELECT DISTINCT stock_id FROM stock_transactions WHERE user_id = ? AND type = 'buy' AND price = 0 AND COALESCE(linked_dividend_id, '') = '' AND (note LIKE '[SYNTH] 股票股利%' OR note LIKE '股票股利配發%')",
      [auth.userId],
    );
    if (legacyStockIds.some((row) =>
      hasUnmatchedLegacyStockDividendTransactions(auth.userId, String(row.stock_id)) ||
      hasAmbiguousLegacyStockDividendTransactions(auth.userId, String(row.stock_id))
    )) {
      return NextResponse.json(
        { error: "存在無法安全配對的舊版股票股利合成交易，請先透過股利紀錄整理後再匯出" },
        { status: 409 },
      );
    }

    let where = "WHERE sd.user_id = ?";
    const params = [auth.userId];
    if (dateFrom && isValidIso8601Date(dateFrom)) {
      where += " AND sd.date >= ?";
      params.push(dateFrom);
    }
    if (dateTo && isValidIso8601Date(dateTo)) {
      where += " AND sd.date <= ?";
      params.push(dateTo);
    }

    const baseSql = `SELECT sd.id, sd.date, sd.cash_dividend, sd.stock_dividend_shares, sd.account_id, sd.note,
      sd.reinvest, sd.reinvest_shares, sd.reinvest_price,
      CASE WHEN EXISTS (
        SELECT 1 FROM stock_transactions st
        WHERE st.user_id = sd.user_id AND st.linked_dividend_id = sd.id AND st.type = 'buy'
          AND st.price = 0 AND st.note LIKE '[SYNTH] 股票股利%'
      ) THEN (
        SELECT st.created_at FROM stock_transactions st
        WHERE st.user_id = sd.user_id AND st.linked_dividend_id = sd.id AND st.type = 'buy'
          AND st.price = 0 AND st.note LIKE '[SYNTH] 股票股利%'
        ORDER BY st.created_at, st.id LIMIT 1
      ) ELSE (
        SELECT st.created_at FROM stock_transactions st
        WHERE st.user_id = sd.user_id AND st.stock_id = sd.stock_id AND st.date = sd.date
          AND st.type = 'buy' AND st.price = 0 AND COALESCE(st.linked_dividend_id, '') = ''
          AND ABS(st.shares - sd.stock_dividend_shares) < 0.001
          AND (st.note LIKE '[SYNTH] 股票股利%' OR st.note LIKE '股票股利配發%')
        ORDER BY st.created_at, st.id LIMIT 1
      ) END AS stock_dividend_tx_created_at,
      CASE WHEN EXISTS (
        SELECT 1 FROM stock_transactions st
        WHERE st.user_id = sd.user_id AND st.linked_dividend_id = sd.id AND st.type = 'buy'
          AND st.price = 0 AND st.note LIKE '[SYNTH] 股票股利%'
      ) THEN (
        SELECT st.id FROM stock_transactions st
        WHERE st.user_id = sd.user_id AND st.linked_dividend_id = sd.id AND st.type = 'buy'
          AND st.price = 0 AND st.note LIKE '[SYNTH] 股票股利%'
        ORDER BY st.created_at, st.id LIMIT 1
      ) ELSE (
        SELECT st.id FROM stock_transactions st
        WHERE st.user_id = sd.user_id AND st.stock_id = sd.stock_id AND st.date = sd.date
          AND st.type = 'buy' AND st.price = 0 AND COALESCE(st.linked_dividend_id, '') = ''
          AND ABS(st.shares - sd.stock_dividend_shares) < 0.001
          AND (st.note LIKE '[SYNTH] 股票股利%' OR st.note LIKE '股票股利配發%')
        ORDER BY st.created_at, st.id LIMIT 1
      ) END AS stock_dividend_tx_id,
      (SELECT st.created_at FROM stock_transactions st
       WHERE st.user_id = sd.user_id AND st.linked_dividend_id = sd.id AND st.type = 'buy'
         AND st.note LIKE '[DRIP] 股利再投資%'
       ORDER BY st.created_at, st.id LIMIT 1) AS reinvest_tx_created_at,
      (SELECT st.id FROM stock_transactions st
       WHERE st.user_id = sd.user_id AND st.linked_dividend_id = sd.id AND st.type = 'buy'
         AND st.note LIKE '[DRIP] 股利再投資%'
       ORDER BY st.created_at, st.id LIMIT 1) AS reinvest_tx_id,
      s.symbol, s.market, s.name AS stock_name, s.stock_type, s.currency,
      CASE WHEN COALESCE(sd.cash_dividend, 0) > 0
        THEN COALESCE(NULLIF(a.name, ''), matched_dividend_account.account_name, '')
        ELSE ''
      END AS dividend_account_name,
      COALESCE(sd.created_at, 0) AS export_cursor_created_at
      FROM stock_dividends sd
      JOIN stocks s ON sd.stock_id = s.id AND s.user_id = sd.user_id
      LEFT JOIN accounts a ON sd.account_id = a.id AND a.user_id = sd.user_id
      LEFT JOIN LATERAL (
        SELECT match_account.name AS account_name
        FROM transactions t
        LEFT JOIN accounts match_account ON match_account.id = t.account_id AND match_account.user_id = t.user_id
        WHERE sd.cash_dividend > 0
          AND t.user_id = sd.user_id AND t.date = sd.date AND t.type = 'income'
          AND ABS(t.amount - sd.cash_dividend) < 0.01
          AND (t.note LIKE '%股利%' OR t.note LIKE '%dividend%' OR t.note LIKE '%' || s.symbol || '%')
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT 1
      ) matched_dividend_account ON TRUE
      ${where}`;
    const sql = `${baseSql} ORDER BY sd.date DESC, COALESCE(sd.created_at, 0) DESC, sd.id DESC`;
    const headers = [
      "日期",
      "市場",
      "股票代號",
      "股票名稱",
      "股票類型",
      "幣別",
      "現金股利",
      "股票股利",
      "再投資",
      "再投資股數",
      "再投資價格",
      "股票股利 FIFO 排序時間",
      "再投資 FIFO 排序時間",
      "股票股利 FIFO 排序識別碼",
      "再投資 FIFO 排序識別碼",
      "帳戶",
      "備註",
    ];
    const exportRow = (r) => {
      const accountName = r.dividend_account_name || "";
      return [
        r.date || "",
        r.market || "TW",
        r.symbol || "",
        r.stock_name || "",
        r.stock_type || "stock",
        r.currency || "TWD",
        r.cash_dividend || 0,
        r.stock_dividend_shares || 0,
        Number(r.reinvest) === 1 ? "是" : "否",
        Number(r.reinvest_shares) || 0,
        Number(r.reinvest_price) || 0,
        r.stock_dividend_tx_created_at ?? "",
        r.reinvest_tx_created_at ?? "",
        r.stock_dividend_tx_id || "",
        r.reinvest_tx_id || "",
        accountName,
        r.note || "",
      ];
    };

    const ipAddress = getRequestIpFromHeaders(request.headers) || "";
    const userAgent = request.headers.get("user-agent") || "";

    if (format === "xlsx") {
      const columns: XlsxColumn[] = [
        { header: "日期", type: "date" },
        { header: "市場", type: "text" },
        { header: "股票代號", type: "text" },
        { header: "股票名稱", type: "text" },
        { header: "股票類型", type: "text" },
        { header: "幣別", type: "text" },
        { header: "現金股利", type: "number" },
        { header: "股票股利", type: "number", format: "#,##0.####" },
        { header: "再投資", type: "text" },
        { header: "再投資股數", type: "number", format: "#,##0.####" },
        { header: "再投資價格", type: "number" },
        { header: "股票股利 FIFO 排序時間", type: "datetime" },
        { header: "再投資 FIFO 排序時間", type: "datetime" },
        { header: "股票股利 FIFO 排序識別碼", type: "text" },
        { header: "再投資 FIFO 排序識別碼", type: "text" },
        { header: "帳戶", type: "text" },
        { header: "備註", type: "text" },
      ];
      return createXlsxExportResponse({
        columns,
        rows: mapXlsxRows(
          queryAllInKeysetPages(baseSql, params, {
            cursorColumns: ['sd.date', 'COALESCE(sd.created_at, 0)', 'sd.id'],
            orderBy: ['sd.date', 'COALESCE(sd.created_at, 0)', 'sd.id'],
            direction: 'DESC',
            cursorFromRow: (row) => [row.date, row.export_cursor_created_at, row.id],
          }),
          exportRow,
        ),
        filenamePrefix: "stock-dividends",
        audit: { userId: auth.userId, role: "user", action: "export_stock_dividends", ipAddress, userAgent, dateFrom, dateTo },
      });
    }

    const rows = queryAll(sql, params);
    const dataRows = rows.map(exportRow);
    const csv = buildCsv(headers, dataRows);
    const filename = `stock-dividends-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.csv`;

    writeOperationAudit({
      userId: auth.userId,
      role: "user",
      action: "export_stock_dividends",
      ipAddress,
      userAgent,
      result: "success",
      isAdminOperation: false,
      metadata: {
        rows: dataRows.length,
        byteSize: Buffer.byteLength(csv, "utf8"),
        dateFrom,
        dateTo,
        format: "csv",
      },
    });

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "匯出失敗", message: String(e?.message || e) },
      { status: 500 },
    );
  }
}
