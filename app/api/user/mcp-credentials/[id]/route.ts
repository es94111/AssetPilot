// app/api/user/mcp-credentials/[id]/route.ts — 使用者自助撤銷指定 MCP 存取憑證
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { revokeMcpCredential } from '../../../../../lib/mcpAuth';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const revoked = revokeMcpCredential(auth.userId, id);
  if (!revoked) {
    return NextResponse.json({ error: '找不到此憑證' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
