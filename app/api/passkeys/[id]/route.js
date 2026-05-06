import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';

export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;

  const cred = queryOne(
    'SELECT credential_id FROM passkey_credentials WHERE credential_id = ? AND user_id = ?',
    [id, auth.userId]
  );
  if (!cred) return NextResponse.json({ error: '找不到此 Passkey' }, { status: 404 });

  getDB().run(
    'DELETE FROM passkey_credentials WHERE credential_id = ? AND user_id = ?',
    [id, auth.userId]
  );
  saveDB();

  return NextResponse.json({ success: true });
}
