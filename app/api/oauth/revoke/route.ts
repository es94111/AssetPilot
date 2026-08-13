import { NextRequest, NextResponse } from 'next/server';
import { McpOAuthError, getMcpOAuthUrls, oauthErrorBody } from '@/lib/mcpOAuthCore';
import {
  getMcpOAuthClient,
  parseMcpOAuthClientCredentials,
  revokeMcpOAuthToken,
  verifyMcpOAuthClientAuthentication,
} from '@/lib/mcpOAuth';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function singleParam(form: URLSearchParams, name: string, required = true): string | undefined {
  const values = form.getAll(name);
  if (values.length > 1) throw new McpOAuthError('invalid_request', `${name} must not be repeated`);
  if (required && !values[0]) throw new McpOAuthError('invalid_request', `${name} is required`);
  return values[0] || undefined;
}

export async function POST(request: NextRequest) {
  try {
    if (!request.headers.get('content-type')?.toLowerCase().includes('application/x-www-form-urlencoded')) {
      throw new McpOAuthError('invalid_request', 'Content-Type must be application/x-www-form-urlencoded');
    }
    const form = new URLSearchParams(await request.text());
    for (const name of ['client_id', 'client_secret', 'client_assertion_type', 'client_assertion', 'token']) {
      singleParam(form, name, false);
    }
    const urls = getMcpOAuthUrls({ headers: request.headers, requestOrigin: request.nextUrl.origin });
    const credentials = parseMcpOAuthClientCredentials(
      request.headers.get('authorization'),
      singleParam(form, 'client_id', false),
      singleParam(form, 'client_secret', false),
      singleParam(form, 'client_assertion_type', false),
      singleParam(form, 'client_assertion', false)
    );
    const token = singleParam(form, 'token')!;
    const client = await getMcpOAuthClient(credentials.clientId);
    if (!client) throw new McpOAuthError('invalid_client', 'Unknown client_id', 401);
    if (!(await verifyMcpOAuthClientAuthentication(client, credentials, urls.revocationEndpoint))) {
      throw new McpOAuthError('invalid_client', 'Client authentication failed', 401);
    }
    revokeMcpOAuthToken(client, token);
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
  } catch (error) {
    const status = error instanceof McpOAuthError ? error.status : 500;
    return NextResponse.json(oauthErrorBody(error), { status, headers: CORS_HEADERS });
  }
}
