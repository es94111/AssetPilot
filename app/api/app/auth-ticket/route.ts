import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { issueAppAuthTicket } from '../../../../lib/appAuthTicket';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const ticket = issueAppAuthTicket(auth.userId);
  return NextResponse.json({ ticket });
}
