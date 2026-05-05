import { NextResponse } from 'next/server';
import { server as webauthnServer } from '@passwordless-id/webauthn';
import { signToken } from '../../../../../lib/auth';
import { getDB, queryOne, saveDB } from '../../../../../lib/db';
import { recordLoginAudit, recordLoginAttempt } from '../../../../../lib/loginHelpers';
import { backfillDefaultsForUser } from '../../../../../lib/userDefaults';
import { formatUser, setAuthCookie } from '../../../../../lib/apiHelpers';
import { consumePasskeyChallenge } from '../challenge/route';

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);

function getTrustedOriginFromRequest(request) {
  const reqOrigin = request.headers.get('origin');
  if (ALLOWED_ORIGINS.length > 0) {
    if (reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin)) return reqOrigin;
    return ALLOWED_ORIGINS[0];
  }
  return reqOrigin || new URL(request.url).origin;
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const { authentication, challengeKey } = body;
  if (!authentication || !challengeKey) {
    return NextResponse.json({ error: '缺少認證資料' }, { status: 400 });
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

  try {
    const credentialKey = {
      id: cred.credential_id,
      publicKey: cred.public_key,
      algorithm: cred.algorithm,
      transports: JSON.parse(cred.transports || '[]'),
    };
    const origin = getTrustedOriginFromRequest(request);
    const result = await webauthnServer.verifyAuthentication(authentication, credentialKey, {
      challenge: entry.challenge,
      origin,
      userVerified: true,
      counter: cred.counter,
    });

    getDB().run('UPDATE passkey_credentials SET counter = ? WHERE credential_id = ?', [result.counter || 0, cred.credential_id]);
    saveDB();

    const currentLogin = recordLoginAudit(user, request.headers, 'passkey');
    recordLoginAttempt({ user, email: user.email, headers: request.headers, method: 'passkey', isSuccess: true });
    try { backfillDefaultsForUser(user.id); } catch (e) { console.error('[backfill]', e); }

    const token = signToken(user.id, Number(user.token_version) || 0);
    const response = NextResponse.json({ user: formatUser(user), currentLogin });
    return setAuthCookie(response, token);
  } catch (e) {
    console.error('Passkey 驗證失敗:', e.message);
    recordLoginAttempt({ user, email: user.email, headers: request.headers, method: 'passkey', isSuccess: false, failureReason: 'verification_failed' });
    return NextResponse.json({ error: 'Passkey 驗證失敗：' + e.message }, { status: 401 });
  }
}
