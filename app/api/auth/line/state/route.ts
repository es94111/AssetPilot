import { NextResponse } from 'next/server';
import { issueLineOAuthState } from '@/lib/lineOAuthState';

export async function GET() {
  const response = NextResponse.json(issueLineOAuthState());
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
