import { NextResponse } from 'next/server';
import { requireAuth, normalizeThemeMode } from '../../../../../lib/apiHelpers';
import { getDB, saveDB } from '../../../../../lib/db';

export async function PUT(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const mode = normalizeThemeMode(body?.themeMode);

  // normalizeThemeMode only returns 'light'|'dark'|'system', so invalid input → 'system'
  // If client sent something invalid, reject explicitly
  const input = String(body?.themeMode || '').trim().toLowerCase();
  if (input && !['light', 'dark', 'system'].includes(input)) {
    return NextResponse.json(
      { error: 'themeMode 必須為 light / dark / system 之一', code: 'ValidationError', field: 'themeMode' },
      { status: 400 }
    );
  }

  getDB().run('UPDATE users SET theme_mode = ? WHERE id = ?', [mode, auth.userId]);
  saveDB();

  return NextResponse.json({ ok: true, themeMode: mode });
}
