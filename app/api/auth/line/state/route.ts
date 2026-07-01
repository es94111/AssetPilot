import { NextResponse } from 'next/server';
import { issueLineOAuthState } from '@/lib/lineOAuthState';
import { getTurnstileSiteKey, verifyTurnstileToken } from '../../../../../lib/turnstile';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const flow = url.searchParams.get('flow') === 'link' ? 'link' : 'login';
  let turnstileVerified = false;

  if (flow === 'login' && getTurnstileSiteKey()) {
    const turnstileToken = String(url.searchParams.get('turnstileToken') || '');
    const turnstile = await verifyTurnstileToken(turnstileToken, request.headers, 'login');
    if (!turnstile.ok) {
      return NextResponse.json({ error: turnstile.error || '請先完成真人驗證' }, { status: 403 });
    }
    turnstileVerified = true;
  }

  const response = NextResponse.json(issueLineOAuthState(flow, { turnstileVerified }));
  response.headers.set('Cache-Control', 'no-store');
  return response;
}
