import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { queryAll, queryOne } from '../../../../lib/db';
import { buildCsv, writeOperationAudit } from '../../../../lib/auditHelpers';
import { getRequestIpFromHeaders } from '../../../../lib/loginHelpers';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const rows = queryAll(
      `SELECT a.name, a.category, a.account_type, a.initial_balance, a.currency, a.icon,
        a.exclude_from_total, a.linked_bank_id, linked.name AS linked_bank_name,
        a.overseas_fee_rate, a.note, a.created_at, a.updated_at
       FROM accounts a
       LEFT JOIN accounts linked ON linked.id = a.linked_bank_id AND linked.user_id = a.user_id
       WHERE a.user_id = ?
       ORDER BY a.sort_order ASC, a.created_at ASC, a.name ASC`,
      [auth.userId]
    );

    const headers = ['帳戶名稱', '類別', '帳戶類型', '初始餘額', '幣別', '圖示', '排除總資產', '連結銀行帳戶', '海外手續費率', '備註', '建立時間', '更新時間'];
    const dataRows = rows.map(r => [
      r.name || '', r.category || '', r.account_type || '', r.initial_balance || 0,
      r.currency || 'TWD', r.icon || 'fa-wallet', Number(r.exclude_from_total) ? '是' : '否',
      r.linked_bank_name || '', r.overseas_fee_rate ?? '', r.note || '', r.created_at || '', r.updated_at || '',
    ]);

    const csv = buildCsv(headers, dataRows);
    const filename = `accounts-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;
    const userRow = queryOne('SELECT is_admin FROM users WHERE id = ?', [auth.userId]);
    writeOperationAudit({
      userId: auth.userId,
      role: userRow?.is_admin ? 'admin' : 'user',
      action: 'export_accounts',
      ipAddress: getRequestIpFromHeaders(request.headers),
      userAgent: request.headers.get('user-agent') || '',
      result: 'success',
      isAdminOperation: false,
      metadata: { rows: dataRows.length, byteSize: Buffer.byteLength(csv, 'utf8') },
    });

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error('export_accounts failed', e);
    return NextResponse.json({ error: '匯出失敗', message: String(e?.message || e) }, { status: 500 });
  }
}
