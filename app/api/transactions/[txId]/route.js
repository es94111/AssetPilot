import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';
import { normalizeCurrency, convertToTwd, normalizeDate } from '../../../../lib/accountHelpers';
import { ownsResource, assertOptimisticLock, lockErrorResponse } from '../../../../lib/resourceHelpers';
import moneyDecimal from '../../../../lib/moneyDecimal';

export async function GET(request, { params }) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { txId } = await params;
  const t = ownsResource('transactions', 'id', txId, auth.userId);
  if (!t) return NextResponse.json({ error: 'NotFound' }, { status: 404 });

  let sourceRecurringName = null;
  if (t.source_recurring_id) {
    const r = queryOne(
      "SELECT COALESCE(NULLIF(note, ''), '嚗?賢??嚗?) AS source_recurring_name FROM recurring WHERE id = ? AND user_id = ?",
      [t.source_recurring_id, auth.userId]
    );
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
    linkedId: t.linked_id || '',
    sourceRecurringId: t.source_recurring_id || null,
    sourceRecurringName,
    scheduledDate: t.scheduled_date || null,
    createdAt: t.created_at,
    updatedAt: Number(t.updated_at) || 0,
  });
}

async function updateHandler(request, txId, auth) {
  const existing = ownsResource('transactions', 'id', txId, auth.userId);
  if (!existing) return NextResponse.json({ error: '鞈?銝??冽??⊥???, code: 'NotFound' }, { status: 404 });

  const body = await request.json().catch(() => ({}));

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
      error: '頧董鈭斗???游??芷嚗瘜?霈憿?嚗??寧?芷敺?撱綽?',
      code: 'TransferImmutable',
    }, { status: 422 });
  }

  const { type, amount, categoryId, accountId, note, excludeFromStats } = body;
  const date = normalizeDate(body.date);
  if (!date) return NextResponse.json({ error: '?交??澆??⊥?' }, { status: 400 });
  if (!['income', 'expense', 'transfer_in', 'transfer_out'].includes(type)) {
    return NextResponse.json({ error: '鈭斗?憿??⊥?' }, { status: 400 });
  }

  if (categoryId) {
    const catOwned = queryOne('SELECT id FROM categories WHERE id = ? AND user_id = ?', [categoryId, auth.userId]);
    if (!catOwned) return NextResponse.json({ error: '??銝??冽??⊥??? }, { status: 400 });
    const catRow = queryOne('SELECT parent_id FROM categories WHERE id = ? AND user_id = ?', [categoryId, auth.userId]);
    if (catRow && !catRow.parent_id) {
      return NextResponse.json({ error: '鈭斗?敹??晷?喳???嚗??賜?交??函??摨?' }, { status: 400 });
    }
  }
  if (accountId) {
    const accOwned = queryOne('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [accountId, auth.userId]);
    if (!accOwned) return NextResponse.json({ error: '撣單銝??冽??⊥??? }, { status: 400 });
  }

  const numAmt = Number(body.originalAmount ?? amount);
  if (!Number.isFinite(numAmt) || numAmt <= 0) {
    return NextResponse.json({ error: '??敹?憭扳 0', code: 'ValidationError', field: 'amount' }, { status: 400 });
  }

  let converted;
  try {
    converted = convertToTwd(body.originalAmount ?? amount, body.currency, body.fxRate, auth.userId);
  } catch (e) {
    return NextResponse.json({ error: e.message || '???澆??航炊' }, { status: 400 });
  }

  const fxFee = Math.max(0, Number(body.fxFee) || 0);
  const totalTwd = converted.twdAmount + fxFee;
  const twdAmountInt = moneyDecimal.computeTwdAmount(
    Math.round(converted.originalAmount * 100) / 100,
    String(converted.fxRate || 1),
    fxFee
  );

  const nowMs = Date.now();
  const db = getDB();
  db.run(
    'UPDATE transactions SET type=?, amount=?, currency=?, original_amount=?, fx_rate=?, fx_fee=?, twd_amount=?, date=?, category_id=?, account_id=?, note=?, exclude_from_stats=?, updated_at=? WHERE id=? AND user_id=?',
    [type, totalTwd, converted.currency, converted.originalAmount, converted.fxRate, fxFee, twdAmountInt, date, categoryId, accountId, note || '', excludeFromStats ? 1 : 0, nowMs, txId, auth.userId]
  );
  saveDB();
  return NextResponse.json({ ok: true, updatedAt: nowMs });
}

export async function PUT(request, { params }) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { txId } = await params;
  return updateHandler(request, txId, auth);
}

export async function PATCH(request, { params }) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const { txId } = await params;
  return updateHandler(request, txId, auth);
}

export async function DELETE(request, { params }) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { txId } = await params;
  const tx = ownsResource('transactions', 'id', txId, auth.userId);
  if (!tx) return NextResponse.json({ error: 'NotFound' }, { status: 404 });

  let expectedUpdatedAt;
  try {
    const body = await request.json().catch(() => ({}));
    expectedUpdatedAt = body?.expectedUpdatedAt ?? body?.expected_updated_at;
  } catch (_) {
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
  db.run('DELETE FROM transactions WHERE id = ? AND user_id = ?', [txId, auth.userId]);
  if (tx.linked_id) {
    db.run('DELETE FROM transactions WHERE id = ? AND user_id = ?', [tx.linked_id, auth.userId]);
  }
  saveDB();
  return NextResponse.json({ ok: true });
}
