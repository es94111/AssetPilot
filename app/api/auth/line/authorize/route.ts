import { NextResponse } from 'next/server';
import { getSystemSettings } from '../../../../../lib/loginHelpers';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { issueLineOAuthState } from '@/lib/lineOAuthState';
import { isAllowedLineRedirectUri, LINE_CHANNEL_ID, LINE_CHANNEL_SECRET } from '../../../../../lib/lineOAuth';
import { getTurnstileSiteKey, verifyTurnstileToken } from '../../../../../lib/turnstile';

const LINE_OAUTH_TXN_COOKIE = 'line_oauth_txn';
const LINE_OAUTH_TXN_MAX_AGE_SEC = 600; // must be >= LINE_OAUTH_STATE_TTL_MS

export async function GET(request: Request) {
  const url = new URL(request.url);
  const flow = url.searchParams.get('flow') === 'link' ? 'link' : 'login';
  const disableAutoLogin = url.searchParams.get('disableAutoLogin') === '1';
  const turnstileToken = String(url.searchParams.get('turnstileToken') || '');
  const originParam = String(url.searchParams.get('origin') || '').trim();
  const returnTo = String(url.searchParams.get('returnTo') || '');
  const origin = originParam || url.origin;
  let redirectUri = '';
  let turnstileVerified = false;

  try {
    const parsedOrigin = new URL(origin);
    redirectUri = `${parsedOrigin.origin}/auth/line/callback`;
  } catch {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 400 });
  }

  if (!getSystemSettings().lineLoginEnabled) {
    return NextResponse.json({ error: 'LINE 登入未啟用' }, { status: 403 });
  }
  if (!LINE_CHANNEL_ID || !LINE_CHANNEL_SECRET) {
    return NextResponse.json({ error: 'LINE 登入未設定' }, { status: 400 });
  }
  if (!isAllowedLineRedirectUri(redirectUri)) {
    return NextResponse.json({ error: 'invalid_redirect_uri' }, { status: 400 });
  }

  if (flow === 'login' && getTurnstileSiteKey()) {
    const turnstile = await verifyTurnstileToken(turnstileToken, request.headers, 'login');
    if (!turnstile.ok) {
      return NextResponse.json({ error: turnstile.error || '請先完成真人驗證' }, { status: 403 });
    }
    turnstileVerified = true;
  }

  // Account-linking transactions must be bound to the initiating authenticated
  // user/session at issuance time; the link consumer then requires an exact
  // match before associating any LINE identity with an account (AUTH-VULN-01 /
  // AUTHZ-VULN-04). Login flow requires no session yet — it is protected below
  // via the browser-bound transaction cookie instead.
  let userId: string | undefined;
  let sessionId: string | undefined;
  if (flow === 'link') {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    userId = auth.userId;
    sessionId = auth.sessionId;
  }

  const { state, nonce, bindingToken } = issueLineOAuthState(flow, {
    turnstileVerified,
    returnTo,
    userId,
    sessionId,
  });
  const authorizeUrl = new URL('https://access.line.me/oauth2/v2.1/authorize');
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', LINE_CHANNEL_ID);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('scope', 'openid profile email');
  authorizeUrl.searchParams.set('nonce', nonce);
  if (disableAutoLogin) {
    authorizeUrl.searchParams.set('disable_auto_login', 'true');
  }

  const response = NextResponse.redirect(authorizeUrl);
  // httpOnly + SameSite=Lax: sent back on LINE's top-level redirect return to
  // our own origin, but never readable by page JS and never sent along with a
  // cross-site request forged from another origin/browser.
  response.cookies.set(LINE_OAUTH_TXN_COOKIE, bindingToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: LINE_OAUTH_TXN_MAX_AGE_SEC,
  });
  return response;
}
