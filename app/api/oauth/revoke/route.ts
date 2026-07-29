import { NextRequest, NextResponse } from 'next/server';
import { McpOAuthError, oauthErrorBody } from '@/lib/mcpOAuthCore';
import { getMcpOAuthClient, revokeMcpOAuthToken } from '@/lib/mcpOAuth';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Cache-Control': 'no-store',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    if (!request.headers.get('content-type')?.toLowerCase().includes('application/x-www-form-urlencoded')) {
      throw new McpOAuthError('invalid_request', 'Content-Type must be application/x-www-form-urlencoded');
    }
    if (request.headers.get('authorization')) {
      throw new McpOAuthError('invalid_client', 'This authorization server accepts public clients only', 401);
    }
    const form = new URLSearchParams(await request.text());
    const clientId = form.get('client_id') || '';
    const token = form.get('token') || '';
    if (!clientId || !token) throw new McpOAuthError('invalid_request', 'client_id and token are required');
    const client = await getMcpOAuthClient(clientId);
    if (!client) throw new McpOAuthError('invalid_client', 'Unknown client_id', 401);
    revokeMcpOAuthToken(client, token);
    return new NextResponse(null, { status: 200, headers: CORS_HEADERS });
  } catch (error) {
    const status = error instanceof McpOAuthError ? error.status : 500;
    return NextResponse.json(oauthErrorBody(error), { status, headers: CORS_HEADERS });
  }
}
