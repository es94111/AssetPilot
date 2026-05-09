import { NextResponse } from 'next/server';
import { requireAuth, formatUser } from '../../../../lib/apiHelpers';
import { queryOne } from '../../../../lib/db';

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const user = queryOne(
    'SELECT id, email, display_name, google_id, has_password, avatar_url, theme_mode, is_admin FROM users WHERE id = ?',
    [auth.userId]
  );
  if (!user) return NextResponse.json({ error: '使用者不存在' }, { status: 404 });

  return NextResponse.json({ user: formatUser(user) });
}
