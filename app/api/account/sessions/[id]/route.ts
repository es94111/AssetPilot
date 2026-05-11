import { NextResponse, type NextRequest } from 'next/server';
import { clearAuthCookie, requireAuth } from '../../../../../lib/apiHelpers';
import { revokeLoginSession } from '../../../../../lib/sessionHelpers';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const isCurrent = String(id || '') === String(auth.sessionId || '');
  revokeLoginSession(auth.userId, String(id || ''));

  const response = NextResponse.json({ ok: true, current: isCurrent });
  return isCurrent ? clearAuthCookie(response) : response;
}
