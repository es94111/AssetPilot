import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, saveDB } from '../../../../lib/db';

export async function PUT(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const mode = (() => {
    const v = String(body?.themeMode || '').trim().toLowerCase();
    return ['light', 'dark', 'system'].includes(v) ? v : 'system';
  })();

  getDB().run('UPDATE users SET theme_mode = ? WHERE id = ?', [mode, auth.userId]);
  saveDB();
  return NextResponse.json({ success: true, themeMode: mode });
}
