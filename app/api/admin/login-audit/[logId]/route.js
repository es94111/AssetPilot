import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/apiHelpers';
import { getDB, saveDB } from '../../../../../lib/db.js';

function parseLoginLogTarget(rawId) {
  const s = String(rawId || '').trim();
  if (!s) return null;
  if (s.startsWith('rid:')) {
    const n = Number(s.slice(4));
    if (!Number.isFinite(n) || n <= 0) return null;
    return { byRowId: true, value: n };
  }
  if (s.startsWith('ts:')) {
    const n = Number(s.slice(3));
    if (!Number.isFinite(n)) return null;
    return { byTimestamp: true, value: n };
  }
  return { byId: true, value: s };
}

function deleteLoginAuditSingle(db, target) {
  let deleted = 0;
  if (target.byRowId) {
    db.run('DELETE FROM login_audit_logs WHERE rowid = ?', [target.value]);
  } else if (target.byTimestamp) {
    db.run(
      `DELETE FROM login_audit_logs WHERE rowid IN (
         SELECT rowid FROM login_audit_logs WHERE login_at = ? ORDER BY rowid DESC LIMIT 1
       )`,
      [target.value]
    );
  } else {
    db.run('DELETE FROM login_audit_logs WHERE id = ?', [target.value]);
  }
  deleted += db.getRowsModified();
  if (deleted > 0) return deleted;

  if (target.byRowId) {
    db.run('DELETE FROM login_attempt_logs WHERE rowid = ?', [target.value]);
  } else if (target.byTimestamp) {
    db.run(
      `DELETE FROM login_attempt_logs WHERE rowid IN (
         SELECT rowid FROM login_attempt_logs WHERE login_at = ? ORDER BY rowid DESC LIMIT 1
       )`,
      [target.value]
    );
  } else {
    db.run('DELETE FROM login_attempt_logs WHERE id = ?', [target.value]);
  }
  deleted += db.getRowsModified();
  return deleted;
}

export async function DELETE(request, { params }) {
  const auth = requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { logId } = await params;
  const target = parseLoginLogTarget(logId);
  if (!target) return NextResponse.json({ error: '缺少紀錄 ID' }, { status: 400 });

  const db = getDB();
  const deleted = deleteLoginAuditSingle(db, target);
  if (!deleted) return NextResponse.json({ error: '登入紀錄不存在' }, { status: 404 });

  saveDB();
  return NextResponse.json({ deleted });
}
