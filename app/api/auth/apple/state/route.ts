import { NextResponse } from 'next/server';
import { issueAppleOAuthState } from '@/lib/appleOAuthState';
import { requireAuth } from '../../../../../lib/apiHelpers';

const APPLE_OAUTH_TXN_COOKIE = 'apple_oauth_txn';
const APPLE_OAUTH_TXN_MAX_AGE_SEC = 600;

/**
 * 發出 Apple 登入所需的 state、bindingToken 與 nonce。
 *
 * - `state`：單次使用的流程識別。
 * - `bindingToken`：綁定發起流程的 client，換取 session 時必須再次出示。
 * - `nonce`：必須嵌入 Apple 身分令牌，伺服器端驗證時比對。
 *
 * 手機 App 的 HTTP client 與系統瀏覽器不共用 cookie jar，因此以 JSON 回傳；
 * 瀏覽器流程則同時寫入 httpOnly cookie。
 *
 * `flow=link` 用於「已登入後把 Apple 身分綁到現有帳號」；此時必須驗證登入，
 * 並把 state 綁定到該使用者，避免別人的 state 被轉送到此處。
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const flow = url.searchParams.get('flow') === 'link' ? 'link' : 'login';

  let userId: string | undefined;
  if (flow === 'link') {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    userId = auth.userId;
  }

  const { state, bindingToken, nonce } = issueAppleOAuthState(flow, { userId });
  const response = NextResponse.json({ state, bindingToken, nonce });
  response.headers.set('Cache-Control', 'no-store');
  response.cookies.set(APPLE_OAUTH_TXN_COOKIE, bindingToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: APPLE_OAUTH_TXN_MAX_AGE_SEC,
  });
  return response;
}
