// app/api/mcp/route.ts — MCP Streamable HTTP 端點（無狀態模式）
// 驗證採 Authorization: Bearer <PAT 或 OAuth access token>，不接受 authToken Cookie；
// middleware.ts 的 PUBLIC_PATHS 已將此路徑列入，略過 Cookie 閘門，驗證完全由本路由負責。
import { NextRequest, NextResponse } from 'next/server';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { verifyMcpToken } from '../../../lib/mcpAuth';
import { verifyMcpOAuthAccessToken } from '../../../lib/mcpOAuth';
import { getMcpOAuthUrls, isMcpHttpOriginAllowed, MCP_OAUTH_SCOPE } from '../../../lib/mcpOAuthCore';
import { OpenAiCompatibleMcpTransport } from '../../../lib/mcpOpenAiCompatibility';
import { buildMcpServer } from '../../../lib/mcpServer';
import type { VerifyMcpTokenResult } from '../../../lib/mcpAuth';

const MCP_CORS_HEADERS = {
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, MCP-Session-Id',
};

function mcpCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get('origin');
  return {
    ...MCP_CORS_HEADERS,
    ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}),
  };
}

function invalidOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  let serverOrigin = request.nextUrl.origin;
  try {
    serverOrigin = getMcpOAuthUrls({ headers: request.headers, requestOrigin: request.nextUrl.origin }).origin;
  } catch {
    // OAuth is disabled until APP_URL is configured, but PAT clients must remain usable.
  }
  if (isMcpHttpOriginAllowed(origin, serverOrigin)) return null;
  return NextResponse.json(
    { error: 'Request Origin is not allowed' },
    { status: 403, headers: { 'Cache-Control': 'no-store', Vary: 'Origin' } }
  );
}

function withMcpCors(response: Response, request: NextRequest): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(mcpCorsHeaders(request))) headers.set(name, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function unauthorized(request: NextRequest, invalidToken = false): NextResponse {
  let resourceMetadata: string | null = null;
  try {
    resourceMetadata = getMcpOAuthUrls({
      headers: request.headers,
      requestOrigin: request.nextUrl.origin,
    }).protectedResourceMetadata;
  } catch {
    // Preserve PAT-only deployments; OAuth discovery becomes available after APP_URL is set.
  }
  const challengeParameters = [
    ...(resourceMetadata ? [`resource_metadata="${resourceMetadata}"`] : []),
    `scope="${MCP_OAUTH_SCOPE}"`,
    ...(invalidToken
      ? [
          'error="invalid_token"',
          'error_description="The access token is invalid, expired, or revoked"',
        ]
      : []),
  ];
  const challenge = `Bearer ${challengeParameters.join(', ')}`;
  return NextResponse.json(
    { error: 'MCP 存取權杖缺漏、格式錯誤、已撤銷、已過期，或所屬帳號已刪除' },
    {
      status: 401,
      headers: {
        ...mcpCorsHeaders(request),
        'WWW-Authenticate': challenge,
        'Cache-Control': 'no-store',
      },
    }
  );
}

function authenticate(request: NextRequest): VerifyMcpTokenResult | NextResponse {
  const authHeader = request.headers.get('authorization') || '';
  const bearerMatch = authHeader.match(/^Bearer[ \t]+([^ \t,]+)[ \t]*$/i);
  if (!bearerMatch) return unauthorized(request, Boolean(authHeader));
  const token = bearerMatch[1];

  if (!token.startsWith('ap_mcp_oauth_access_')) {
    return verifyMcpToken(token) || unauthorized(request, true);
  }
  let resource: string;
  try {
    resource = getMcpOAuthUrls({
      headers: request.headers,
      requestOrigin: request.nextUrl.origin,
    }).resource;
  } catch {
    return unauthorized(request, true);
  }
  const credential = verifyMcpOAuthAccessToken(token, resource);
  return credential || unauthorized(request, true);
}

export async function POST(request: NextRequest): Promise<Response> {
  const originError = invalidOrigin(request);
  if (originError) return originError;
  const credential = authenticate(request);
  if (credential instanceof NextResponse) return credential;

  // 每請求獨立的 transport/server 實例（stateless 模式，不在記憶體保留任何 session）。
  const server = buildMcpServer(credential);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(new OpenAiCompatibleMcpTransport(transport));
  return withMcpCors(await transport.handleRequest(request), request);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const originError = invalidOrigin(request);
  if (originError) return originError;
  const credential = authenticate(request);
  if (credential instanceof NextResponse) return credential;
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405, headers: mcpCorsHeaders(request) });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const originError = invalidOrigin(request);
  if (originError) return originError;
  const credential = authenticate(request);
  if (credential instanceof NextResponse) return credential;
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405, headers: mcpCorsHeaders(request) });
}

export async function OPTIONS(request: NextRequest): Promise<NextResponse> {
  const originError = invalidOrigin(request);
  if (originError) return originError;
  return new NextResponse(null, { status: 204, headers: mcpCorsHeaders(request) });
}
