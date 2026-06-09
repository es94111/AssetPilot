import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDB, queryOne, saveDB } from '../../../../lib/db';
import {
  normalizeEmail,
  getUserCount,
  canSelfRegister,
  recordLoginAudit,
  recordLoginAttempt,
} from '../../../../lib/loginHelpers';
import { uid, todayStr, createDefaultsForUser, backfillDefaultsForUser } from '../../../../lib/userDefaults';
import { formatUser, setAuthCookie } from '../../../../lib/apiHelpers';
import { consumeGoogleOAuthState } from '@/lib/googleOAuthState';
import { createLoginSession } from '../../../../lib/sessionHelpers';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_OAUTH_REDIRECT_URIS = (process.env.GOOGLE_OAUTH_REDIRECT_URIS || '')
  .split(',').map(s => s.trim()).filter(Boolean);
const APP_HOST = process.env.APP_HOST || 'localhost';
const PORT = process.env.PORT || 3000;

function buildGoogleRedirectAllowlist() {
  if (GOOGLE_OAUTH_REDIRECT_URIS.length > 0) return new Set(GOOGLE_OAUTH_REDIRECT_URIS);
  const fallback = [
    `https://${APP_HOST}/`, `https://${APP_HOST}`,
    `http://localhost:${PORT}/`, `http://localhost:${PORT}`,
    // mobile App Link callback (fixed path used by the Android app)
    `https://${APP_HOST}/app/google-callback`,
  ];
  return new Set(fallback);
}
const googleRedirectUriAllowlist = buildGoogleRedirectAllowlist();

function isAllowedGoogleRedirectUri(uri: string) {
  if (!uri) return false;
  if (googleRedirectUriAllowlist.has(uri)) return true;
  const stripped = String(uri).replace(/\/$/, '');
  return googleRedirectUriAllowlist.has(stripped) || googleRedirectUriAllowlist.has(stripped + '/');
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { code, redirect_uri, state } = body;
  const headers = request.headers;

  if (!code) return NextResponse.json({ error: 'invalid_code' }, { status: 400 });

  if (!isAllowedGoogleRedirectUri(String(redirect_uri || '').trim())) {
    recordLoginAttempt({ email: '', headers, method: 'google', isSuccess: false, failureReason: 'invalid_redirect_uri' });
    return NextResponse.json({ error: 'invalid_redirect_uri' }, { status: 400 });
  }

  if (!consumeGoogleOAuthState(state)) return NextResponse.json({ error: 'state_mismatch' }, { status: 400 });
  if (!GOOGLE_CLIENT_ID) return NextResponse.json({ error: 'Google SSO 未設定' }, { status: 400 });
  if (!GOOGLE_CLIENT_SECRET) return NextResponse.json({ error: 'Google SSO 需設定 GOOGLE_CLIENT_SECRET' }, { status: 400 });

  try {
    const originalRedirect = String(redirect_uri || '').trim();
    const redirectCandidates = originalRedirect
      ? [...new Set([originalRedirect, originalRedirect.endsWith('/') ? originalRedirect.slice(0, -1) : originalRedirect + '/'])]
      : [''];

    let tokenData: any = null;
    let tokenRes: Response | null = null;
    for (const ru of redirectCandidates) {
      tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: GOOGLE_CLIENT_ID, client_secret: GOOGLE_CLIENT_SECRET, redirect_uri: ru, grant_type: 'authorization_code' }),
      });
      tokenData = await tokenRes.json();
      if (tokenRes.ok && tokenData.id_token) break;
    }

    if (!tokenRes?.ok || !tokenData?.id_token) {
      return NextResponse.json({ error: 'Google 授權碼交換失敗：' + (tokenData?.error_description || tokenData?.error || '未知錯誤') }, { status: 401 });
    }

    const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userinfo = await userinfoRes.json();
    const email = normalizeEmail(userinfo.email);
    const name = userinfo.name || email?.split('@')[0] || 'Google User';
    const googleId = userinfo.sub;
    const picture = userinfo.picture || '';

    if (!email) return NextResponse.json({ error: '無法取得 Google 帳號 Email' }, { status: 400 });

    const db = getDB();
    let user = queryOne('SELECT * FROM users WHERE google_id = ?', [googleId]);
    if (!user) user = queryOne('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      const registerCheck = canSelfRegister(email);
      if (!registerCheck.ok) return NextResponse.json({ error: registerCheck.error }, { status: 403 });
      const id = uid();
      const firstUser = getUserCount() === 0;
      const isAdmin = firstUser ? 1 : 0;
      const randomHash = await bcrypt.hash(uid() + Date.now(), 10);
      db.run('INSERT INTO users (id, email, password_hash, display_name, google_id, avatar_url, is_admin, created_at) VALUES (?,?,?,?,?,?,?,?)',
        [id, email, randomHash, name, googleId, picture, isAdmin, todayStr()]);
      createDefaultsForUser(id);
      saveDB();
      user = queryOne('SELECT * FROM users WHERE id = ?', [id]);
    } else {
      const updates = [];
      const vals = [];
      if (!user.google_id) { updates.push('google_id = ?'); vals.push(googleId); }
      if (picture && picture !== user.avatar_url) { updates.push('avatar_url = ?'); vals.push(picture); }
      if (name && (!user.display_name || user.display_name === String(user.email || '').split('@')[0])) {
        updates.push('display_name = ?'); vals.push(name);
      }
      if (updates.length > 0) {
        db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, [...vals, user.id]);
        saveDB();
        user = queryOne('SELECT * FROM users WHERE id = ?', [user.id]);
      }
    }

    if (!user) return NextResponse.json({ error: '使用者不存在' }, { status: 401 });
    const loginUser = { id: String(user.id), email: String(user.email || ''), is_admin: Number(user.is_admin) || 0 };
    const currentLogin = recordLoginAudit(loginUser, headers, 'google');
    recordLoginAttempt({ user: loginUser, email: loginUser.email, headers, method: 'google', isSuccess: true });
    try { backfillDefaultsForUser(loginUser.id); } catch (e) { console.error('[backfill]', e); }

    const { token } = createLoginSession(loginUser.id, Number(user.token_version) || 0, headers);
    const response = NextResponse.json({ user: formatUser(user), currentLogin });
    return setAuthCookie(response, token);
  } catch (e) {
    const message = e instanceof Error ? e.message : '未知錯誤';
    console.error('Google SSO 錯誤:', message);
    return NextResponse.json({ error: 'Google 登入失敗：' + message }, { status: 500 });
  }
}
