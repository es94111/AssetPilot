import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';
import { normalizeDate } from '../../../../lib/accountHelpers';
import { validateChainConstraint } from '../../../../lib/stockHelpers';

export async function PUT(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { type, shares, price, fee, tax, accountId, note } = body;
  const date = normalizeDate(body.date);

  if (!date) return NextResponse.json({ error: '日期格式無效' }, { status: 400 });
  if (!['buy', 'sell'].includes(type)) return NextResponse.json({ error: '交易類型無效' }, { status: 400 });
  if (!(Number(shares) > 0)) return NextResponse.json({ error: '股數必須為正數' }, { status: 400 });
  if (!Number.isInteger(Number(shares))) return NextResponse.json({ error: '股數必須為整數' }, { status: 400 });
  if (!(Number(price) > 0)) return NextResponse.json({ error: '價格必須為正數' }, { status: 400 });
  if (Number(fee) < 0 || Number(tax) < 0) {
    return NextResponse.json({ error: '手續費/稅費不可為負' }, { status: 400 });
  }

  if (accountId) {
    const acc = queryOne('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [accountId, auth.userId]);
    if (!acc) return NextResponse.json({ error: '帳戶不存在或無權限' }, { status: 400 });
  }

  const t = queryOne('SELECT * FROM stock_transactions WHERE id = ? AND user_id = ?', [id, auth.userId]);
  if (!t) return NextResponse.json({ error: '交易紀錄不存在' }, { status: 404 });

  const chain = validateChainConstraint(auth.userId, t.stock_id, date, type, Number(shares), id);
  if (!chain.ok) {
    return NextResponse.json(
      { error: `此修改會造成 ${chain.conflictDate} 持有量為負 (預期 ${chain.expectedShares} 股)` },
      { status: 400 }
    );
  }

  const taxAutoCalc = (body.tax === undefined || body.tax === null || body.tax === '') ? 1 : 0;
  const db = getDB();
  db.run('BEGIN');
  try {
    db.run(
      'UPDATE stock_transactions SET date=?, type=?, shares=?, price=?, fee=?, tax=?, account_id=?, note=?, tax_auto_calculated=? WHERE id=? AND user_id=?',
      [date, type, shares, price, fee || 0, tax || 0, accountId || '', note || '', taxAutoCalc, id, auth.userId]
    );
    db.run('COMMIT');
  } catch (e) {
    try { db.run('ROLLBACK'); } catch (_) { /* noop */ }
    return NextResponse.json({ error: '更新交易失敗：' + e.message }, { status: 500 });
  }
  saveDB();

  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const db = getDB();
  db.run('DELETE FROM stock_transactions WHERE id = ? AND user_id = ?', [id, auth.userId]);
  saveDB();

  return NextResponse.json({ ok: true });
}
