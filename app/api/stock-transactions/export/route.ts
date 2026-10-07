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
    let where = "WHERE st.user_id = ?";
    const params = [auth.userId];
    if (dateFrom && isValidIso8601Date(dateFrom)) {
      where += " AND st.date >= ?";
      params.push(dateFrom);
    }
    if (dateTo && isValidIso8601Date(dateTo)) {
      where += " AND st.date <= ?";
      params.push(dateTo);
    }

    const baseSql = `SELECT st.date, st.type, st.shares, st.price, st.fee, st.tax, st.realized_pl,
      st.tax_auto_calculated, st.note,
      s.symbol, s.market, s.name AS stock_name, s.stock_type, s.currency, a.name AS account_name,
      COALESCE(st.created_at, 0) AS export_cursor_created_at, st.id AS export_cursor_id
      FROM stock_transactions st
      JOIN stocks s ON st.stock_id = s.id AND s.user_id = st.user_id
      LEFT JOIN accounts a ON st.account_id = a.id AND a.user_id = st.user_id
      ${where}`;
    const orderBy = 'st.date, COALESCE(st.created_at, 0), st.id';
    const sql = `${baseSql} ORDER BY st.date DESC, st.created_at DESC`;
    const headers = [
      "日期",
      "市場",
      "股票代號",
      "股票名稱",
      "股票類型",
      "幣別",
      "類型",
      "股數",
      "成交價",
      "手續費",
      "交易稅",
      "已實現損益",
      "稅額自動計算",
      "帳戶",
      "備註",
    ];
    const exportRow = (r) => [
      r.date || "",
      r.market || "TW",
      r.symbol || "",
      r.stock_name || "",
      r.stock_type || "stock",
      r.currency || "TWD",
      r.type === "buy" ? "買進" : "賣出",
      r.shares,
      r.price,
      r.fee || 0,
      r.tax || 0,
      r.realized_pl || 0,
      Number(r.tax_auto_calculated) === 0 ? "否" : "是",
      r.account_name || "",
      r.note || "",
    ];

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
        { header: "類型", type: "text" },
        { header: "股數", type: "number", format: "#,##0.####" },
        { header: "成交價", type: "number" },
        { header: "手續費", type: "number" },
        { header: "交易稅", type: "number" },
        { header: "已實現損益", type: "number" },
        { header: "稅額自動計算", type: "text" },
        { header: "帳戶", type: "text" },
        { header: "備註", type: "text" },
      ];
      return createXlsxExportResponse({
        columns,
        rows: mapXlsxRows(
          queryAllInKeysetPages(baseSql, params, {
            cursorColumns: ['st.date', 'COALESCE(st.created_at, 0)', 'st.id'],
            orderBy: 'st.date, COALESCE(st.created_at, 0), st.id',
            direction: 'DESC',
            cursorFromRow: (row) => [row.date, row.export_cursor_created_at, row.export_cursor_id],
          }),
          exportRow,
        ),
        filenamePrefix: "stock-transactions",
        audit: { userId: auth.userId, role: "user", action: "export_stock_transactions", ipAddress, userAgent, dateFrom, dateTo },
      });
    }

    const rows = queryAll(sql, params);
    const dataRows = rows.map(exportRow);
    const csv = buildCsv(headers, dataRows);
    const filename = `stock-transactions-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}.csv`;

    writeOperationAudit({
      userId: auth.userId,
      role: "user",
      action: "export_stock_transactions",
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
    console.error("export_stock_transactions failed", e);
    return NextResponse.json(
      { error: "匯出失敗", message: String(e?.message || e) },
      { status: 500 },
    );
  }
}
