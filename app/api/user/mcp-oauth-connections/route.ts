// app/api/user/mcp-oauth-connections/route.ts — 列出使用者目前已連接的 AI 工具（OAuth client）
// 沿用既有 authToken Cookie + requireAuth() 驗證慣例，比照 app/api/user/mcp-credentials/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { listMcpOAuthConnections } from '../../../../lib/mcpOAuth';
import { toIsoUtc } from '../../../../lib/userTime';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const connections = listMcpOAuthConnections(auth.userId).map((c) => ({
    clientId: c.clientId,
    clientName: c.clientName,
    allowCreate: c.allowCreate,
    firstConnectedAt: toIsoUtc(c.firstConnectedAt),
    lastUsedAt: toIsoUtc(c.lastUsedAt),
  }));
  return NextResponse.json({ connections });
}
