// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';
import { normalizeCurrency, convertToTwd, normalizeDate } from '../../../../lib/accountHelpers';
import { isValidIsoDate } from '../../../../lib/userTime';

const VALID_RECURRING_FREQ = new Set(['daily', 'weekly', 'monthly', 'yearly']);

export async function PUT(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { type, categoryId, accountId, frequency, startDate, note } = body;
  let { amount, currency, fxRate } = body;

  if (categoryId === '__deleted_category__') {
    return NextResponse.json({ error: '請先選擇有效分類', code: 'ValidationError', field: 'categoryId' }, { status: 400 });
  }
  if (accountId === '__deleted_account__') {
    return NextResponse.json({ error: '請先選擇有效帳戶', code: 'ValidationError', field: 'accountId' }, { status: 400 });
  }

  const old = queryOne('SELECT * FROM recurring WHERE id = ? AND user_id = ?', [id, auth.userId]);
  if (!old) return NextResponse.json({ error: '配方不存在或無權限', code: 'NotFound' }, { status: 404 });

  if (type !== undefined && type !== null && type !== old.type) {
    return NextResponse.json({ error: '類型欄位建立後不可變更，需變更請刪除後重建', code: 'ValidationError', field: 'type' }, { status: 400 });
  }
  if (!VALID_RECURRING_FREQ.has(frequency)) {
    return NextResponse.json({ error: '週期無效（需為 daily / weekly / monthly / yearly）', code: 'ValidationError', field: 'frequency' }, { status: 400 });
  }
  if (categoryId) {
    const cat = queryOne('SELECT id FROM categories WHERE id = ? AND user_id = ?', [categoryId, auth.userId]);
    if (!cat) return NextResponse.json({ error: '分類不存在或無權限', code: 'ValidationError', field: 'categoryId' }, { status: 400 });
  }
  if (accountId) {
    const acc = queryOne('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [accountId, auth.userId]);
    if (!acc) return NextResponse.json({ error: '帳戶不存在或無權限', code: 'ValidationError', field: 'accountId' }, { status: 400 });
  }
  const normalizedStart = normalizeDate(startDate);
  if (!normalizedStart || !isValidIsoDate(normalizedStart)) {
    return NextResponse.json({ error: '起始日期格式無效', code: 'ValidationError', field: 'startDate' }, { status: 400 });
  }
  currency = normalizeCurrency(currency || 'TWD');
  let converted;
  try {
    converted = convertToTwd(amount, currency, fxRate, auth.userId);
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || '金額無效'), code: 'ValidationError', field: 'amount' }, { status: 400 });
  }
  const amountTwdInt = Math.round(Number(converted.twdAmount) || 0);
  if (!(amountTwdInt >= 1)) {
    return NextResponse.json({ error: '金額必須為正整數（本幣）', code: 'ValidationError', field: 'amount' }, { status: 400 });
  }

  const newLastGenerated = (normalizedStart !== old.start_date) ? null : old.last_generated;

  getDB().run(
    `UPDATE recurring SET amount = ?, category_id = ?, account_id = ?, frequency = ?, start_date = ?, note = ?, currency = ?, fx_rate = ?, last_generated = ?, needs_attention = 0, updated_at = ? WHERE id = ? AND user_id = ?`,
    [amountTwdInt, categoryId || null, accountId || null, frequency, normalizedStart, note || '', converted.currency, String(converted.fxRate), newLastGenerated, Date.now(), id, auth.userId]
  );
  saveDB();
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  getDB().run('DELETE FROM recurring WHERE id = ? AND user_id = ?', [id, auth.userId]);
  saveDB();
  return NextResponse.json({ ok: true });
}
