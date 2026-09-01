import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { issueAppAuthTicket } from '../../../../lib/appAuthTicket';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  // deviceNonce originates from the native app (see mobile/lib/passkey_auth.dart)
  // and is forwarded by this page's own client-side call; binds the ticket to
  // the app instance that started the handoff (AUTHZ-VULN-07).
  const deviceNonce = request.nextUrl.searchParams.get('deviceNonce') || undefined;
  const ticket = issueAppAuthTicket(auth.userId, deviceNonce);
  return NextResponse.json({ ticket });
}
