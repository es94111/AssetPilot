import { NextRequest, NextResponse } from 'next/server';
import { McpOAuthError, oauthErrorBody } from '@/lib/mcpOAuthCore';
import { registerMcpOAuthClient, serializeRegisteredClient } from '@/lib/mcpOAuth';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};
const MAX_REGISTRATION_BODY_BYTES = 16 * 1024;

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    if (!request.headers.get('content-type')?.toLowerCase().includes('application/json')) {
      throw new McpOAuthError('invalid_client_metadata', 'Content-Type must be application/json');
    }
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, 'utf8') > MAX_REGISTRATION_BODY_BYTES) {
      throw new McpOAuthError('invalid_client_metadata', 'Client registration request is too large');
    }
    const body = (() => {
      try {
        return JSON.parse(rawBody);
      } catch {
        throw new McpOAuthError('invalid_client_metadata', 'Request body must be valid JSON');
      }
    })();
    const client = registerMcpOAuthClient(body);
    return NextResponse.json(serializeRegisteredClient(client), { status: 201, headers: CORS_HEADERS });
  } catch (error) {
    const status = error instanceof McpOAuthError ? error.status : 500;
    return NextResponse.json(oauthErrorBody(error), { status, headers: CORS_HEADERS });
  }
}
