import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const user = queryOne('SELECT google_id FROM users WHERE id = ?', [auth.userId]);
  if (!user || !user.google_id) return NextResponse.json({ error: '尚未綁定 Google 帳號' }, { status: 400 });

  getDB().run("UPDATE users SET google_id = '' WHERE id = ?", [auth.userId]);
  saveDB();
  return NextResponse.json({ success: true });
}
