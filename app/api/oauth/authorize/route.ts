import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiHelpers';
import {
  getMcpOAuthClient,
  issueMcpAuthorizationCode,
  validateAuthorizationRequest,
} from '@/lib/mcpOAuth';
import { getMcpOAuthUrls, McpOAuthError, mcpRedirectUriMatches, oauthErrorBody } from '@/lib/mcpOAuthCore';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 這裡刻意回 200 + <meta refresh>，不能回 HTTP 3xx：全站 CSP 有 form-action 'self'
// (next.config.ts)，瀏覽器對「表單送出後的重導」仍會用原表單頁的 form-action 檢查，
// 導致重導回 client 的 redirect_uri（跨網域，如 chatgpt.com）被靜默擋下——使用者點
// 「允許連線」後畫面沒有任何反應。改成先落地一個同源 200 頁面，再由頁面內容自行導頁，
// 就不算「表單導頁」了，不受 form-action 限制。
function redirectWithOAuthResult(
  redirectUri: string,
  values: Record<string, string | undefined>
): NextResponse {
  const target = new URL(redirectUri);
  for (const [key, value] of Object.entries(values)) {
    if (value) target.searchParams.set(key, value);
  }
  const safeHref = escapeHtml(target.href);
  const html = `<!doctype html>
<html lang="zh-TW">
<head>
<meta charset="utf-8" />
<meta http-equiv="refresh" content="0;url=${safeHref}" />
<title>正在返回…</title>
</head>
<body>
<p>正在返回 MCP client，如果沒有自動跳轉，請點擊<a href="${safeHref}">這裡繼續</a>。</p>
</body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const form = await request.formData();
  const clientId = String(form.get('client_id') || '');
  const redirectUri = String(form.get('redirect_uri') || '');
  const state = String(form.get('state') || '') || undefined;

  let client;
  try {
    client = await getMcpOAuthClient(clientId);
  } catch (error) {
    const status = error instanceof McpOAuthError ? error.status : 500;
    return NextResponse.json(oauthErrorBody(error), { status, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!client || !client.redirect_uris.some((registered) => mcpRedirectUriMatches(redirectUri, registered))) {
    const error = new McpOAuthError('invalid_client', 'Unknown client_id or unregistered redirect_uri');
    return NextResponse.json(oauthErrorBody(error), { status: error.status, headers: { 'Cache-Control': 'no-store' } });
  }

  let issuer: string | undefined;
  try {
    const urls = getMcpOAuthUrls({ headers: request.headers, requestOrigin: request.nextUrl.origin });
    issuer = urls.issuer;
    const authorization = validateAuthorizationRequest({
      client,
      responseType: String(form.get('response_type') || ''),
      redirectUri,
      codeChallenge: String(form.get('code_challenge') || ''),
      codeChallengeMethod: String(form.get('code_challenge_method') || ''),
      scope: String(form.get('scope') || ''),
      resource: String(form.get('resource') || ''),
      expectedResource: urls.resource,
    });

    if (form.get('decision') !== 'allow') {
      return redirectWithOAuthResult(authorization.redirectUri, {
        error: 'access_denied',
        error_description: 'The resource owner denied the authorization request',
        state,
        iss: issuer,
      });
    }

    const code = issueMcpAuthorizationCode({
      userId: auth.userId,
      client,
      redirectUri: authorization.redirectUri,
      codeChallenge: authorization.codeChallenge,
      scopes: authorization.scopes,
      resource: authorization.resource,
    });
    return redirectWithOAuthResult(authorization.redirectUri, { code, state, iss: issuer });
  } catch (error) {
    const body = oauthErrorBody(error);
    return redirectWithOAuthResult(redirectUri, {
      error: body.error,
      error_description: body.error_description,
      state,
      iss: issuer,
    });
  }
}
