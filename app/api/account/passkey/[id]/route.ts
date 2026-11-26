import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../../lib/db';

type RouteContext = { params: Promise<{ id: string }> };

import { LAST_LOGIN_METHOD_ERROR, removeAccountLoginMethod } from "../../../../../lib/accountLoginMethods";

export async function DELETE(request: Request, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const result = removeAccountLoginMethod(auth.userId, { provider: "passkey", credentialId: id });
  if (result === "missing") {
    return NextResponse.json({ error: "找不到此 Passkey" }, { status: 404 });
  }
  if (result === "last_method") {
    return NextResponse.json({ error: LAST_LOGIN_METHOD_ERROR }, { status: 400 });
  }
  return NextResponse.json({ success: true });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id: credId } = await params;
  const body = await request.json().catch(() => ({}));
  const deviceName = String(body?.deviceName || '').trim();
  if (!deviceName) return NextResponse.json({ error: '請輸入名稱' }, { status: 400 });

  const cred = queryOne('SELECT credential_id FROM passkey_credentials WHERE credential_id = ? AND user_id = ?', [credId, auth.userId]);
  if (!cred) return NextResponse.json({ error: '找不到此 Passkey' }, { status: 404 });

  getDB().run('UPDATE passkey_credentials SET device_name = ? WHERE credential_id = ? AND user_id = ?', [deviceName, credId, auth.userId]);
  saveDB();
  return NextResponse.json({ success: true });
}
