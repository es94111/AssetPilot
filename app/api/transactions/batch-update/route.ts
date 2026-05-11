import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';
import { normalizeDate } from '../../../../lib/accountHelpers';

const BATCH_MAX = 500;

interface BatchUpdateFields {
  categoryId?: string | null;
  accountId?: string | null;
  date?: string | null;
}

interface BatchUpdateTransactionsRequest {
  ids?: string[];
  fields?: BatchUpdateFields;
  patch?: BatchUpdateFields;
  expected_updated_at?: Record<string, number | string | null>;
}

interface TransactionLockRow {
  id: string;
  user_id: string;
  updated_at: number | string | null;
}

function asRow<T>(row: Record<string, string | number | null> | null): T | null {
  return row as unknown as T | null;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({})) as BatchUpdateTransactionsRequest;
  const { ids, fields, patch, expected_updated_at: expectedMap } = body || {};
  const updateFields = { ...(patch || fields || {}) };

  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: '未選擇任何交易' }, { status: 400 });
  }
  if (ids.length > BATCH_MAX) {
    return NextResponse.json({ error: `單次最多 ${BATCH_MAX} 筆`, code: 'BatchTooLarge' }, { status: 400 });
  }
  if (!updateFields || Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: '未指定更新欄位' }, { status: 400 });
  }

  if (updateFields.categoryId) {
    const cat = queryOne('SELECT id FROM categories WHERE id = ? AND user_id = ?', [updateFields.categoryId, auth.userId]);
    if (!cat) return NextResponse.json({ error: 'CategoryForeign', message: '分類不存在或無權限' }, { status: 422 });
  }
  if (updateFields.accountId) {
    const acc = queryOne('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [updateFields.accountId, auth.userId]);
    if (!acc) return NextResponse.json({ error: 'AccountForeign', message: '帳戶不存在或無權限' }, { status: 422 });
  }
  if (updateFields.date !== undefined) {
    const normalizedDate = normalizeDate(updateFields.date);
    if (!normalizedDate) return NextResponse.json({ error: '日期格式無效' }, { status: 400 });
    updateFields.date = normalizedDate;
  }

  const rows = ids.map(id => asRow<TransactionLockRow>(queryOne(
    'SELECT id, user_id, updated_at FROM transactions WHERE id = ? AND user_id = ?',
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

  const allowedFields: Record<keyof BatchUpdateFields, string> = { categoryId: 'category_id', accountId: 'account_id', date: 'date' };
  const setClauses: string[] = [];
  const values: Array<string | number | null> = [];
  for (const [key, col] of Object.entries(allowedFields) as Array<[keyof BatchUpdateFields, string]>) {
    if (updateFields[key] !== undefined) {
      setClauses.push(`${col} = ?`);
      values.push(updateFields[key]);
    }
  }
  if (setClauses.length === 0) return NextResponse.json({ error: '無有效更新欄位' }, { status: 400 });
  setClauses.push('updated_at = ?');
  const nowMs = Date.now();
  values.push(nowMs);

  const db = getDB();
  try {
    db.run('BEGIN');
    ids.forEach(id => {
      db.run(`UPDATE transactions SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`, [...values, id, auth.userId]);
    });
    db.run('COMMIT');
  } catch (e) {
    try { db.run('ROLLBACK'); } catch (_) {}
    return NextResponse.json({ error: '批次更新失敗', message: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
  saveDB();
  return NextResponse.json({ affectedIds: ids, affectedCount: ids.length, updated: ids.length, updatedAt: nowMs });
}
