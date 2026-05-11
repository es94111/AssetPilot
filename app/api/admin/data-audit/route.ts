// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/apiHelpers';
import { queryOne, queryAll } from '../../../../lib/db';

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

function serializeAuditRow(r) {
  let metadata = {};
  try { metadata = r.metadata ? JSON.parse(r.metadata) : {}; } catch (_) { metadata = { raw: r.metadata }; }
  return {
    id: r.id,
    user_id: r.user_id,
    role: r.role,
    action: r.action,
    ip_address: r.ip_address || '',
    user_agent: r.user_agent || '',
    timestamp: r.timestamp,
    result: r.result,
    is_admin_operation: Number(r.is_admin_operation) || 0,
    metadata,
  };
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const { whereSql, params } = parseAuditQuery(searchParams);
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
  const pageSize = Math.max(1, Math.min(200, parseInt(searchParams.get('pageSize') || '50', 10) || 50));
  const total = queryOne(`SELECT COUNT(*) AS cnt FROM data_operation_audit_log ${whereSql}`, params)?.cnt || 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const dataSql = `SELECT * FROM data_operation_audit_log ${whereSql} ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
  const data = queryAll(dataSql, [...params, pageSize, (page - 1) * pageSize]).map(serializeAuditRow);

  return NextResponse.json({ data, total, page, totalPages });
}
