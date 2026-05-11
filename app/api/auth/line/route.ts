import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getDB, queryOne, saveDB } from '../../../../lib/db';
import {
  normalizeEmail,
  getUserCount,
  canSelfRegister,
  recordLoginAudit,
  recordLoginAttempt,
  getSystemSettings,
} from '../../../../lib/loginHelpers';
import { uid, todayStr, createDefaultsForUser, backfillDefaultsForUser } from '../../../../lib/userDefaults';
import { formatUser, setAuthCookie } from '../../../../lib/apiHelpers';
import { consumeLineOAuthState } from '@/lib/lineOAuthState';
import { createLoginSession } from '../../../../lib/sessionHelpers';
import {
  LINE_CHANNEL_ID,
  LINE_CHANNEL_SECRET,
  exchangeLineCodeForToken,
  isAllowedLineRedirectUri,
  verifyLineIdToken,
} from '../../../../lib/lineOAuth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { code, redirect_uri, state } = body;
  const headers = request.headers;

  if (!code) return NextResponse.json({ error: 'invalid_code' }, { status: 400 });
  if (!isAllowedLineRedirectUri(String(redirect_uri || '').trim())) {
    recordLoginAttempt({ email: '', headers, method: 'line', isSuccess: false, failureReason: 'invalid_redirect_uri' });
    return NextResponse.json({ error: 'invalid_redirect_uri' }, { status: 400 });
  }

  const nonce = consumeLineOAuthState(state);
  if (!nonce) return NextResponse.json({ error: 'state_mismatch' }, { status: 400 });

  const settings = getSystemSettings();
  if (!settings.lineLoginEnabled) return NextResponse.json({ error: 'LINE 登入未啟用' }, { status: 403 });
  if (!LINE_CHANNEL_ID || !LINE_CHANNEL_SECRET) return NextResponse.json({ error: 'LINE 登入未設定' }, { status: 400 });

  try {
    const redirectUri = String(redirect_uri || '').trim();
    const { tokenRes, tokenData } = await exchangeLineCodeForToken(String(code), redirectUri);
    if (!tokenRes.ok || !tokenData?.id_token) {
      recordLoginAttempt({ email: '', headers, method: 'line', isSuccess: false, failureReason: 'token_exchange_failed' });
      return NextResponse.json({ error: 'LINE 授權碼交換失敗：' + (tokenData?.error_description || tokenData?.error || '未知錯誤') }, { status: 401 });
    }

    const { verifyRes, payload } = await verifyLineIdToken(String(tokenData.id_token), nonce);
    if (!verifyRes.ok) {
      recordLoginAttempt({ email: '', headers, method: 'line', isSuccess: false, failureReason: 'id_token_verify_failed' });
      return NextResponse.json({ error: 'LINE ID Token 驗證失敗：' + (payload?.error_description || payload?.error || '未知錯誤') }, { status: 401 });
    }

    const lineId = String(payload.sub || '');
    const email = normalizeEmail(payload.email);
    const name = payload.name || email?.split('@')[0] || 'LINE User';
    const picture = payload.picture || '';

    if (!lineId) return NextResponse.json({ error: '無法取得 LINE 使用者 ID' }, { status: 400 });
    if (!email) return NextResponse.json({ error: '無法取得 LINE 帳號 Email，請確認 LINE Login channel 已申請 email 權限' }, { status: 400 });

    const db = getDB();
    let user = queryOne('SELECT * FROM users WHERE line_id = ?', [lineId]);
    if (!user) user = queryOne('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      const registerCheck = canSelfRegister(email);
      if (!registerCheck.ok) return NextResponse.json({ error: registerCheck.error }, { status: 403 });
      const id = uid();
      const firstUser = getUserCount() === 0;
      const isAdmin = firstUser ? 1 : 0;
      const randomHash = await bcrypt.hash(uid() + Date.now(), 10);
      db.run(
        'INSERT INTO users (id, email, password_hash, display_name, line_id, avatar_url, is_admin, has_password, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
        [id, email, randomHash, name, lineId, picture, isAdmin, 0, todayStr()]
      );
      createDefaultsForUser(id);
      saveDB();
      user = queryOne('SELECT * FROM users WHERE id = ?', [id]);
    } else {
      const updates: string[] = [];
      const vals: Array<string | number | null> = [];
      if (!user.line_id) { updates.push('line_id = ?'); vals.push(lineId); }
      if (picture && picture !== user.avatar_url) { updates.push('avatar_url = ?'); vals.push(picture); }
      if (name && (!user.display_name || user.display_name === String(user.email || '').split('@')[0])) {
        updates.push('display_name = ?'); vals.push(name);
      }
      if (updates.length > 0) {
        db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, [...vals, String(user.id)]);
        saveDB();
        user = queryOne('SELECT * FROM users WHERE id = ?', [String(user.id)]);
      }
    }

    if (!user) return NextResponse.json({ error: '使用者不存在' }, { status: 401 });
    const loginUser = { id: String(user.id), email: String(user.email || ''), is_admin: Number(user.is_admin) || 0 };
    const currentLogin = recordLoginAudit(loginUser, headers, 'line');
    recordLoginAttempt({ user: loginUser, email: loginUser.email, headers, method: 'line', isSuccess: true });
    try { backfillDefaultsForUser(loginUser.id); } catch (e) { console.error('[backfill]', e); }

    const { token } = createLoginSession(loginUser.id, Number(user.token_version) || 0, headers);
    const response = NextResponse.json({ user: formatUser(user), currentLogin });
    return setAuthCookie(response, token);
  } catch (e) {
    const message = e instanceof Error ? e.message : '未知錯誤';
    console.error('LINE SSO 錯誤:', message);
    return NextResponse.json({ error: 'LINE 登入失敗：' + message }, { status: 500 });
  }
}
