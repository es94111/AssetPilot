// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../../lib/db';
import { auditSensitiveAction } from '../../../../../lib/auditHelpers';

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const total = queryOne('SELECT COUNT(*) AS cnt FROM data_operation_audit_log')?.cnt || 0;
    const db = getDB();
    db.run('DELETE FROM data_operation_audit_log');
    saveDB();
    // 敏感操作：清空稽核日誌（破壞稽核軌跡）。於清空後寫入，使此筆紀錄留存為新軌跡起點。
    auditSensitiveAction(request, auth, {
      action: 'admin.audit.purge',
      metadata: { deleted_count: total },
    });
    saveDB();
    return NextResponse.json({ ok: true, deleted: total });
  } catch (e) {
    console.error('purge audit-log failed', e);
    return NextResponse.json({ error: '清空稽核日誌失敗', message: String(e?.message || e) }, { status: 500 });
  }
}
