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

  return NextResponse.json({ deleted });
}
