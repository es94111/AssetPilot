import { NextResponse } from 'next/server';
import { getRequestIpFromHeaders, normalizeEmail } from '@/lib/loginHelpers';
import {
  RECOVERY_COOKIE_NAME,
  RECOVERY_SESSION_TTL_MS,
  auditRecovery,
  checkRecoveryThrottle,
  createRecoverySession,
  findValidRecoveryCode,
  isTrustedRecoveryOrigin,
  normalizeRecoveryCode,
} from '@/lib/accountRecovery';
import { getTurnstileSiteKey, verifyTurnstileToken } from '@/lib/turnstile';

const GENERIC_ERROR = '帳號或復原碼不正確';
const NO_STORE = { 'Cache-Control': 'no-store' };

function fail(status = 401) {
  return NextResponse.json({ error: GENERIC_ERROR }, { status, headers: NO_STORE });
}

export async function POST(request: Request) {
  if (!isTrustedRecoveryOrigin(request.headers)) {
    return NextResponse.json({ error: '不允許的請求來源' }, { status: 403, headers: NO_STORE });
  }
  const body = await request.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  const code = normalizeRecoveryCode(body.code);
  if (!email || code.length < 16) return fail(401);

  if (getTurnstileSiteKey()) {
    const turnstile = await verifyTurnstileToken(
      String(body.turnstileToken || body['cf-turnstile-response'] || ''),
      request.headers,
      'login',
    );
    if (!turnstile.ok) return NextResponse.json({ error: turnstile.error || '請先完成真人驗證' }, { status: 403, headers: NO_STORE });
  }

  const ip = getRequestIpFromHeaders(request.headers);
  if (!checkRecoveryThrottle(ip, email, code)) {
    return NextResponse.json({ error: '嘗試次數過多，請稍後再試' }, { status: 429, headers: NO_STORE });
  }

  const found = findValidRecoveryCode(email, code);
  if (!found) return fail(401);

  const { token } = createRecoverySession(found.userId, found.codeId, ip);
  auditRecovery(request.headers, found.userId, 'recovery_session_start', 'success');
  const response = NextResponse.json({ success: true, expiresInSeconds: RECOVERY_SESSION_TTL_MS / 1000 }, { headers: NO_STORE });
  response.cookies.set(RECOVERY_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth/recovery',
    maxAge: RECOVERY_SESSION_TTL_MS / 1000,
  });
  return response;
}
