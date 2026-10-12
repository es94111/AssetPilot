import { withLedgerWriteAudit } from '../../../lib/ledgerContext';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import { saveDB } from '../../../lib/db';
import { createTag, listTags } from '../../../lib/transactionTags';
import { tagErrorResponse } from '../../../lib/tagApiError';
import { TAG_DEFAULT_COLOR, isValidTagColor, validateTagName } from '../../../lib/transactionTagRules';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(listTags(auth.userId));
}

async function handlePOST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => ({})) as { name?: unknown; color?: unknown };
  const v = validateTagName(body.name);
  if (!v.ok) return NextResponse.json({ error: v.error, code: 'ValidationError', field: 'name' }, { status: 400 });
  const color = body.color == null || body.color === '' ? TAG_DEFAULT_COLOR : body.color;
  if (!isValidTagColor(color)) return NextResponse.json({ error: '顏色格式不正確', code: 'ValidationError', field: 'color' }, { status: 400 });
  try {
    const tag = createTag(auth.userId, v.name, color);
    saveDB();
    return NextResponse.json(tag, { status: 201 });
  } catch (e) {
    return tagErrorResponse(e);
  }
}

export const POST = withLedgerWriteAudit(handlePOST);
