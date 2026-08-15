// app/api/user/mcp-credentials/[id]/route.ts — 使用者自助撤銷指定 MCP 存取憑證／切換其寫入權限
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { revokeMcpCredential, setMcpCredentialAllowCreate, setMcpCredentialAllowUpdateNote, listMcpCredentials, serializeCredential } from '../../../../../lib/mcpAuth';

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

// 開啟或關閉此 PAT 憑證的寫入權限（允許新增資料／允許更新備註），兩者彼此獨立，可分別開關；
// 未提供的權限維持原狀不動（003 FR-007、004 FR-005／FR-007）。兩欄位皆選填，但至少擇一。
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { allowCreate?: unknown; allowUpdateNote?: unknown };
  const hasCreate = 'allowCreate' in body;
  const hasUpdateNote = 'allowUpdateNote' in body;
  if (!hasCreate && !hasUpdateNote) {
    return NextResponse.json({ error: '必須提供 allowCreate 或 allowUpdateNote 其中之一' }, { status: 400 });
  }
  if (hasCreate && typeof body.allowCreate !== 'boolean') {
    return NextResponse.json({ error: 'allowCreate 必須為布林值' }, { status: 400 });
  }
  if (hasUpdateNote && typeof body.allowUpdateNote !== 'boolean') {
    return NextResponse.json({ error: 'allowUpdateNote 必須為布林值' }, { status: 400 });
  }

  if (hasCreate) {
    const updated = setMcpCredentialAllowCreate(auth.userId, id, body.allowCreate as boolean);
    if (!updated) {
      return NextResponse.json({ error: '找不到此憑證' }, { status: 404 });
    }
  }
  if (hasUpdateNote) {
    const updated = setMcpCredentialAllowUpdateNote(auth.userId, id, body.allowUpdateNote as boolean);
    if (!updated) {
      return NextResponse.json({ error: '找不到此憑證' }, { status: 404 });
    }
  }

  const credential = listMcpCredentials(auth.userId).find((c) => c.id === id);
  if (!credential) {
    return NextResponse.json({ error: '找不到此憑證' }, { status: 404 });
  }
  return NextResponse.json({ credential: serializeCredential(credential) });
}
