import { withLedgerWriteAudit } from '../../../../lib/ledgerContext';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, saveDB } from '../../../../lib/db';
import { batchChangeTags } from '../../../../lib/transactionTags';
import { tagErrorResponse } from '../../../../lib/tagApiError';
import { dedupeIds } from '../../../../lib/transactionTagRules';

const BATCH_MAX = 500;

async function handlePOST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const body = await request.json().catch(() => ({})) as { ids?: unknown; tagIds?: unknown; action?: unknown };
  const ids = dedupeIds(body.ids);
  if (ids.length === 0) return NextResponse.json({ error: '未選擇任何交易' }, { status: 400 });
  if (ids.length > BATCH_MAX) return NextResponse.json({ error: `單次最多 ${BATCH_MAX} 筆`, code: 'BatchTooLarge' }, { status: 400 });
  if (body.action !== 'add' && body.action !== 'remove') {
    return NextResponse.json({ error: 'action 須為 add 或 remove', code: 'ValidationError', field: 'action' }, { status: 400 });
  }
  const db = getDB();
  try {
    db.run('BEGIN');
    const r = batchChangeTags(auth.userId, ids, body.tagIds, body.action);
    db.run('COMMIT');
    saveDB();
    return NextResponse.json({ ok: true, changed: r.changed, skippedIds: r.skipped });
  } catch (e) {
    try { db.run('ROLLBACK'); } catch { /* ignore */ }
    return tagErrorResponse(e);
  }
}

export const POST = withLedgerWriteAudit(handlePOST);
