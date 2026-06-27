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

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  let body;
  try { body = await request.json(); } catch { body = {}; }

  const ids = Array.isArray(body?.ids) ? body.ids : [];
  if (ids.length === 0) return NextResponse.json({ error: '請選擇要刪除的紀錄' }, { status: 400 });

  const db = getDB();
  let deleted = 0;
  for (const rawId of ids) {
    const target = parseLoginLogTarget(rawId);
    if (!target) continue;
    deleted += deleteLoginAuditSingle(db, target);
  }
  saveDB();

  // 敏感操作：批次刪除登入紀錄。
  auditSensitiveAction(request, auth, {
    action: 'admin.login_audit.batch_delete',
    metadata: { requested_count: ids.length, deleted_count: deleted },
  });

  return NextResponse.json({ deleted });
}
