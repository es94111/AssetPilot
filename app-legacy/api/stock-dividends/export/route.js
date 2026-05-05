import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { queryAll, queryOne } from '../../../../lib/db';
import { buildCsv, writeOperationAudit, isValidIso8601Date } from '../../../../lib/auditHelpers';
import { getRequestIpFromHeaders } from '../../../../lib/loginHelpers';

export async function GET(request) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';

  try {
    let where = 'WHERE sd.user_id = ?';
    const params = [auth.userId];
    if (dateFrom && isValidIso8601Date(dateFrom)) { where += ' AND sd.date >= ?'; params.push(dateFrom); }
    if (dateTo && isValidIso8601Date(dateTo)) { where += ' AND sd.date <= ?'; params.push(dateTo); }

    const sql = `SELECT sd.id, sd.date, sd.cash_dividend, sd.stock_dividend_shares, sd.note,
      s.symbol, s.name AS stock_name
      FROM stock_dividends sd
      JOIN stocks s ON sd.stock_id = s.id
      ${where}
      ORDER BY sd.date DESC, sd.created_at DESC`;
    const rows = queryAll(sql, params);

    const headers = ['日期', '股票代號', '股票名稱', '現金股利', '股票股利', '帳戶', '備註'];
    const dataRows = rows.map(r => {
      let accountName = '';
      const cash = Number(r.cash_dividend || 0);
      if (cash > 0) {
        const tx = queryOne(
          `SELECT a.name AS account_name FROM transactions t
           LEFT JOIN accounts a ON t.account_id = a.id
           WHERE t.user_id = ? AND t.date = ? AND t.type = 'income' AND ABS(t.amount - ?) < 0.01
             AND (t.note LIKE ? OR t.note LIKE ? OR t.note LIKE ?)
           ORDER BY t.created_at DESC LIMIT 1`,
          [auth.userId, r.date, cash, '%股利%', '%dividend%', '%' + (r.symbol || '') + '%']
        );
        accountName = tx?.account_name || '';
      }
      return [
        r.date || '', r.symbol || '', r.stock_name || '',
        r.cash_dividend || 0, r.stock_dividend_shares || 0,
        accountName, r.note || '',
      ];
    });

    const csv = buildCsv(headers, dataRows);
    const filename = `stock-dividends-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;

    writeOperationAudit({
      userId: auth.userId,
      role: 'user',
      action: 'export_stock_dividends',
      ipAddress: getRequestIpFromHeaders(request.headers) || '',
      userAgent: request.headers.get('user-agent') || '',
      result: 'success',
      isAdminOperation: false,
      metadata: { rows: dataRows.length, byteSize: Buffer.byteLength(csv, 'utf8'), dateFrom, dateTo },
    });

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: '匯出失敗', message: String(e?.message || e) }, { status: 500 });
  }
}
