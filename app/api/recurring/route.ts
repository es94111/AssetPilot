// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../lib/db';
import { normalizeCurrency, convertToTwd, normalizeDate, resolveOverseasFee } from '../../../lib/accountHelpers';
import { uid } from '../../../lib/userDefaults';
import { isValidIsoDate } from '../../../lib/userTime';
import { getNextRecurringDate } from '../../../lib/recurringHelpers';

const VALID_RECURRING_FREQ = new Set(['daily', 'weekly', 'monthly', 'yearly']);
const VALID_RECURRING_TYPE = new Set(['income', 'expense']);

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const rows = queryAll('SELECT * FROM recurring WHERE user_id = ? ORDER BY start_date DESC', [auth.userId]);
  return NextResponse.json(rows.map(r => {
    const nextDate = r.last_generated
      ? getNextRecurringDate(r.last_generated, r.frequency)
      : r.start_date;
    return {
      id: r.id,
      type: r.type,
      amount: r.amount,
      categoryId: r.category_id,
      accountId: r.account_id,
      frequency: r.frequency,
      startDate: r.start_date,
      note: r.note || '',
      isActive: !!r.is_active,
      lastGenerated: r.last_generated,
      currency: r.currency || 'TWD',
      fxRate: String(r.fx_rate != null ? r.fx_rate : '1'),
      fxFee: Number(r.fx_fee) || 0,
      excludeFromStats: !!r.exclude_from_stats,
      needsAttention: !!r.needs_attention,
      nextDate,
      updatedAt: r.updated_at,
    };
  }));
}

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const { type, categoryId, accountId, frequency, startDate, note, excludeFromStats } = body;
  let { amount, currency, fxRate } = body;

  if (!VALID_RECURRING_TYPE.has(type)) {
    return NextResponse.json({ error: '類型無效（需為 income 或 expense）', code: 'ValidationError', field: 'type' }, { status: 400 });
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

  const fxFee = resolveOverseasFee({
    userId: auth.userId,
    accountId: accountId || null,
    currency: converted.currency,
    twdBase: amountTwdInt,
    clientFxFee: body.fxFee,
  });

  const now = Date.now();
  const id = uid();
  getDB().run(
    `INSERT INTO recurring (id, user_id, type, amount, category_id, account_id, frequency, start_date, note, is_active, last_generated, currency, fx_rate, fx_fee, exclude_from_stats, needs_attention, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, NULL, ?, ?, ?, ?, 0, ?)`,
    [id, auth.userId, type, amountTwdInt, categoryId || null, accountId || null, frequency, normalizedStart, note || '', converted.currency, String(converted.fxRate), fxFee, excludeFromStats ? 1 : 0, now]
  );
  saveDB();
  return NextResponse.json({ id });
}
