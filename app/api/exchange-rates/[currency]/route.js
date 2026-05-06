import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';
import { parseCurrencyCode } from '../../../../lib/accountHelpers';
import { isValidCurrency } from '../../../../lib/iso4217';

export async function GET(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { currency: rawCurrency } = await params;
  const currency = parseCurrencyCode(rawCurrency);
  if (!currency || !isValidCurrency(currency)) {
    return NextResponse.json({ error: '幣別格式不正確（需為 3 碼英文字母）' }, { status: 400 });
  }

  if (currency === 'TWD') {
    return NextResponse.json({ currency: 'TWD', rateToTwd: 1, updatedAt: 0, isManual: true });
  }

  const row = queryOne('SELECT currency, rate_to_twd, updated_at, is_manual FROM exchange_rates WHERE user_id = ? AND currency = ?', [auth.userId, currency]);
  if (!row) {
    return NextResponse.json({ error: '匯率不存在', code: 'NotFound' }, { status: 404 });
  }

  return NextResponse.json({
    currency: row.currency,
    rateToTwd: Number(row.rate_to_twd),
    updatedAt: Number(row.updated_at) || 0,
    isManual: !!row.is_manual,
  });
}

export async function PUT(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { currency: rawCurrency } = await params;
  const currency = parseCurrencyCode(rawCurrency);
  if (!currency || !isValidCurrency(currency)) {
    return NextResponse.json({ error: '幣別格式不正確（需為 3 碼英文字母）' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const rate = Number(body.rateToTwd);
  if (currency === 'TWD') {
    return NextResponse.json({ error: 'TWD 匯率固定為 1，不可修改' }, { status: 400 });
  }
  if (!(rate > 0 && rate < 1000000)) {
    return NextResponse.json({ error: `${currency} 匯率格式不正確` }, { status: 400 });
  }

  const now = Date.now();
  getDB().run(
    `INSERT INTO exchange_rates (user_id, currency, rate_to_twd, updated_at, is_manual)
     VALUES (?, ?, ?, ?, 1)
     ON CONFLICT(user_id, currency) DO UPDATE SET rate_to_twd = excluded.rate_to_twd, updated_at = excluded.updated_at, is_manual = 1`,
    [auth.userId, currency, rate, now]
  );
  saveDB();

  return NextResponse.json({ currency, rateToTwd: rate, updatedAt: now, isManual: true });
}

export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { currency: rawCurrency } = await params;
  const currency = parseCurrencyCode(rawCurrency);
  if (!currency || !isValidCurrency(currency)) {
    return NextResponse.json({ error: '幣別格式不正確（需為 3 碼英文字母）' }, { status: 400 });
  }
  if (currency === 'TWD') {
    return NextResponse.json({ error: 'TWD 匯率固定為 1，不可刪除' }, { status: 400 });
  }

  const existing = queryOne('SELECT currency FROM exchange_rates WHERE user_id = ? AND currency = ?', [auth.userId, currency]);
  if (!existing) {
    return NextResponse.json({ error: '匯率不存在', code: 'NotFound' }, { status: 404 });
  }

  getDB().run('DELETE FROM exchange_rates WHERE user_id = ? AND currency = ?', [auth.userId, currency]);
  saveDB();

  return NextResponse.json({ ok: true });
}
