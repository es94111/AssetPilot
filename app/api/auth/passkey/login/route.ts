import { NextResponse } from 'next/server';
import { server as webauthnServer } from '@passwordless-id/webauthn';
import type { CredentialInfo } from '@passwordless-id/webauthn';
import { getDB, queryOne, saveDB } from '../../../../../lib/db';
import { recordLoginAudit, recordLoginAttempt } from '../../../../../lib/loginHelpers';
import { backfillDefaultsForUser } from '../../../../../lib/userDefaults';
import { formatUser, isActiveUserFlag, setAuthCookie } from '../../../../../lib/apiHelpers';
import { consumePasskeyChallenge } from '@/lib/passkeyChallenge';
import { createLoginSession } from '../../../../../lib/sessionHelpers';
import { getTurnstileSiteKey, verifyTurnstileToken } from '../../../../../lib/turnstile';
import { resolvePasskeyExpectedOrigin } from '@/lib/originPolicy';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { authentication, challengeKey } = body;
  const turnstileToken = String(body.turnstileToken || body['cf-turnstile-response'] || '');
  if (!authentication || !challengeKey) {
    return NextResponse.json({ error: '缺少認證資料' }, { status: 400 });
  }

  if (getTurnstileSiteKey()) {
    const turnstile = await verifyTurnstileToken(turnstileToken, request.headers, 'login');
    if (!turnstile.ok) {
      recordLoginAttempt({ email: '', headers: request.headers, method: 'passkey', isSuccess: false, failureReason: 'turnstile_failed' });
      return NextResponse.json({ error: turnstile.error || '請先完成真人驗證' }, { status: 403 });
    }
  }

  const entry = consumePasskeyChallenge(challengeKey);
  if (!entry) return NextResponse.json({ error: 'Challenge 已過期或無效，請重試' }, { status: 400 });

  const cred = queryOne('SELECT * FROM passkey_credentials WHERE credential_id = ?', [authentication.id]);
  if (!cred) {
    recordLoginAttempt({ email: '', headers: request.headers, method: 'passkey', isSuccess: false, failureReason: 'credential_not_found' });
    return NextResponse.json({ error: '找不到對應的 Passkey 憑證' }, { status: 401 });
  }

  const user = queryOne('SELECT * FROM users WHERE id = ?', [cred.user_id]);
  if (!user) return NextResponse.json({ error: '使用者不存在' }, { status: 401 });
  if (!isActiveUserFlag(user.is_active)) {
    recordLoginAttempt({ email: String(user.email || ''), headers: request.headers, method: 'passkey', isSuccess: false, failureReason: 'account_disabled' });
    return NextResponse.json({ error: '帳號已停用，請聯繫管理員' }, { status: 403 });
  }

  try {
    const credentialKey: CredentialInfo = {
      id: String(cred.credential_id || ''),
      publicKey: String(cred.public_key || ''),
      algorithm: String(cred.algorithm || '') as CredentialInfo['algorithm'],
      transports: JSON.parse(String(cred.transports || '[]')),
    };
    const { origin } = resolvePasskeyExpectedOrigin(request.headers.get('origin'));
    if (!origin) {
      return NextResponse.json({ error: '伺服器未設定允許的網域（ALLOWED_ORIGINS），無法驗證 Passkey' }, { status: 500 });
    }
    const result = await webauthnServer.verifyAuthentication(authentication, credentialKey, {
      challenge: entry.challenge,
      origin,
      userVerified: true,
      counter: Number(cred.counter) || 0,
    });

    getDB().run('UPDATE passkey_credentials SET counter = ? WHERE credential_id = ?', [result.counter || 0, cred.credential_id]);
    saveDB();

    const loginUser = { id: String(user.id), email: String(user.email || ''), is_admin: Number(user.is_admin) || 0 };
    const currentLogin = recordLoginAudit(loginUser, request.headers, 'passkey');
    recordLoginAttempt({ user: loginUser, email: loginUser.email, headers: request.headers, method: 'passkey', isSuccess: true });
    try { backfillDefaultsForUser(loginUser.id); } catch (e) { console.error('[backfill]', e); }

    const { token } = createLoginSession(loginUser.id, Number(user.token_version) || 0, request.headers);
    const response = NextResponse.json({ user: formatUser(user), currentLogin });
    return setAuthCookie(response, token);
  } catch (e) {
    const message = e instanceof Error ? e.message : '未知錯誤';
    console.error('Passkey 驗證失敗:', message);
    recordLoginAttempt({ user: { id: String(user.id), email: String(user.email || ''), is_admin: Number(user.is_admin) || 0 }, email: String(user.email || ''), headers: request.headers, method: 'passkey', isSuccess: false, failureReason: 'verification_failed' });
    return NextResponse.json({ error: 'Passkey 驗證失敗：' + message }, { status: 401 });
  }
}
