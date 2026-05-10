import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { queryAll, queryOne } from '../../../../lib/db';
import { buildCsv, writeOperationAudit, isValidIso8601Date } from '../../../../lib/auditHelpers';
import { getRequestIpFromHeaders } from '../../../../lib/loginHelpers';

function txTypeToChinese(t) {
  if (t === 'income') return '收入';
  if (t === 'expense') return '支出';
  if (t === 'transfer_out') return '轉出';
  if (t === 'transfer_in') return '轉入';
  return t || '';
}

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';

  try {
    let where = 'WHERE t.user_id = ?';
    const params = [auth.userId];
    if (dateFrom && isValidIso8601Date(dateFrom)) { where += ' AND t.date >= ?'; params.push(dateFrom); }
    if (dateTo && isValidIso8601Date(dateTo)) { where += ' AND t.date <= ?'; params.push(dateTo); }

    const sql = `SELECT t.date, t.type, t.amount, t.currency, t.original_amount, t.fx_rate,
      t.twd_amount, t.fx_fee, t.exclude_from_stats, t.tags, t.note,
      c.name AS cat_name, c.parent_id AS cat_parent_id,
      pc.name AS parent_cat_name,
      a.name AS account_name,
      ta.name AS transfer_to_account_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN categories pc ON c.parent_id = pc.id
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN accounts ta ON t.transfer_to_account_id = ta.id
      ${where}
      ORDER BY t.date DESC, t.created_at DESC`;
    const rows = queryAll(sql, params);

    const headers = ['日期', '類型', '分類', '金額', '幣別', '原始金額', '匯率', '台幣金額', '匯兌手續費', '帳戶', '轉入帳戶', '排除統計', '標籤', '備註'];
    const dataRows = rows.map(r => {
      let category = '';
      if (r.cat_name) {
        category = r.parent_cat_name ? (r.parent_cat_name + ' > ' + r.cat_name) : r.cat_name;
      }
      return [
        r.date || '', txTypeToChinese(r.type), category, r.amount,
        r.currency || 'TWD', r.original_amount || r.amount || '', r.fx_rate || '1',
        r.twd_amount || '', r.fx_fee || 0, r.account_name || '', r.transfer_to_account_name || '',
        Number(r.exclude_from_stats) ? '是' : '否', r.tags || '[]', r.note || '',
      ];
    });

    const csv = buildCsv(headers, dataRows);
    const filename = `transactions-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;

    const userRow = queryOne('SELECT is_admin FROM users WHERE id = ?', [auth.userId]);
    const ipAddress = getRequestIpFromHeaders(request.headers);
    writeOperationAudit({
      userId: auth.userId,
      role: userRow?.is_admin ? 'admin' : 'user',
      action: 'export_transactions',
      ipAddress,
      userAgent: request.headers.get('user-agent') || '',
      result: 'success',
      isAdminOperation: false,
      metadata: { rows: dataRows.length, byteSize: Buffer.byteLength(csv, 'utf8'), dateFrom, dateTo },
    });

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error('export_transactions failed', e);
    return NextResponse.json({ error: '匯出失敗', message: String(e?.message || e) }, { status: 500 });
  }
}
