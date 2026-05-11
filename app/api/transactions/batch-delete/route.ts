import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';

const BATCH_MAX = 500;

interface BatchDeleteTransactionsRequest {
  ids?: string[];
  expected_updated_at?: Record<string, number | string | null>;
}

interface BatchDeleteTransactionRow {
  id: string;
  user_id: string;
  linked_id: string | null;
  updated_at: number | string | null;
}

function asRow<T>(row: Record<string, string | number | null> | null): T | null {
  return row as unknown as T | null;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({})) as BatchDeleteTransactionsRequest;
  const { ids, expected_updated_at: expectedMap } = body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: '未選擇任何交易' }, { status: 400 });
  }
  if (ids.length > BATCH_MAX) {
    return NextResponse.json({ error: `單次最多 ${BATCH_MAX} 筆`, code: 'BatchTooLarge' }, { status: 400 });
  }

  const rows = ids.map(id => asRow<BatchDeleteTransactionRow>(queryOne(
    'SELECT id, user_id, linked_id, updated_at FROM transactions WHERE id = ? AND user_id = ?',
    [id, auth.userId]
  )));
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) return NextResponse.json({ error: 'NotFound', missingId: ids[i] }, { status: 404 });
    const expectedRaw = expectedMap?.[ids[i]];
    if (expectedRaw != null) {
      const expected = Number(expectedRaw);
      if (Number(row.updated_at) !== expected) {
        return NextResponse.json({
          error: 'OptimisticLockConflict',
          conflictId: ids[i],
          serverUpdatedAt: Number(row.updated_at),
          message: '此筆已被其他裝置修改，請重新整理後再操作',
        }, { status: 409 });
      }
    }
  }

  const all = new Set(ids);
  rows.forEach(r => { if (r?.linked_id) all.add(r.linked_id); });
  const db = getDB();
  try {
    db.run('BEGIN');
    [...all].forEach(id => db.run('DELETE FROM transactions WHERE id = ? AND user_id = ?', [id, auth.userId]));
    db.run('COMMIT');
  } catch (e) {
    try { db.run('ROLLBACK'); } catch (_) {}
    return NextResponse.json({ error: '批次刪除失敗', message: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
  saveDB();
  return NextResponse.json({ affectedIds: [...all], affectedCount: all.size, deleted: all.size });
}
