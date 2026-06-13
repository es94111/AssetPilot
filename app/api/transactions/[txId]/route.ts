import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';
import { normalizeCurrency, convertToTwd, normalizeDate, resolveOverseasFee } from '../../../../lib/accountHelpers';
import { ownsResource, assertOptimisticLock, lockErrorResponse } from '../../../../lib/resourceHelpers';
import { computeTwdAmount } from '../../../../lib/moneyDecimal';
import { insertFeeTransaction } from '../../../../lib/overseasFee';
import { deleteTransactionAttachments, listTransactionAttachments } from '../../../../lib/transactionAttachments';

type RouteContext = { params: Promise<{ txId: string }> };
interface Auth {
  userId: string;
  userTimezone: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  themeMode: string;
}

interface TransactionRow {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  currency: string | null;
  original_amount: number | null;
  fx_rate: string | number | null;
  fx_fee: number | null;
  twd_amount: number | null;
  date: string;
  category_id: string | null;
  account_id: string | null;
  to_account_id: string | null;
  note: string | null;
  exclude_from_stats: number | null;
  is_fx_fee: number | null;
  linked_id: string | null;
  source_recurring_id: string | null;
  scheduled_date: string | null;
  created_at: string | number | null;
  updated_at: string | number | null;
}

interface UpdateTransactionRequest {
  expectedUpdatedAt?: number | string | null;
  expected_updated_at?: number | string | null;
  type?: string;
  amount?: number | string;
  originalAmount?: number | string;
  currency?: string;
  fxRate?: number | string | null;
  fxFee?: number | string | null;
  date?: string | null;
  categoryId?: string | null;
  accountId?: string | null;
  note?: string | null;
  excludeFromStats?: boolean;
}

interface DeleteTransactionRequest {
  expectedUpdatedAt?: number | string | null;
  expected_updated_at?: number | string | null;
}

const TRANSACTION_TYPES = new Set(['income', 'expense', 'transfer_in', 'transfer_out']);

function asRow<T>(row: Record<string, string | number | null> | null): T | null {
  return row as unknown as T | null;
}

function getOwnedTransaction(txId: string, userId: string): TransactionRow | null {
  return ownsResource('transactions', 'id', txId, userId) as TransactionRow | null;
}

export async function GET(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { txId } = await params;
  const t = getOwnedTransaction(txId, auth.userId);
  if (!t) return NextResponse.json({ error: 'NotFound' }, { status: 404 });

  let sourceRecurringName: string | null = null;
  if (t.source_recurring_id) {
    const r = asRow<{ source_recurring_name: string | null }>(queryOne(
      "SELECT COALESCE(NULLIF(note, ''), '（未命名配方）') AS source_recurring_name FROM recurring WHERE id = ? AND user_id = ?",
      [t.source_recurring_id, auth.userId]
    ));
    sourceRecurringName = r ? r.source_recurring_name : null;
  }

  return NextResponse.json({
    id: t.id,
    accountId: t.account_id,
    toAccountId: t.to_account_id || null,
    type: t.type,
    amount: t.amount,
    currency: normalizeCurrency(t.currency),
    originalAmount: t.original_amount,
    fxRate: t.fx_rate,
    fxFee: t.fx_fee,
    twdAmount: t.twd_amount,
    date: t.date,
    categoryId: t.category_id,
    note: t.note || '',
    excludeFromStats: t.exclude_from_stats === 1,
    isFxFee: t.is_fx_fee === 1,
    linkedId: t.linked_id || '',
    sourceRecurringId: t.source_recurring_id || null,
    sourceRecurringName,
    scheduledDate: t.scheduled_date || null,
    createdAt: t.created_at,
    updatedAt: Number(t.updated_at) || 0,
    attachments: listTransactionAttachments(auth.userId, txId).map((item) => ({
      id: item.id,
      filename: item.filename,
      mimeType: item.mime_type,
      byteSize: Number(item.byte_size) || 0,
      storage: item.storage,
      createdAt: Number(item.created_at) || 0,
      url: `/api/transactions/${txId}/attachments/${item.id}/file`,
    })),
  });
}

async function updateHandler(request: NextRequest, txId: string, auth: Auth) {
  const existing = getOwnedTransaction(txId, auth.userId);
  if (!existing) return NextResponse.json({ error: '資源不存在或無權限', code: 'NotFound' }, { status: 404 });

  if (existing.is_fx_fee === 1) {
    return NextResponse.json({
      error: '此為自動產生的國外刷卡手續費交易，請改編輯對應的國外交易（修改後手續費會自動同步）',
      code: 'FxFeeImmutable',
    }, { status: 422 });
  }

  const body = await request.json().catch(() => ({})) as UpdateTransactionRequest;

  if (body.expectedUpdatedAt != null || body.expected_updated_at != null) {
    try {
      const expected = body.expectedUpdatedAt ?? body.expected_updated_at;
      assertOptimisticLock('transactions', 'id', txId, expected);
    } catch (e) {
      return lockErrorResponse(e);
    }
  }

  if ((existing.type === 'transfer_in' || existing.type === 'transfer_out') &&
      (body.type != null && body.type !== existing.type)) {
    return NextResponse.json({
      error: '轉帳交易僅能整對刪除，無法逐筆變更類型（請改用刪除後重建）',
      code: 'TransferImmutable',
    }, { status: 422 });
  }

  const { type, amount, categoryId, accountId, note, excludeFromStats } = body;
  const date = normalizeDate(body.date);
  if (!date) return NextResponse.json({ error: '日期格式無效' }, { status: 400 });
  if (!type || !TRANSACTION_TYPES.has(type)) {
    return NextResponse.json({ error: '交易類型無效' }, { status: 400 });
  }

  if (categoryId) {
    const catOwned = queryOne('SELECT id FROM categories WHERE id = ? AND user_id = ?', [categoryId, auth.userId]);
    if (!catOwned) return NextResponse.json({ error: '分類不存在或無權限' }, { status: 400 });
    const catRow = asRow<{ parent_id: string | null }>(queryOne('SELECT parent_id FROM categories WHERE id = ? AND user_id = ?', [categoryId, auth.userId]));
    if (catRow && !catRow.parent_id) {
      return NextResponse.json({ error: '交易必須指派至子分類，不能直接掛在父分類底下' }, { status: 400 });
    }
  }
  if (accountId) {
    const accOwned = queryOne('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [accountId, auth.userId]);
    if (!accOwned) return NextResponse.json({ error: '帳戶不存在或無權限' }, { status: 400 });
  }

  const numAmt = Number(body.originalAmount ?? amount);
  if (!Number.isFinite(numAmt) || numAmt <= 0) {
    return NextResponse.json({ error: '金額必須大於 0', code: 'ValidationError', field: 'amount' }, { status: 400 });
  }

  let converted;
  try {
    converted = convertToTwd(Number(body.originalAmount ?? amount), body.currency || 'TWD', body.fxRate, auth.userId);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '金額格式錯誤' }, { status: 400 });
  }

  // 手續費另存為獨立交易，故原交易 twd_amount 不含手續費（fx_fee=0）。
  const fxFee = resolveOverseasFee({
    userId: auth.userId,
    accountId: accountId || null,
    currency: converted.currency,
    twdBase: converted.twdAmount,
    clientFxFee: body.fxFee,
  });
  const twdAmountInt = computeTwdAmount(
    Math.round(converted.originalAmount * 100) / 100,
    converted.fxRate,
    0
  );

  const nowMs = Date.now();
  const db = getDB();
  db.run(
    'UPDATE transactions SET type=?, amount=?, currency=?, original_amount=?, fx_rate=?, fx_fee=?, twd_amount=?, date=?, category_id=?, account_id=?, note=?, exclude_from_stats=?, updated_at=? WHERE id=? AND user_id=?',
    [type, twdAmountInt, converted.currency, converted.originalAmount, converted.fxRate, 0, twdAmountInt, date, categoryId || null, accountId || null, note || '', excludeFromStats ? 1 : 0, nowMs, txId, auth.userId]
  );

  // 同步配對的手續費獨立交易：依新狀態建立／更新／刪除（自動同步重算）。
  const existingFeeId = existing.linked_id || '';
  if (type === 'expense' && fxFee > 0) {
    if (existingFeeId) {
      db.run(
        'UPDATE transactions SET amount=?, original_amount=?, twd_amount=?, date=?, category_id=?, account_id=?, exclude_from_stats=?, updated_at=? WHERE id=? AND user_id=? AND is_fx_fee=1',
        [fxFee, fxFee, fxFee, date, categoryId || null, accountId || null, excludeFromStats ? 1 : 0, nowMs, existingFeeId, auth.userId]
      );
    } else {
      const feeId = insertFeeTransaction(db, {
        userId: auth.userId, mainId: txId, feeAmount: fxFee, date,
        categoryId, accountId, excludeFromStats,
      });
      db.run('UPDATE transactions SET linked_id = ? WHERE id = ? AND user_id = ?', [feeId, txId, auth.userId]);
    }
  } else if (existingFeeId) {
    db.run('DELETE FROM transactions WHERE id = ? AND user_id = ? AND is_fx_fee = 1', [existingFeeId, auth.userId]);
    db.run("UPDATE transactions SET linked_id = '' WHERE id = ? AND user_id = ?", [txId, auth.userId]);
  }

  saveDB();
  return NextResponse.json({ ok: true, fxFee, updatedAt: nowMs });
}

export async function PUT(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { txId } = await params;
  return updateHandler(request, txId, auth);
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { txId } = await params;
  return updateHandler(request, txId, auth);
}

export async function DELETE(request: NextRequest, { params }: RouteContext) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { txId } = await params;
  const tx = getOwnedTransaction(txId, auth.userId);
  if (!tx) return NextResponse.json({ error: 'NotFound' }, { status: 404 });

  let expectedUpdatedAt: number | string | null | undefined;
  try {
    const body = await request.json().catch(() => ({})) as DeleteTransactionRequest;
    expectedUpdatedAt = body?.expectedUpdatedAt ?? body?.expected_updated_at;
  } catch {
    const { searchParams } = new URL(request.url);
    expectedUpdatedAt = searchParams.get('expected_updated_at');
  }

  if (expectedUpdatedAt != null) {
    try {
      assertOptimisticLock('transactions', 'id', txId, expectedUpdatedAt);
    } catch (e) {
      return lockErrorResponse(e);
    }
  }

  const db = getDB();
  await deleteTransactionAttachments(auth.userId, [txId, ...(tx.linked_id ? [tx.linked_id] : [])]);
  db.run('DELETE FROM transactions WHERE id = ? AND user_id = ?', [txId, auth.userId]);
  if (tx.linked_id) {
    db.run('DELETE FROM transactions WHERE id = ? AND user_id = ?', [tx.linked_id, auth.userId]);
  }
  saveDB();
  return NextResponse.json({ ok: true });
}
