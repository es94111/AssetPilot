import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../../lib/db';
import { consumePasskeyChallenge } from '@/lib/passkeyChallenge';
import { INSERT_PASSKEY_SQL, PasskeyOriginUnavailableError, passkeyInsertParams, verifyPasskeyRegistration } from '@/lib/passkeyRegistration';

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
    // WebAuthn 的 origin 綁定必須比對伺服器端信任清單（見 verifyPasskeyRegistration）。
    const credential = await verifyPasskeyRegistration(registration, entry.challenge, request.headers.get('origin'));

    const existing = queryOne('SELECT credential_id FROM passkey_credentials WHERE credential_id = ?', [credential.id]);
    if (existing) return NextResponse.json({ error: '此 Passkey 已註冊過' }, { status: 400 });

    getDB().run(INSERT_PASSKEY_SQL, passkeyInsertParams(auth.userId, credential, deviceName));
    saveDB();
    return NextResponse.json({ success: true, id: credential.id });
  } catch (e) {
    if (e instanceof PasskeyOriginUnavailableError) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
    const message = e instanceof Error ? e.message : '未知錯誤';
    return NextResponse.json({ error: 'Passkey 註冊驗證失敗：' + message }, { status: 400 });
  }
}
