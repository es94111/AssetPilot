import { NextResponse } from 'next/server';
import { server as webauthnServer } from '@passwordless-id/webauthn';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../../lib/db';
import { consumePasskeyChallenge } from '@/lib/passkeyChallenge';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request) {
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
    const origin = request.headers.get('origin') || (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000');
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
    return NextResponse.json({ error: 'Passkey 註冊驗證失敗：' + e.message }, { status: 400 });
  }
}
