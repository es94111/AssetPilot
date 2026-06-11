import { NextResponse, type NextRequest } from 'next/server';
import { queryOne } from '../../../../../lib/db';
import { setAuthCookie, formatUser } from '../../../../../lib/apiHelpers';
import { consumeAppAuthTicket } from '../../../../../lib/appAuthTicket';
import { createLoginSession } from '../../../../../lib/sessionHelpers';
import { recordLoginAudit, recordLoginAttempt } from '../../../../../lib/loginHelpers';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const userId = consumeAppAuthTicket(body.ticket);
  if (!userId) {
    return NextResponse.json({ error: 'App 登入憑證已過期或無效' }, { status: 401 });
  }

  const user = queryOne('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) return NextResponse.json({ error: '使用者不存在' }, { status: 401 });

  const loginUser = { id: String(user.id), email: String(user.email || ''), is_admin: Number(user.is_admin) || 0 };
  const currentLogin = recordLoginAudit(loginUser, request.headers, 'passkey');
  recordLoginAttempt({ user: loginUser, email: loginUser.email, headers: request.headers, method: 'passkey', isSuccess: true });

  const { token } = createLoginSession(loginUser.id, Number(user.token_version) || 0, request.headers);
  const response = NextResponse.json({ user: formatUser(user), currentLogin });
  return setAuthCookie(response, token);
}
