import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const { credential } = body;
  if (!credential) return NextResponse.json({ error: '缺少 Google 憑證' }, { status: 400 });

  const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
  if (!GOOGLE_CLIENT_ID) return NextResponse.json({ error: 'Google SSO 未設定' }, { status: 400 });

  try {
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!verifyRes.ok) return NextResponse.json({ error: 'Google 憑證驗證失敗' }, { status: 401 });
    const payload = await verifyRes.json();
    if (payload.aud !== GOOGLE_CLIENT_ID) return NextResponse.json({ error: 'Google 憑證 audience 不符' }, { status: 401 });

    const googleId = payload.sub;
    const googleEmail = payload.email?.toLowerCase();
    const picture = payload.picture || '';

    const existing = queryOne('SELECT id FROM users WHERE google_id = ? AND id != ?', [googleId, auth.userId]);
    if (existing) return NextResponse.json({ error: '此 Google 帳號已被其他使用者綁定' }, { status: 400 });

    getDB().run('UPDATE users SET google_id = ?, avatar_url = ? WHERE id = ?', [googleId, picture, auth.userId]);
    saveDB();
    return NextResponse.json({ success: true, googleEmail, avatarUrl: picture });
  } catch (e) {
    return NextResponse.json({ error: '綁定失敗：' + e.message }, { status: 500 });
  }
}
