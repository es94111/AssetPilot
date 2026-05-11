import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';
import { normalizeCurrency, convertToTwd, convertFromTwd, normalizeDate } from '../../../../lib/accountHelpers';
import { uid, todayStr } from '../../../../lib/userDefaults';

interface CreditCardRepaymentItem {
  cardId?: string;
  amount?: number | string;
}

interface CreditCardRepaymentRequest {
  fromAccountId?: string;
  date?: string | null;
  repayments?: CreditCardRepaymentItem[];
}

interface RepaymentAccountRow {
  currency: string | null;
  account_type: string | null;
}

interface ValidRepayment {
  cardId: string;
  toCurrency: string;
  outConverted: { twdAmount: number; originalAmount: number; fxRate: string };
  inConverted: { twdAmount: number; originalAmount: number; fxRate: string };
}

function asRow<T>(row: Record<string, string | number | null> | null): T | null {
  return row as unknown as T | null;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({})) as CreditCardRepaymentRequest;
  const { fromAccountId, date: rawDate, repayments } = body;
  if (!fromAccountId || !Array.isArray(repayments) || repayments.length === 0) {
    return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
  }

  const fromAccount = asRow<RepaymentAccountRow>(queryOne(
    'SELECT currency, account_type FROM accounts WHERE id = ? AND user_id = ?',
    [fromAccountId, auth.userId]
  ));
  if (!fromAccount) return NextResponse.json({ error: '付款帳戶不存在' }, { status: 400 });
  if (fromAccount.account_type === '信用卡') return NextResponse.json({ error: '付款帳戶不可為信用卡' }, { status: 400 });

  const txDate = normalizeDate(rawDate) || todayStr();
  const fromCurrency = normalizeCurrency(fromAccount.currency);
  const now = Date.now();

  const validRepayments: ValidRepayment[] = [];
  for (const { cardId, amount } of repayments) {
    if (!cardId || Number(amount) <= 0) continue;
    const cardAccount = asRow<RepaymentAccountRow>(queryOne(
      "SELECT currency, account_type FROM accounts WHERE id = ? AND user_id = ?",
      [cardId, auth.userId]
    ));
    if (!cardAccount || cardAccount.account_type !== '信用卡') continue;

    const toCurrency = normalizeCurrency(cardAccount.currency);
    const transferAmount = Number(amount);
    let outConverted;
    try {
      outConverted = convertToTwd(transferAmount, fromCurrency, null, auth.userId);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : '金額格式錯誤' }, { status: 400 });
    }
    const inOriginal = toCurrency === fromCurrency
      ? transferAmount
      : convertFromTwd(outConverted.twdAmount, toCurrency, auth.userId);
    const inConverted = convertToTwd(inOriginal, toCurrency, null, auth.userId);
    validRepayments.push({ cardId, toCurrency, outConverted, inConverted });
  }

  if (validRepayments.length === 0) {
    return NextResponse.json({ error: '沒有有效的還款項目' }, { status: 400 });
  }

  const db = getDB();
  for (const { cardId, toCurrency, outConverted, inConverted } of validRepayments) {
    const outId = uid();
    const inId = uid();
    db.run(
      'INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,date,category_id,account_id,note,linked_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [outId, auth.userId, 'transfer_out', outConverted.twdAmount, fromCurrency, outConverted.originalAmount, outConverted.fxRate, txDate, '', fromAccountId, '信用卡還款', inId, now, now]
    );
    db.run(
      'INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,date,category_id,account_id,note,linked_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [inId, auth.userId, 'transfer_in', inConverted.twdAmount, toCurrency, inConverted.originalAmount, inConverted.fxRate, txDate, '', cardId, '信用卡還款', outId, now, now]
    );
  }

  saveDB();
  return NextResponse.json({ ok: true });
}
