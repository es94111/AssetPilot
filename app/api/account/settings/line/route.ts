import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../../lib/db';

export async function DELETE(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const user = queryOne('SELECT line_id, has_password, google_id FROM users WHERE id = ?', [auth.userId]);
  if (!user || !user.line_id) {
    return NextResponse.json({ error: '尚未綁定 LINE 帳號' }, { status: 400 });
  }
  if (!user.has_password && !user.google_id) {
    return NextResponse.json(
      { error: '請先設定本機密碼或綁定 Google 帳號後才可解除 LINE 綁定' },
      { status: 400 }
    );
  }

  getDB().run("UPDATE users SET line_id = '' WHERE id = ?", [auth.userId]);
  saveDB();

  return NextResponse.json({ ok: true });
}
