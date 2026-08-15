// app/api/user/mcp-oauth-connections/[clientId]/route.ts — 開關指定已連接 AI 工具的寫入權限
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { setMcpOAuthConnectionAllowCreate, setMcpOAuthConnectionAllowUpdateNote } from '../../../../../lib/mcpOAuth';
import { queryOne } from '../../../../../lib/db';
import { toIsoUtc } from '../../../../../lib/userTime';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ clientId: string }> }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { clientId } = await params;
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
    const updated = setMcpOAuthConnectionAllowCreate(auth.userId, clientId, body.allowCreate as boolean);
    if (!updated) {
      return NextResponse.json({ error: '找不到此連線' }, { status: 404 });
    }
  }
  if (hasUpdateNote) {
    const updated = setMcpOAuthConnectionAllowUpdateNote(auth.userId, clientId, body.allowUpdateNote as boolean);
    if (!updated) {
      return NextResponse.json({ error: '找不到此連線' }, { status: 404 });
    }
  }

  // 直接查表組回應，不透過 listMcpOAuthConnections()——該函式僅回傳「目前仍有效」的連線，
  // 剛更新完的這一列若恰好授權已失效仍應如實回傳最新的 allowCreate／allowUpdateNote，而非誤判為 404。
  const row = queryOne(
    'SELECT client_id, client_name, allow_create, allow_update_note, first_connected_at, last_used_at FROM mcp_oauth_connections WHERE user_id = ? AND client_id = ?',
    [auth.userId, clientId]
  );
  if (!row) {
    return NextResponse.json({ error: '找不到此連線' }, { status: 404 });
  }
  return NextResponse.json({
    connection: {
      clientId: String(row.client_id),
      clientName: String(row.client_name),
      allowCreate: Number(row.allow_create) === 1,
      allowUpdateNote: Number(row.allow_update_note) === 1,
      firstConnectedAt: toIsoUtc(Number(row.first_connected_at)),
      lastUsedAt: toIsoUtc(Number(row.last_used_at)),
    },
  });
}
