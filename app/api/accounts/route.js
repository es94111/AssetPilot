import { NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../lib/db';
import {
  normalizeCurrency, normalizeAccountIcon, categoryFromAccountType, accountTypeFromCategory,
  calcBalance,
} from '../../../lib/accountHelpers';
import { uid, todayStr } from '../../../lib/userDefaults';

const VALID_CATEGORIES = ['bank', 'credit_card', 'cash', 'virtual_wallet'];

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const accounts = queryAll('SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at', [auth.userId]);
  const txRows = queryAll(
    'SELECT account_id, type, COALESCE(twd_amount, amount) as twd_amount FROM transactions WHERE user_id = ?',
    [auth.userId]
  );
  const twdMap = {};
  for (const r of txRows) {
    const v = Number(r.twd_amount) || 0;
    if (!twdMap[r.account_id]) twdMap[r.account_id] = 0;
    if (r.type === 'income' || r.type === 'transfer_in') twdMap[r.account_id] += v;
    else if (r.type === 'expense' || r.type === 'transfer_out') twdMap[r.account_id] -= v;
  }
  const result = accounts.map(a => {
    const accountCurrency = normalizeCurrency(a.currency);
    const balance = calcBalance(a.id, a.initial_balance, auth.userId, accountCurrency);
    const twdAcc = twdMap[a.id] || 0;
    const twdAccumulated = accountCurrency === 'TWD'
      ? Math.round((twdAcc + (Number(a.initial_balance) || 0)) * 100) / 100
      : Math.round(twdAcc * 100) / 100;
    return {
      ...a,
      icon: normalizeAccountIcon(a.icon),
      initialBalance: a.initial_balance,
      currency: accountCurrency,
      balance,
      twdAccumulated,
      linkedBankId: a.linked_bank_id || null,
      category: a.category || categoryFromAccountType(a.account_type),
      overseasFeeRate: a.overseas_fee_rate ?? null,
      excludeFromTotal: a.exclude_from_total === 1,
      updatedAt: Number(a.updated_at) || 0,
    };
  });
  return NextResponse.json(result);
}

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const { name, initialBalance, icon, excludeFromTotal, linkedBankId } = body;
  const currency = normalizeCurrency(body.currency);
  const safeIcon = normalizeAccountIcon(icon);
  const safeName = String(name || '').trim();
  if (safeName.length < 1 || safeName.length > 64) {
    return NextResponse.json({ error: '名稱必須為 1~64 字元', code: 'ValidationError', field: 'name' }, { status: 400 });
  }
  let category = body.category;
  if (!VALID_CATEGORIES.includes(category)) {
    category = categoryFromAccountType(body.accountType);
  }
  const safeAccountType = accountTypeFromCategory(category);
  const safeExclude = excludeFromTotal ? 1 : 0;

  let safeOverseasFeeRate = null;
  if (category === 'credit_card' && body.overseasFeeRate != null) {
    const v = Number(body.overseasFeeRate);
    if (!Number.isFinite(v) || v < 0 || v > 1000) {
      return NextResponse.json({ error: '海外手續費率須為 0~1000（千分點）', code: 'ValidationError', field: 'overseasFeeRate' }, { status: 400 });
    }
    safeOverseasFeeRate = Math.round(v);
  }

  let safeLinkedBankId = null;
  if (category === 'credit_card' && linkedBankId) {
    const bankAcc = queryOne("SELECT id FROM accounts WHERE id = ? AND user_id = ? AND (category = 'bank' OR account_type = '銀行')", [linkedBankId, auth.userId]);
    if (!bankAcc) return NextResponse.json({ error: '指定的銀行帳戶不存在' }, { status: 400 });
    safeLinkedBankId = linkedBankId;
  }

  const id = uid();
  const nowMs = Date.now();
  const safeInitialBalance = Math.round(Number(initialBalance) || 0);
  getDB().run(
    'INSERT INTO accounts (id, user_id, name, category, initial_balance, currency, icon, exclude_from_total, linked_bank_id, overseas_fee_rate, account_type, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, auth.userId, safeName, category, safeInitialBalance, currency, safeIcon, safeExclude, safeLinkedBankId, safeOverseasFeeRate, safeAccountType, todayStr(), nowMs]
  );
  saveDB();

  return NextResponse.json({
    id, name: safeName, category, accountType: safeAccountType,
    initialBalance: safeInitialBalance, currency, icon: safeIcon,
    excludeFromTotal: safeExclude === 1, linkedBankId: safeLinkedBankId,
    overseasFeeRate: safeOverseasFeeRate, updatedAt: nowMs,
  }, { status: 201 });
}
