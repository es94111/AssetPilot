import { NextRequest, NextResponse } from 'next/server';
import { server as webauthnServer } from '@passwordless-id/webauthn';
import { getDB, queryOne, saveDB } from '@/lib/db';
import { consumePasskeyChallenge } from '@/lib/passkeyChallenge';
import { resolvePasskeyExpectedOrigin } from '@/lib/originPolicy';
import { formatUser, setAuthCookie } from '@/lib/apiHelpers';
import { createLoginSession, revokeAllLoginSessions } from '@/lib/sessionHelpers';
import { recordLoginAudit, recordLoginAttempt } from '@/lib/loginHelpers';
import {
  RECOVERY_CHALLENGE_PURPOSE,
  RECOVERY_COOKIE_NAME,
  auditRecovery,
  consumeRecoveryCode,
  isTrustedRecoveryOrigin,
  removePasskeysExcept,
  verifyRecoverySession,
} from '@/lib/accountRecovery';

const NO_STORE = { 'Cache-Control': 'no-store' };

function clearRecoveryCookie(response: NextResponse) {
  response.cookies.set(RECOVERY_COOKIE_NAME, '', { path: '/api/auth/recovery', maxAge: 0 });
  return response;
}

export async function POST(request: NextRequest) {
  if (!isTrustedRecoveryOrigin(request.headers)) {
    return NextResponse.json({ error: '不允許的請求來源' }, { status: 403, headers: NO_STORE });
  }
  const session = verifyRecoverySession(request.cookies.get(RECOVERY_COOKIE_NAME)?.value);
  if (!session) return NextResponse.json({ error: '復原工作階段已失效' }, { status: 401, headers: NO_STORE });

  const body = await request.json().catch(() => ({}));
  const { registration, challengeKey, deviceName, removeOtherPasskeys } = body;
  if (!registration || !challengeKey) return NextResponse.json({ error: '缺少註冊資料' }, { status: 400, headers: NO_STORE });

  const entry = consumePasskeyChallenge(String(challengeKey));
  if (
    !entry ||
    entry.purpose !== RECOVERY_CHALLENGE_PURPOSE ||
    entry.bindingId !== session.id ||
    entry.userId !== session.userId
  ) {
    return NextResponse.json({ error: 'Challenge 已過期或無效，請重試' }, { status: 400, headers: NO_STORE });
  }

  const { origin } = resolvePasskeyExpectedOrigin(request.headers.get('origin'));
  if (!origin) return NextResponse.json({ error: '伺服器未設定允許的網域，無法驗證 Passkey' }, { status: 500, headers: NO_STORE });

  let credential;
  try {
    const result = await webauthnServer.verifyRegistration(registration, { challenge: entry.challenge, origin, userVerified: true });
    credential = result.credential;
  } catch {
    auditRecovery(request.headers, session.userId, 'recovery_complete', 'failure');
    return NextResponse.json({ error: 'Passkey 註冊驗證失敗，請重試' }, { status: 400, headers: NO_STORE });
  }

  if (queryOne('SELECT credential_id FROM passkey_credentials WHERE credential_id = ?', [credential.id])) {
    return NextResponse.json({ error: '此 Passkey 已註冊過' }, { status: 400, headers: NO_STORE });
  }

  // 驗證通過後才原子消耗復原碼；並發重放只會有一個成功。
  if (!consumeRecoveryCode(session)) {
    auditRecovery(request.headers, session.userId, 'recovery_complete', 'failure');
    return NextResponse.json({ error: '復原碼已被使用或失效' }, { status: 409, headers: NO_STORE });
  }

  try {
    getDB().run(
      'INSERT INTO passkey_credentials (credential_id, user_id, public_key, algorithm, transports, counter, device_name, created_at) VALUES (?,?,?,?,?,?,?,?)',
      [
        credential.id,
        session.userId,
        credential.publicKey,
        credential.algorithm,
        JSON.stringify(credential.transports || []),
        0,
        String(deviceName || '').trim().slice(0, 60) || 'Passkey',
        new Date().toISOString().slice(0, 10),
      ],
    );
  } catch (e) {
    console.error('[recovery] passkey insert failed', e instanceof Error ? e.message : 'unknown');
    getDB().run('UPDATE account_recovery_codes SET used_at = 0, revoked_at = 0 WHERE id = ?', [session.codeId]);
    saveDB();
    return NextResponse.json({ error: '註冊失敗，請重試' }, { status: 500, headers: NO_STORE });
  }

  const removed = removeOtherPasskeys ? removePasskeysExcept(session.userId, credential.id) : 0;
  revokeAllLoginSessions(session.userId);

  const user = queryOne('SELECT * FROM users WHERE id = ?', [session.userId]);
  if (!user) return NextResponse.json({ error: '使用者不存在' }, { status: 401, headers: NO_STORE });
  const loginUser = { id: String(user.id), email: String(user.email || ''), is_admin: Number(user.is_admin) || 0 };

  auditRecovery(request.headers, session.userId, 'recovery_complete', 'success', { removed_passkey_count: removed });
  const currentLogin = recordLoginAudit(loginUser, request.headers, 'passkey');
  recordLoginAttempt({ user: loginUser, email: loginUser.email, headers: request.headers, method: 'passkey', isSuccess: true });

  const { token } = createLoginSession(loginUser.id, Number(user.token_version) || 0, request.headers);
  const response = NextResponse.json({ user: formatUser(user), currentLogin, removedPasskeys: removed }, { headers: NO_STORE });
  return clearRecoveryCookie(setAuthCookie(response, token));
}
