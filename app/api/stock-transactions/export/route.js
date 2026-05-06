import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { queryAll } from '../../../../lib/db';
import { buildCsv, writeOperationAudit, isValidIso8601Date } from '../../../../lib/auditHelpers';
import { getRequestIpFromHeaders } from '../../../../lib/loginHelpers';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';

  try {
    let where = 'WHERE st.user_id = ?';
    const params = [auth.userId];
    if (dateFrom && isValidIso8601Date(dateFrom)) { where += ' AND st.date >= ?'; params.push(dateFrom); }
    if (dateTo && isValidIso8601Date(dateTo)) { where += ' AND st.date <= ?'; params.push(dateTo); }

    const sql = `SELECT st.date, st.type, st.shares, st.price, st.fee, st.tax, st.note,
      s.symbol, s.name AS stock_name, a.name AS account_name
      FROM stock_transactions st
      JOIN stocks s ON st.stock_id = s.id
      LEFT JOIN accounts a ON st.account_id = a.id
      ${where}
      ORDER BY st.date DESC, st.created_at DESC`;
    const rows = queryAll(sql, params);

    const headers = ['日期', '股票代號', '股票名稱', '類型', '股數', '成交價', '手續費', '交易稅', '帳戶', '備註'];
    const dataRows = rows.map(r => [
      r.date || '', r.symbol || '', r.stock_name || '',
      r.type === 'buy' ? '買進' : '賣出',
      r.shares, r.price, r.fee || 0, r.tax || 0,
      r.account_name || '', r.note || '',
    ]);

    const csv = buildCsv(headers, dataRows);
    const filename = `stock-transactions-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;

    writeOperationAudit({
      userId: auth.userId,
      role: 'user',
      action: 'export_stock_transactions',
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
    console.error('export_stock_transactions failed', e);
    return NextResponse.json({ error: '匯出失敗', message: String(e?.message || e) }, { status: 500 });
  }
}
