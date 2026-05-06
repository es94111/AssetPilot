import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { queryAll } from '../../../../lib/db';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const rows = queryAll(
    'SELECT credential_id, device_name, created_at FROM passkey_credentials WHERE user_id = ? ORDER BY created_at DESC',
    [auth.userId]
  );
  return NextResponse.json({ passkeys: rows.map(r => ({ id: r.credential_id, deviceName: r.device_name, createdAt: r.created_at })) });
}
