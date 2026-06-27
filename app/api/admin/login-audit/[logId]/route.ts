// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../../lib/db';
import { auditSensitiveAction } from '../../../../../lib/auditHelpers';

function parseLoginLogTarget(rawId) {
  const s = String(rawId || '').trim();
  if (!s) return null;
  if (s.startsWith('rid:') || s.startsWith('ts:')) return null;
  return { byId: true, value: s };
}

function deleteLoginAuditSingle(db, target) {
  if (!target.byId) return 0;

  const auditLog = queryOne('SELECT id FROM login_audit_logs WHERE id = ?', [target.value]);
  if (auditLog) {
    db.run('DELETE FROM login_audit_logs WHERE id = ?', [target.value]);
    return 1;
  }

  const attemptLog = queryOne('SELECT id FROM login_attempt_logs WHERE id = ?', [target.value]);
  if (attemptLog) {
    db.run('DELETE FROM login_attempt_logs WHERE id = ?', [target.value]);
    return 1;
  }

  return 0;
}

export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { logId } = await params;
  const target = parseLoginLogTarget(logId);
  if (!target) return NextResponse.json({ error: '缺少紀錄 ID' }, { status: 400 });

  const db = getDB();
  const deleted = deleteLoginAuditSingle(db, target);
  if (!deleted) return NextResponse.json({ error: '登入紀錄不存在' }, { status: 404 });

  saveDB();
  // 敏感操作：刪除登入紀錄。
  auditSensitiveAction(request, auth, {
    action: 'admin.login_audit.delete',
    metadata: { log_id: target.value, deleted_count: deleted },
  });
  return NextResponse.json({ deleted });
}
