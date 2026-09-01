import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';
import { getSystemSettings } from '../../../../lib/loginHelpers';
import { consumeLineOAuthStateEntry } from '@/lib/lineOAuthState';
import {
  LINE_CHANNEL_ID,
  LINE_CHANNEL_SECRET,
  exchangeLineCodeForToken,
  isAllowedLineRedirectUri,
  verifyLineIdToken,
} from '../../../../lib/lineOAuth';

const LINE_OAUTH_TXN_COOKIE = 'line_oauth_txn';

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const { code, redirect_uri, state, bindingToken: bodyBindingToken } = body;
  if (!code) return NextResponse.json({ error: '缺少 LINE 授權碼' }, { status: 400 });
  if (!isAllowedLineRedirectUri(String(redirect_uri || '').trim())) {
    return NextResponse.json({ error: 'invalid_redirect_uri' }, { status: 400 });
  }

  const stateEntry = consumeLineOAuthStateEntry(state);
  // The link consumer must only ever accept a state minted for the link flow,
  // and only when it was issued for THIS authenticated user/session. Without
  // this, a state an attacker mints for their own LINE identity (e.g. via the
  // unauthenticated login flow, or their own link flow) could be relayed into
  // a victim's authenticated browser and linked onto the victim's account
  // (AUTH-VULN-01 / AUTHZ-VULN-04 / AUTHZ-VULN-05).
  if (
    !stateEntry ||
    stateEntry.flow !== 'link' ||
    !stateEntry.userId ||
    stateEntry.userId !== auth.userId
  ) {
    return NextResponse.json({ error: 'state_mismatch' }, { status: 400 });
  }

  const cookieBindingToken = (request as any).cookies?.get?.(LINE_OAUTH_TXN_COOKIE)?.value;
  const providedBindingToken = String(bodyBindingToken || cookieBindingToken || '');
  if (!stateEntry.bindingToken || providedBindingToken !== stateEntry.bindingToken) {
    return NextResponse.json({ error: 'state_mismatch' }, { status: 400 });
  }

  const nonce = stateEntry.nonce;
  if (!getSystemSettings().lineLoginEnabled) return NextResponse.json({ error: 'LINE 登入未啟用' }, { status: 403 });
  if (!LINE_CHANNEL_ID || !LINE_CHANNEL_SECRET) return NextResponse.json({ error: 'LINE 登入未設定' }, { status: 400 });

  try {
    const { tokenRes, tokenData } = await exchangeLineCodeForToken(String(code), String(redirect_uri || '').trim());
    if (!tokenRes.ok || !tokenData?.id_token) {
      return NextResponse.json({ error: 'LINE 授權碼交換失敗：' + (tokenData?.error_description || tokenData?.error || '未知錯誤') }, { status: 401 });
    }
    const { verifyRes, payload } = await verifyLineIdToken(String(tokenData.id_token), nonce);
    if (!verifyRes.ok) {
      return NextResponse.json({ error: 'LINE ID Token 驗證失敗：' + (payload?.error_description || payload?.error || '未知錯誤') }, { status: 401 });
    }

    const lineId = String(payload.sub || '');
    const lineEmail = String(payload.email || '').toLowerCase();
    const picture = String(payload.picture || '');
    if (!lineId) return NextResponse.json({ error: '無法取得 LINE 使用者 ID' }, { status: 400 });

    const existing = queryOne('SELECT id FROM users WHERE line_id = ? AND id != ?', [lineId, auth.userId]);
    if (existing) return NextResponse.json({ error: '此 LINE 帳號已被其他使用者綁定' }, { status: 400 });

    getDB().run('UPDATE users SET line_id = ?, avatar_url = ? WHERE id = ?', [lineId, picture, auth.userId]);
    saveDB();
    const response = NextResponse.json({ success: true, lineEmail, avatarUrl: picture });
    response.cookies.delete(LINE_OAUTH_TXN_COOKIE);
    return response;
  } catch (e) {
    const message = e instanceof Error ? e.message : '未知錯誤';
    return NextResponse.json({ error: '綁定失敗：' + message }, { status: 500 });
  }
}
