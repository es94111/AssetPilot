import { NextResponse } from 'next/server';
import { server as webauthnServer } from '@passwordless-id/webauthn';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../../lib/db';
import { consumePasskeyChallenge } from '@/lib/passkeyChallenge';
import { resolvePasskeyExpectedOrigin } from '@/lib/originPolicy';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const { registration, challengeKey, deviceName } = body;
  if (!registration || !challengeKey) return NextResponse.json({ error: '缺少註冊資料' }, { status: 400 });

  const entry = consumePasskeyChallenge(challengeKey);
  if (!entry) return NextResponse.json({ error: 'Challenge 已過期或無效，請重試' }, { status: 400 });
  if (entry.userId !== null && entry.userId !== auth.userId) {
    return NextResponse.json({ error: 'Challenge 不匹配' }, { status: 400 });
  }

  try {
    // WebAuthn 的 origin 綁定必須比對伺服器端信任清單，不可直接採用請求自帶的
    // Origin 標頭（等同自我比對，永遠通過，失去 origin 綁定應有的防護）。
    const { origin } = resolvePasskeyExpectedOrigin(
      request.headers.get('origin'),
    );
    if (!origin) {
      return NextResponse.json({ error: '伺服器未設定允許的網域（ALLOWED_ORIGINS），無法驗證 Passkey' }, { status: 500 });
    }
    const expected = { challenge: entry.challenge, origin, userVerified: true };
    const result = await webauthnServer.verifyRegistration(registration, expected);

    const existing = queryOne('SELECT credential_id FROM passkey_credentials WHERE credential_id = ?', [result.credential.id]);
    if (existing) return NextResponse.json({ error: '此 Passkey 已註冊過' }, { status: 400 });

    getDB().run(
      'INSERT INTO passkey_credentials (credential_id, user_id, public_key, algorithm, transports, counter, device_name, created_at) VALUES (?,?,?,?,?,?,?,?)',
      [result.credential.id, auth.userId, result.credential.publicKey, result.credential.algorithm, JSON.stringify(result.credential.transports || []), 0, String(deviceName || '').trim() || 'Passkey', todayStr()]
    );
    saveDB();
    return NextResponse.json({ success: true, id: result.credential.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : '未知錯誤';
    return NextResponse.json({ error: 'Passkey 註冊驗證失敗：' + message }, { status: 400 });
  }
}
