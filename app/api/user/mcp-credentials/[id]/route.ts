// app/api/user/mcp-credentials/[id]/route.ts — 使用者自助撤銷指定 MCP 存取憑證／切換其新增資料權限
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { revokeMcpCredential, setMcpCredentialAllowCreate, listMcpCredentials, serializeCredential } from '../../../../../lib/mcpAuth';

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

// 開啟或關閉此 PAT 憑證的「允許新增資料」權限（003-mcp-write-no-delete FR-007）。
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { allowCreate?: unknown };
  if (typeof body.allowCreate !== 'boolean') {
    return NextResponse.json({ error: 'allowCreate 必須為布林值' }, { status: 400 });
  }

  const updated = setMcpCredentialAllowCreate(auth.userId, id, body.allowCreate);
  if (!updated) {
    return NextResponse.json({ error: '找不到此憑證' }, { status: 404 });
  }

  const credential = listMcpCredentials(auth.userId).find((c) => c.id === id);
  if (!credential) {
    return NextResponse.json({ error: '找不到此憑證' }, { status: 404 });
  }
  return NextResponse.json({ credential: serializeCredential(credential) });
}
