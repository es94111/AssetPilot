import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { issueAppAuthTicket } from '../../../../lib/appAuthTicket';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  // deviceNonce originates from the native app (see mobile/lib/passkey_auth.dart)
  // and is forwarded by this page's own client-side call; binds the ticket to
  // the app instance that started the handoff (AUTHZ-VULN-07).
  // deviceNonce 必填：綁定發起 handoff 的 App 實例（AUTHZ-VULN-07）。缺少時
  // 不得簽發，否則攔截到 ticket 的任一端點皆可將其兌換成工作階段。
  const deviceNonce = request.nextUrl.searchParams.get('deviceNonce') || '';
  if (!deviceNonce) {
    return NextResponse.json({ error: '缺少 deviceNonce，無法建立 App 登入憑證' }, { status: 400 });
  }
  const ticket = issueAppAuthTicket(auth.userId, deviceNonce);
  return NextResponse.json({ ticket });
}
