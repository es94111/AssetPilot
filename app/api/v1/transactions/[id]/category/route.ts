import { NextRequest, NextResponse } from 'next/server';
import { getDB, queryOne } from '../../../../../../lib/db';
import {
  jsonNoStore,
  ledgerScopeError,
  readJsonBody,
  readRequestedLedgerId,
  requireApiToken,
} from '../../../../../../lib/apiTokenRequestAuth';
import { resolveLedgerScope } from '../../../../../../lib/ledgerScope';
import { emitTransactionEvent } from '../../../../../../lib/transactionWebhooks';

type CategoryUpdate =
  | { outcome: 'missing' }
  | { outcome: 'invalid' }
  | { outcome: 'conflict' }
  | { outcome: 'unchanged'; updatedAt: number }
  | { outcome: 'updated'; updatedAt: number; row: Record<string, string | number | null> };

function setExpenseCategory(
  userId: string,
  id: string,
  categoryId: string,
  expectedCategoryId: string | null,
): CategoryUpdate {
  const db = getDB();
  db.run('BEGIN');
  try {
    const result = updateLockedExpense();
    db.run('COMMIT');
    return result;
  } catch (error) {
    db.run('ROLLBACK');
    throw error;
  }

  function updateLockedExpense(): CategoryUpdate {
    const row = queryOne(
      `SELECT id, type, amount, currency, date, account_id, category_id, note, linked_id, updated_at
         FROM transactions
        WHERE id = ? AND user_id = ? AND type = 'expense' AND COALESCE(is_fx_fee, 0) = 0
        FOR UPDATE`,
      [id, userId],
    );
    if (!row) return { outcome: 'missing' };

    const category = queryOne(
      `SELECT id FROM categories WHERE id = ? AND user_id = ? AND type = 'expense'
         AND COALESCE(parent_id, '') <> '' FOR SHARE`,
      [categoryId, userId],
    );
    if (!category) return { outcome: 'invalid' };
    const updatedAt = Number(row.updated_at) || 0;
    if (row.category_id === categoryId) return { outcome: 'unchanged', updatedAt };
    if ((row.category_id || null) !== expectedCategoryId) return { outcome: 'conflict' };

    const timestamp = Math.max(Date.now(), updatedAt + 1);
    db.run('UPDATE transactions SET category_id = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      [categoryId, timestamp, id, userId]);
    if (row.linked_id) {
      db.run(
        `UPDATE transactions SET category_id = ?, updated_at = ?
          WHERE id = ? AND user_id = ? AND is_fx_fee = 1 AND linked_id = ?`,
        [categoryId, timestamp, row.linked_id, userId, id],
      );
    }
    return { outcome: 'updated', updatedAt: timestamp, row };
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireApiToken(request, 'transactions:write');
  if (auth instanceof NextResponse) return auth;

  const parsed = await readJsonBody<{ categoryId?: unknown; expectedCategoryId?: unknown; ledgerId?: string }>(request);
  if (!parsed.ok) return parsed.response;
  const { categoryId, expectedCategoryId } = parsed.body;
  if (typeof categoryId !== 'string' || !categoryId.trim()) {
    return jsonNoStore({ error: '請提供支出子分類', code: 'ValidationError', field: 'categoryId' }, { status: 400 });
  }
  if (expectedCategoryId !== null && (typeof expectedCategoryId !== 'string' || !expectedCategoryId.trim())) {
    return jsonNoStore(
      { error: '請提供原分類 ID，無分類時傳入 null', code: 'ValidationError', field: 'expectedCategoryId' },
      { status: 400 },
    );
  }

  const scope = resolveLedgerScope({
    userId: auth.userId,
    ledgerId: readRequestedLedgerId(request, parsed.body),
    write: true,
  });
  if (!scope.ok) return ledgerScopeError(scope.reason);

  const { id } = await params;
  const nextCategoryId = categoryId.trim();
  const result = setExpenseCategory(scope.dataOwnerId, id, nextCategoryId, expectedCategoryId?.trim() ?? null);
  if (result.outcome === 'missing') {
    return jsonNoStore({ error: '找不到可更新的支出交易', code: 'NotFound' }, { status: 404 });
  }
  if (result.outcome === 'invalid') {
    return jsonNoStore({ error: '分類必須是此帳本的支出子分類', code: 'ValidationError', field: 'categoryId' }, { status: 400 });
  }
  if (result.outcome === 'conflict') {
    return jsonNoStore({ error: '交易分類已變更，請先核對目前的分類', code: 'CategoryConflict' }, { status: 409 });
  }
  if (result.outcome === 'updated') {
    emitTransactionEvent(scope.dataOwnerId, 'transaction.updated', { ...result.row, category_id: nextCategoryId });
  }
  return jsonNoStore({ transaction: { id, categoryId: nextCategoryId, updatedAt: result.updatedAt } });
}
