// app/api/user/api-tokens/[id]/route.ts — 撤銷指定的 API Token（issue #258）
// 撤銷為不可逆操作：列不會被刪除，以便稽核與後續追蹤仍可查。
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { auditSensitiveAction } from '../../../../../lib/auditHelpers';
import { revokeApiToken, listApiTokens, serializeApiToken } from '../../../../../lib/apiTokenAuth';

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const target = listApiTokens(auth.userId).find((t) => t.id === id);
  const revoked = revokeApiToken(auth.userId, id);
  if (!revoked) {
    return NextResponse.json({ error: '找不到此 API Token' }, { status: 404 });
  }

  auditSensitiveAction(request, auth, {
    action: 'api_token_revoke',
    metadata: {
      api_token_id: id,
      api_token_name: target?.name || '',
      api_token_scopes: (target?.scopes || []).join(' '),
    },
  });
  return NextResponse.json({
    success: true,
    token: target ? serializeApiToken({ ...target, status: 'revoked' }) : undefined,
  });
}
