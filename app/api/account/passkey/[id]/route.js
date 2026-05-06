import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../../lib/db';

export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id: credId } = await params;
  const cred = queryOne('SELECT credential_id FROM passkey_credentials WHERE credential_id = ? AND user_id = ?', [credId, auth.userId]);
  if (!cred) return NextResponse.json({ error: '找不到此 Passkey' }, { status: 404 });

  getDB().run('DELETE FROM passkey_credentials WHERE credential_id = ? AND user_id = ?', [credId, auth.userId]);
  saveDB();
  return NextResponse.json({ success: true });
}

export async function PUT(request, { params }) {
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
