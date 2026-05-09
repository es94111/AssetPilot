import { NextResponse } from 'next/server';
import { issueGoogleOAuthState } from '@/lib/googleOAuthState';

export async function GET() {
  const response = NextResponse.json({ state: issueGoogleOAuthState() });
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
