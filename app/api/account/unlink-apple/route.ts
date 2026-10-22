import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';

/**
 * 解除 Apple 登入綁定。
 *
 * 與 unlink-google 相同：必須保留至少一種其他登入方式（Google／LINE／
 * Passkey），避免使用者解除後無法登入。
 */
export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const user = queryOne(
    'SELECT google_id, line_id, apple_id FROM users WHERE id = ?',
    [auth.userId],
  );
  if (!user || !user.apple_id)
    return NextResponse.json(
      { error: '尚未綁定 Apple 帳號' },
      { status: 400 },
    );

  const passkeyCount = Number(
    queryOne(
      'SELECT COUNT(1) AS count FROM passkey_credentials WHERE user_id = ?',
      [auth.userId],
    )?.count || 0,
  );
  if (!user.google_id && !user.line_id && passkeyCount === 0) {
    return NextResponse.json(
      {
        error:
          '至少保留一種其他登入方式（Google、LINE 或 Passkey）後才可解除 Apple 綁定',
      },
      { status: 400 },
    );
  }

  getDB().run("UPDATE users SET apple_id = '' WHERE id = ?", [auth.userId]);
  saveDB();
  return NextResponse.json({ success: true });
}
