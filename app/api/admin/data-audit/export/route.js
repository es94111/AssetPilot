import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/apiHelpers';
import { queryAll } from '../../../../../lib/db';
import { buildCsv } from '../../../../../lib/auditHelpers';

function parseAuditQuery(searchParams) {
  const where = [];
  const params = [];
  const userId = searchParams.get('user_id') || '';
  if (userId) { where.push('user_id = ?'); params.push(String(userId)); }
  const action = searchParams.get('action') || '';
  if (action) {
    const acts = action.split(',').map(s => s.trim()).filter(Boolean);
    if (acts.length > 0) {
      where.push(`action IN (${acts.map(() => '?').join(',')})`);
      acts.forEach(a => params.push(a));
    }
  }
  const result = searchParams.get('result') || '';
  if (result && ['success', 'failed', 'rolled_back'].includes(result)) {
    where.push('result = ?');
    params.push(result);
  }
  const start = searchParams.get('start') || '';
  if (start) { where.push('timestamp >= ?'); params.push(start); }
  const end = searchParams.get('end') || '';
  if (end) { where.push('timestamp <= ?'); params.push(end); }
  const whereSql = where.length > 0 ? 'WHERE ' + where.join(' AND ') : '';
  return { whereSql, params };
}

function makeBackupTimestamp() {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
    String(d.getHours()).padStart(2, '0'),
    String(d.getMinutes()).padStart(2, '0'),
    String(d.getSeconds()).padStart(2, '0'),
  ].join('');
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const { whereSql, params } = parseAuditQuery(searchParams);
    const rows = queryAll(`SELECT * FROM data_operation_audit_log ${whereSql} ORDER BY timestamp DESC`, params);
    const headers = ['id', 'user_id', 'role', 'action', 'ip_address', 'user_agent', 'timestamp', 'result', 'is_admin_operation', 'metadata'];
    const dataRows = rows.map(r => [
      r.id, r.user_id, r.role, r.action, r.ip_address || '', r.user_agent || '',
      r.timestamp, r.result, r.is_admin_operation, r.metadata || '{}',
    ]);
    const csv = buildCsv(headers, dataRows);
    const filename = `audit-log-${makeBackupTimestamp()}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error('export audit-log failed', e);
    return NextResponse.json({ error: '匯出稽核日誌失敗', message: String(e?.message || e) }, { status: 500 });
  }
}
