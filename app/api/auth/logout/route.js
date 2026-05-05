import { NextResponse } from 'next/server';
import { verifyToken } from '../../../../lib/auth';
import { getDB, saveDB } from '../../../../lib/db';
import { clearAuthCookie } from '../../../../lib/apiHelpers';

export async function POST(request) {
  try {
    const token = request.cookies.get('authToken')?.value;
    if (token) {
      const decoded = verifyToken(token, { ignoreExpiration: true });
      if (decoded?.userId) {
        getDB().run('UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = ?', [decoded.userId]);
        saveDB();
      }
    }
  } catch (_) {}

  const response = NextResponse.json({ ok: true });
  return clearAuthCookie(response);
}
