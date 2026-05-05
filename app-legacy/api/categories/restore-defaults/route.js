import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, saveDB } from '../../../../lib/db';
import { backfillDefaultsForUser } from '../../../../lib/userDefaults';

export async function POST(request) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const db = getDB();
  db.run('BEGIN');
  try {
    db.run('DELETE FROM deleted_defaults WHERE user_id = ?', [auth.userId]);
    db.run('COMMIT');
  } catch (err) {
    try { db.run('ROLLBACK'); } catch (_) {}
    console.error('[restore-defaults] DELETE registry failed', err);
    return NextResponse.json({ error: '還原預設分類失敗' }, { status: 500 });
  }

  let inserted = 0;
  try {
    inserted = backfillDefaultsForUser(auth.userId);
  } catch (err) {
    console.error('[restore-defaults] backfill failed', err);
    return NextResponse.json({ error: '補建預設分類失敗' }, { status: 500 });
  }

  saveDB();
  return NextResponse.json({ ok: true, restored: inserted });
}
