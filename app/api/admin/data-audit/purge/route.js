import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../../lib/db.js';

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const total = queryOne('SELECT COUNT(*) AS cnt FROM data_operation_audit_log')?.cnt || 0;
    const db = getDB();
    db.run('DELETE FROM data_operation_audit_log');
    saveDB();
    return NextResponse.json({ ok: true, deleted: total });
  } catch (e) {
    console.error('purge audit-log failed', e);
    return NextResponse.json({ error: '清空稽核日誌失敗', message: String(e?.message || e) }, { status: 500 });
  }
}
