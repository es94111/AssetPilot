import { withLedgerWriteAudit } from '../../../../lib/ledgerContext';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { saveDB } from '../../../../lib/db';
import { deleteTag, updateTag } from '../../../../lib/transactionTags';
import { tagErrorResponse } from '../../../../lib/tagApiError';
import { isValidTagColor, validateTagName } from '../../../../lib/transactionTagRules';

type RouteContext = { params: Promise<{ id: string }> };

async function handlePATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await request.json().catch(() => ({})) as { name?: unknown; color?: unknown; isActive?: unknown };
  const patch: { name?: string; color?: string; isActive?: boolean } = {};
  if (body.name !== undefined) {
    const v = validateTagName(body.name);
    if (!v.ok) return NextResponse.json({ error: v.error, code: 'ValidationError', field: 'name' }, { status: 400 });
    patch.name = v.name;
  }
  if (body.color !== undefined) {
    if (!isValidTagColor(body.color)) return NextResponse.json({ error: '顏色格式不正確', code: 'ValidationError', field: 'color' }, { status: 400 });
    patch.color = body.color;
  }
  if (body.isActive !== undefined) patch.isActive = !!body.isActive;
  try {
    const tag = updateTag(auth.userId, id, patch);
    saveDB();
    return NextResponse.json(tag);
  } catch (e) {
    return tagErrorResponse(e);
  }
}

async function handleDELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  try {
    const unlinked = deleteTag(auth.userId, id);
    saveDB();
    return NextResponse.json({ ok: true, unlinked });
  } catch (e) {
    return tagErrorResponse(e);
  }
}

export const PATCH = withLedgerWriteAudit(handlePATCH);
export const PUT = withLedgerWriteAudit(handlePATCH);
export const DELETE = withLedgerWriteAudit(handleDELETE);
