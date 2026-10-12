import { NextResponse } from 'next/server';
import { server as webauthnServer } from '@passwordless-id/webauthn';
import type { CredentialInfo } from '@passwordless-id/webauthn';
import { requireAuth } from '@/lib/apiHelpers';
import { getDB, queryOne, saveDB } from '@/lib/db';
import { consumePasskeyChallenge } from '@/lib/passkeyChallenge';
import { resolvePasskeyExpectedOrigin } from '@/lib/originPolicy';
import {
  auditRecovery,
  getRecoveryCodeStatus,
  isRecentLogin,
  regenerateRecoveryCodes,
} from '@/lib/accountRecovery';

const NO_STORE = { 'Cache-Control': 'no-store' };

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(getRecoveryCodeStatus(auth.userId), { headers: NO_STORE });
}

/** 產生／重新產生復原碼。需近期登入，或附上新鮮的 Passkey 驗證（UV）。 */
export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  let reauthed = isRecentLogin(String(auth.sessionId || ''));

  if (!reauthed) {
    const { authentication, challengeKey } = body as { authentication?: { id?: string }; challengeKey?: string };
    if (!authentication || !challengeKey) {
      return NextResponse.json({ error: '需要重新驗證身分', reauthRequired: true }, { status: 403, headers: NO_STORE });
    }
    const entry = consumePasskeyChallenge(String(challengeKey));
    if (!entry || entry.purpose || (entry.userId !== null && entry.userId !== auth.userId)) {
      return NextResponse.json({ error: 'Challenge 已過期或無效，請重試', reauthRequired: true }, { status: 400, headers: NO_STORE });
    }
    const cred = queryOne('SELECT * FROM passkey_credentials WHERE credential_id = ? AND user_id = ?', [
      String(authentication.id || ''),
      auth.userId,
    ]);
    const { origin } = resolvePasskeyExpectedOrigin(request.headers.get('origin'));
    if (!cred || !origin) {
      return NextResponse.json({ error: '重新驗證失敗', reauthRequired: true }, { status: 403, headers: NO_STORE });
    }
    try {
      const credentialKey: CredentialInfo = {
        id: String(cred.credential_id || ''),
        publicKey: String(cred.public_key || ''),
        algorithm: String(cred.algorithm || '') as CredentialInfo['algorithm'],
        transports: JSON.parse(String(cred.transports || '[]')),
      };
      const result = await webauthnServer.verifyAuthentication(authentication as never, credentialKey, {
        challenge: entry.challenge,
        origin,
        userVerified: true,
        counter: Number(cred.counter) || 0,
      });
      getDB().run('UPDATE passkey_credentials SET counter = ? WHERE credential_id = ?', [result.counter || 0, cred.credential_id]);
      saveDB();
      reauthed = true;
    } catch {
      return NextResponse.json({ error: '重新驗證失敗', reauthRequired: true }, { status: 403, headers: NO_STORE });
    }
  }

  const before = getRecoveryCodeStatus(auth.userId);
  const codes = regenerateRecoveryCodes(auth.userId);
  auditRecovery(request.headers, auth.userId, before.generated ? 'recovery_codes_regenerate' : 'recovery_codes_generate', 'success', {
    recovery_code_count: codes.length,
  });
  return NextResponse.json({ codes, ...getRecoveryCodeStatus(auth.userId) }, { headers: NO_STORE });
}
