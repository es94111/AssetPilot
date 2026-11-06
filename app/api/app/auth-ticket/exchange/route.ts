import { NextResponse, type NextRequest } from 'next/server';
import { queryOne } from '../../../../../lib/db';
import { setAuthCookie, formatUser, isActiveUserFlag } from '../../../../../lib/apiHelpers';
import { consumeAppAuthTicket } from '../../../../../lib/appAuthTicket';
import { createLoginSession } from '../../../../../lib/sessionHelpers';
import { recordLoginAudit, recordLoginAttempt } from '../../../../../lib/loginHelpers';
import { isTrustedBrowserOrigin } from '../../../../../lib/originPolicy';

export async function POST(request: NextRequest) {
  // 僅接受 JSON 內容（阻斷 HTML 表單的 JSON-CSRF 載入；原生 App 亦使用
  // application/json）。攜帶 Origin 時必須符合伺服器信任清單（瀏覽器 CSRF
  // 防護）；原生 App 不送 Origin 標頭，改以 deviceNonce 綁定裝置實例。
  const contentType = String(request.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return NextResponse.json({ error: '不支援的請求格式' }, { status: 415 });
  }
  const requestOrigin = String(request.headers.get('origin') || '').trim();
  if (requestOrigin && !isTrustedBrowserOrigin(request.headers)) {
    return NextResponse.json({ error: '不被信任的請求來源' }, { status: 403 });
  }
  const body = await request.json().catch(() => ({}));
  const userId = consumeAppAuthTicket(body.ticket, body.deviceNonce);
  if (!userId) {
    return NextResponse.json({ error: 'App 登入憑證已過期或無效' }, { status: 401 });
  }

  const user = queryOne('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) return NextResponse.json({ error: '使用者不存在' }, { status: 401 });
  if (!isActiveUserFlag(user.is_active)) {
    return NextResponse.json({ error: '帳號已停用，請聯繫管理員' }, { status: 403 });
  }

  const loginUser = { id: String(user.id), email: String(user.email || ''), is_admin: Number(user.is_admin) || 0 };
  const currentLogin = recordLoginAudit(loginUser, request.headers, 'passkey');
  recordLoginAttempt({ user: loginUser, email: loginUser.email, headers: request.headers, method: 'passkey', isSuccess: true });

  const { token } = createLoginSession(loginUser.id, Number(user.token_version) || 0, request.headers);
  const response = NextResponse.json({ user: formatUser(user), currentLogin });
  return setAuthCookie(response, token);
}
