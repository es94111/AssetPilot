import { NextResponse } from 'next/server';
import { issueLineOAuthState } from '@/lib/lineOAuthState';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const response = NextResponse.json(issueLineOAuthState(url.searchParams.get('flow') || 'login'));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
