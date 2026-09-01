import { NextResponse } from 'next/server';
import { issueLineOAuthState } from '@/lib/lineOAuthState';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { getTurnstileSiteKey, verifyTurnstileToken } from '../../../../../lib/turnstile';

const LINE_OAUTH_TXN_COOKIE = 'line_oauth_txn';
const LINE_OAUTH_TXN_MAX_AGE_SEC = 600;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const flow = url.searchParams.get('flow') === 'link' ? 'link' : 'login';
  let turnstileVerified = false;

  if (flow === 'login' && getTurnstileSiteKey()) {
    const turnstileToken = String(url.searchParams.get('turnstileToken') || '');
    const turnstile = await verifyTurnstileToken(turnstileToken, request.headers, 'login');
    if (!turnstile.ok) {
      return NextResponse.json({ error: turnstile.error || '請先完成真人驗證' }, { status: 403 });
    }
    turnstileVerified = true;
  }

  // See app/api/auth/line/authorize/route.ts: link-flow state must be bound to
  // the initiating authenticated user/session (AUTH-VULN-01 / AUTHZ-VULN-04).
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
    userId,
    sessionId,
  });
  // bindingToken is returned explicitly (this JSON endpoint is also used by the
  // native mobile app, whose HTTP client and in-app browser do not share a
  // cookie jar) and the caller must echo it back when consuming the state.
  const response = NextResponse.json({ state, nonce, bindingToken });
  response.headers.set('Cache-Control', 'no-store');
  response.cookies.set(LINE_OAUTH_TXN_COOKIE, bindingToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: LINE_OAUTH_TXN_MAX_AGE_SEC,
  });
  return response;
}
