import { NextResponse } from 'next/server';
import { getSystemSettings } from '../../../../../lib/loginHelpers';
import { issueLineOAuthState } from '@/lib/lineOAuthState';
import { isAllowedLineRedirectUri, LINE_CHANNEL_ID, LINE_CHANNEL_SECRET } from '../../../../../lib/lineOAuth';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const flow = url.searchParams.get('flow') === 'link' ? 'link' : 'login';
  const disableAutoLogin = url.searchParams.get('disableAutoLogin') === '1';
  const originParam = String(url.searchParams.get('origin') || '').trim();
  const origin = originParam || url.origin;
  let redirectUri = '';

  try {
    const parsedOrigin = new URL(origin);
    redirectUri = `${parsedOrigin.origin}/auth/line/callback`;
  } catch {
    return NextResponse.json({ error: 'invalid_origin' }, { status: 400 });
  }

  if (!getSystemSettings().lineLoginEnabled) {
    return NextResponse.json({ error: 'LINE 登入未啟用' }, { status: 403 });
  }
  if (!LINE_CHANNEL_ID || !LINE_CHANNEL_SECRET) {
    return NextResponse.json({ error: 'LINE 登入未設定' }, { status: 400 });
  }
  if (!isAllowedLineRedirectUri(redirectUri)) {
    return NextResponse.json({ error: 'invalid_redirect_uri' }, { status: 400 });
  }

  const { state, nonce } = issueLineOAuthState(flow);
  const authorizeUrl = new URL('https://access.line.me/oauth2/v2.1/authorize');
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', LINE_CHANNEL_ID);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('scope', 'openid profile email');
  authorizeUrl.searchParams.set('nonce', nonce);
  if (disableAutoLogin) {
    authorizeUrl.searchParams.set('disable_auto_login', 'true');
  }

  return NextResponse.redirect(authorizeUrl);
}
