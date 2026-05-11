import { NextResponse, type NextRequest } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { listLoginSessions } from '../../../../lib/sessionHelpers';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json({ sessions: listLoginSessions(auth.userId, auth.sessionId) });
}
