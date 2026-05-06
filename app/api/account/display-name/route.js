import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, saveDB } from '../../../../lib/db';

export async function PUT(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const displayName = String(body?.displayName || '').trim();
  if (!displayName) return NextResponse.json({ error: '顯示名稱不可空白' }, { status: 400 });
  if (displayName.length > 50) return NextResponse.json({ error: '顯示名稱最多 50 字' }, { status: 400 });

  getDB().run('UPDATE users SET display_name = ? WHERE id = ?', [displayName, auth.userId]);
  saveDB();
  return NextResponse.json({ success: true, displayName });
}
