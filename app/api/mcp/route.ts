// app/api/mcp/route.ts — MCP Streamable HTTP 端點（無狀態模式）
// 驗證採 Authorization: Bearer <PAT>，不接受 authToken Cookie（見 research.md 第 3 節）；
// middleware.ts 的 PUBLIC_PATHS 已將此路徑列入，略過 Cookie 閘門，驗證完全由本路由負責。
import { NextRequest, NextResponse } from 'next/server';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { verifyMcpToken } from '../../../lib/mcpAuth';
import { buildMcpServer } from '../../../lib/mcpServer';

function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'MCP 存取權杖缺漏、格式錯誤、已撤銷、已過期，或所屬帳號已刪除' }, { status: 401 });
}

export async function POST(request: NextRequest): Promise<Response> {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return unauthorized();
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) return unauthorized();

  const credential = verifyMcpToken(token);
  if (!credential) return unauthorized();

  // 每請求獨立的 transport/server 實例（stateless 模式，不在記憶體保留任何 session）。
  const server = buildMcpServer(credential);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}

export async function DELETE(): Promise<NextResponse> {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
