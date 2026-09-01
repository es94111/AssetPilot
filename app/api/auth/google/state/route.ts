import { NextResponse } from 'next/server';
import { issueGoogleOAuthState } from '@/lib/googleOAuthState';

const GOOGLE_OAUTH_TXN_COOKIE = 'google_oauth_txn';
const GOOGLE_OAUTH_TXN_MAX_AGE_SEC = 600;

export async function GET() {
  const { state, bindingToken } = issueGoogleOAuthState();
  // bindingToken is both set as an httpOnly cookie (consumed automatically by
  // the web login page's same-origin fetch back to /api/auth/google) and
  // returned in the JSON body (consumed explicitly by the mobile app, whose
  // HTTP client and in-app browser do not share a cookie jar). See
  // lib/googleOAuthState.ts for why this binding exists.
  const response = NextResponse.json({ state, bindingToken });
  response.headers.set('Cache-Control', 'no-store');
  response.cookies.set(GOOGLE_OAUTH_TXN_COOKIE, bindingToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: GOOGLE_OAUTH_TXN_MAX_AGE_SEC,
  });
  return response;
}
