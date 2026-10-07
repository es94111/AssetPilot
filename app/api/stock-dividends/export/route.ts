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
      ${where}`
    const orderBy = 'sd.date, COALESCE(sd.created_at, 0), sd.id';
    const sql = `${baseSql} ORDER BY sd.date DESC, sd.created_at DESC`;
    const headers = [
      "日期",
      "市場",
      "股票代號",
      "股票名稱",
      "股票類型",
      "幣別",
      "現金股利",
      "股票股利",
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
