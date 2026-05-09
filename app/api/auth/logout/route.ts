import { NextResponse, type NextRequest } from 'next/server';
import { verifyToken } from '../../../../lib/auth';
import { getDB, saveDB } from '../../../../lib/db';
import { clearAuthCookie } from '../../../../lib/apiHelpers';

export async function POST(request: NextRequest) {
  try {
    const token = request.cookies.get('authToken')?.value;
    if (token) {
      const decoded = verifyToken(token, { ignoreExpiration: true });
      const userId = typeof decoded === 'object' && decoded && 'userId' in decoded ? String(decoded.userId || '') : '';
      if (userId) {
        getDB().run('UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = ?', [userId]);
        saveDB();
      }
    }
  } catch (_) {}

  const response = NextResponse.json({ ok: true });
  return clearAuthCookie(response);
}
