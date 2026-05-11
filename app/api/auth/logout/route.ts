import { NextResponse, type NextRequest } from 'next/server';
import { clearAuthCookie } from '../../../../lib/apiHelpers';
import { verifyToken } from '../../../../lib/auth';
import { revokeLoginSession } from '../../../../lib/sessionHelpers';

export async function POST(request: NextRequest) {
  const token = request.cookies.get('authToken')?.value || '';
  if (token) {
    try {
      const decoded = verifyToken(token, { ignoreExpiration: true }) as { userId?: string; sessionId?: string };
      if (decoded?.userId && decoded?.sessionId) {
        revokeLoginSession(String(decoded.userId), String(decoded.sessionId));
      }
    } catch {}
  }
  const response = NextResponse.json({ ok: true });
  return clearAuthCookie(response);
}
