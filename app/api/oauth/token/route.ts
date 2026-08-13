import { NextRequest, NextResponse } from 'next/server';
import { McpOAuthError, getMcpOAuthUrls, oauthErrorBody } from '@/lib/mcpOAuthCore';
import {
  exchangeMcpAuthorizationCode,
  exchangeMcpRefreshToken,
  getMcpOAuthClient,
  parseMcpOAuthClientCredentials,
  verifyMcpOAuthClientAuthentication,
} from '@/lib/mcpOAuth';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
  Pragma: 'no-cache',
};

function singleParam(form: URLSearchParams, name: string, required = true): string | undefined {
  const values = form.getAll(name);
  if (values.length > 1) throw new McpOAuthError('invalid_request', `${name} must not be repeated`);
  if (required && !values[0]) throw new McpOAuthError('invalid_request', `${name} is required`);
  return values[0] || undefined;
}

function requiredParam(form: URLSearchParams, name: string): string {
  return singleParam(form, name, true)!;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type')?.toLowerCase() || '';
    if (!contentType.includes('application/x-www-form-urlencoded')) {
      throw new McpOAuthError('invalid_request', 'Content-Type must be application/x-www-form-urlencoded');
    }
    const form = new URLSearchParams(await request.text());
    for (const name of ['client_id', 'client_secret', 'grant_type', 'code', 'code_verifier', 'redirect_uri', 'refresh_token', 'scope', 'resource']) {
      singleParam(form, name, false);
    }
    const credentials = parseMcpOAuthClientCredentials(
      request.headers.get('authorization'),
      singleParam(form, 'client_id', false),
      singleParam(form, 'client_secret', false)
    );
    const client = await getMcpOAuthClient(credentials.clientId);
    if (!client) throw new McpOAuthError('invalid_client', 'Unknown client_id', 401);
    if (!verifyMcpOAuthClientAuthentication(client, credentials)) {
      throw new McpOAuthError('invalid_client', 'Client authentication failed', 401);
    }

    const urls = getMcpOAuthUrls({ headers: request.headers, requestOrigin: request.nextUrl.origin });
    const grantType = requiredParam(form, 'grant_type');
    if (grantType === 'authorization_code') {
      const tokens = exchangeMcpAuthorizationCode({
        client,
        code: requiredParam(form, 'code'),
        codeVerifier: requiredParam(form, 'code_verifier'),
        redirectUri: requiredParam(form, 'redirect_uri'),
        resource: requiredParam(form, 'resource'),
        expectedResource: urls.resource,
      });
      return NextResponse.json(tokens, { headers: CORS_HEADERS });
    }
    if (grantType === 'refresh_token') {
      const tokens = exchangeMcpRefreshToken({
        client,
        refreshToken: requiredParam(form, 'refresh_token'),
        scope: singleParam(form, 'scope', false),
        resource: requiredParam(form, 'resource'),
        expectedResource: urls.resource,
      });
      return NextResponse.json(tokens, { headers: CORS_HEADERS });
    }
    throw new McpOAuthError('unsupported_grant_type', 'Only authorization_code and refresh_token grants are supported');
  } catch (error) {
    const status = error instanceof McpOAuthError ? error.status : 500;
    const headers: Record<string, string> = { ...CORS_HEADERS };
    if (status === 401 && error instanceof McpOAuthError && error.code === 'invalid_client') {
      headers['WWW-Authenticate'] = 'Basic realm="AssetPilot MCP OAuth"';
    }
    return NextResponse.json(oauthErrorBody(error), { status, headers });
  }
}
