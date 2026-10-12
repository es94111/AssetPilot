import { NextRequest, NextResponse } from 'next/server';
import { queryOne } from '@/lib/db';
import { consumePasskeyChallenge } from '@/lib/passkeyChallenge';
import { PasskeyOriginUnavailableError, verifyPasskeyRegistration, type VerifiedPasskeyCredential } from '@/lib/passkeyRegistration';
import { formatUser, setAuthCookie } from '@/lib/apiHelpers';
import { createLoginSession } from '@/lib/sessionHelpers';
import { getRequestIpFromHeaders, recordLoginAudit, recordLoginAttempt } from '@/lib/loginHelpers';
import {
  SETUP_CHALLENGE_PURPOSE,
  SetupError,
  auditSetup,
  checkSetupThrottle,
  completeSetup,
  isSetupRequired,
  isTrustedSetupOrigin,
  validateSetupIdentity,
  verifySetupToken,
} from '@/lib/setupBootstrap';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function POST(request: NextRequest) {
  if (!isTrustedSetupOrigin(request.headers)) {
    return NextResponse.json({ error: '不允許的請求來源' }, { status: 403, headers: NO_STORE });
  }
  if (!isSetupRequired()) {
    return NextResponse.json({ error: '系統已完成初始化' }, { status: 404, headers: NO_STORE });
  }
  if (!checkSetupThrottle(getRequestIpFromHeaders(request.headers as never))) {
    auditSetup(request.headers, 'setup_complete', 'failure', undefined, 'rate_limited');
    return NextResponse.json({ error: '嘗試次數過多，請稍後再試' }, { status: 429, headers: NO_STORE });
  }

  const body = await request.json().catch(() => ({}));
  const { registration, challengeKey, deviceName } = body;
  if (!registration || !challengeKey) {
    return NextResponse.json({ error: '缺少註冊資料' }, { status: 400, headers: NO_STORE });
  }

  const tokenHash = verifySetupToken(body.token);
  if (!tokenHash) {
    auditSetup(request.headers, 'setup_complete', 'failure', undefined, 'invalid_token');
    return NextResponse.json({ error: '初始化憑證不正確或已失效' }, { status: 401, headers: NO_STORE });
  }

  const entry = consumePasskeyChallenge(String(challengeKey));
  if (!entry || entry.purpose !== SETUP_CHALLENGE_PURPOSE || entry.bindingId !== tokenHash || !entry.userId) {
    auditSetup(request.headers, 'setup_complete', 'failure', undefined, 'invalid_challenge');
    return NextResponse.json({ error: 'Challenge 已過期或無效，請重試' }, { status: 400, headers: NO_STORE });
  }

  let identity;
  try {
    identity = validateSetupIdentity(body);
  } catch (e) {
    const err = e as SetupError;
    return NextResponse.json({ error: err.message }, { status: err.status || 400, headers: NO_STORE });
  }

  // WebAuthn 驗證（async）必須在資料庫交易之前完成。
  let credential: VerifiedPasskeyCredential;
  try {
    credential = await verifyPasskeyRegistration(registration, entry.challenge, request.headers.get('origin'));
  } catch (e) {
    if (e instanceof PasskeyOriginUnavailableError) {
      return NextResponse.json({ error: e.message }, { status: 500, headers: NO_STORE });
    }
    auditSetup(request.headers, 'setup_complete', 'failure', undefined, 'passkey_verification_failed');
    return NextResponse.json({ error: 'Passkey 註冊驗證失敗，請重試' }, { status: 400, headers: NO_STORE });
  }

  try {
    completeSetup({ tokenHash, userId: entry.userId, identity, credential, deviceName });
  } catch (e) {
    if (e instanceof SetupError) {
      auditSetup(request.headers, 'setup_complete', 'failure', undefined, e.code);
      return NextResponse.json({ error: e.message }, { status: e.status, headers: NO_STORE });
    }
    console.error('[setup] initialisation failed', e instanceof Error ? e.message : 'unknown');
    auditSetup(request.headers, 'setup_complete', 'failure', undefined, 'internal_error');
    return NextResponse.json({ error: '初始化失敗，請重試' }, { status: 500, headers: NO_STORE });
  }

  const user = queryOne('SELECT * FROM users WHERE id = ?', [entry.userId]);
  if (!user) return NextResponse.json({ error: '初始化失敗，請重試' }, { status: 500, headers: NO_STORE });
  const loginUser = { id: String(user.id), email: String(user.email || ''), is_admin: Number(user.is_admin) || 0 };

  auditSetup(request.headers, 'setup_complete', 'success', loginUser.id);
  const currentLogin = recordLoginAudit(loginUser, request.headers, 'passkey');
  recordLoginAttempt({ user: loginUser, email: loginUser.email, headers: request.headers, method: 'passkey', isSuccess: true });

  const { token } = createLoginSession(loginUser.id, Number(user.token_version) || 0, request.headers);
  const response = NextResponse.json({ user: formatUser(user), currentLogin }, { headers: NO_STORE });
  return setAuthCookie(response, token);
}
