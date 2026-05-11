import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';
import { normalizeCurrency, convertToTwd, normalizeDate } from '../../../../lib/accountHelpers';
import { uid } from '../../../../lib/userDefaults';
import { todayInUserTz } from '../../../../lib/userTime';

interface TransferRequest {
  fromAccountId?: string;
  fromId?: string;
  toAccountId?: string;
  toId?: string;
  amount?: number | string;
  note?: string;
  date?: string | null;
}

interface TransferAccountRow {
  id: string;
  currency: string | null;
}

function asRow<T>(row: Record<string, string | number | null> | null): T | null {
  return row as unknown as T | null;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({})) as TransferRequest;
  const fromId = body.fromAccountId ?? body.fromId;
  const toId = body.toAccountId ?? body.toId;
  const { amount, note } = body;
  const rawDate = body.date;

  if (!fromId || !toId) return NextResponse.json({ error: '缺少帳戶資訊' }, { status: 400 });
  if (fromId === toId) return NextResponse.json({ error: '轉出與轉入帳戶不可相同' }, { status: 400 });
  if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
    return NextResponse.json({ error: '金額必須大於 0' }, { status: 400 });
  }

  const fromAccount = asRow<TransferAccountRow>(queryOne('SELECT id, currency FROM accounts WHERE id = ? AND user_id = ?', [fromId, auth.userId]));
  const toAccount = asRow<TransferAccountRow>(queryOne('SELECT id, currency FROM accounts WHERE id = ? AND user_id = ?', [toId, auth.userId]));
  if (!fromAccount || !toAccount) return NextResponse.json({ error: 'NotFound' }, { status: 404 });

  const fromCurrency = normalizeCurrency(fromAccount.currency);
  const toCurrency = normalizeCurrency(toAccount.currency);
  if (fromCurrency !== toCurrency) {
    return NextResponse.json({
      error: 'CrossCurrencyTransfer',
      message: '跨幣別請分開記一筆支出 + 一筆收入',
    }, { status: 422 });
  }

  let converted;
  try {
    converted = convertToTwd(Number(amount), fromCurrency, null, auth.userId);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '轉帳金額格式錯誤' }, { status: 400 });
  }

  const now = Date.now();
  const txDate = normalizeDate(rawDate) || todayInUserTz(auth.userTimezone);
  const txNote = note || '轉帳';
  const outId = uid();
  const inId = uid();
  const db = getDB();
  try {
    db.run('BEGIN');
    db.run(
      'INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,fx_fee,twd_amount,date,category_id,account_id,to_account_id,note,linked_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [outId, auth.userId, 'transfer_out', converted.twdAmount, fromCurrency, converted.originalAmount, converted.fxRate, 0, converted.twdAmount, txDate, '', fromId, toId, txNote, inId, now, now]
    );
    db.run(
      'INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,fx_fee,twd_amount,date,category_id,account_id,to_account_id,note,linked_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [inId, auth.userId, 'transfer_in', converted.twdAmount, toCurrency, converted.originalAmount, converted.fxRate, 0, converted.twdAmount, txDate, '', toId, fromId, txNote, outId, now, now]
    );
    db.run('COMMIT');
  } catch (e) {
    try { db.run('ROLLBACK'); } catch (_) {}
    return NextResponse.json({ error: '轉帳建立失敗', message: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
  saveDB();
  return NextResponse.json({
    transferOut: { id: outId, accountId: fromId, toAccountId: toId, amount: converted.originalAmount, currency: fromCurrency, date: txDate, linkedId: inId, updatedAt: now },
    transferIn: { id: inId, accountId: toId, toAccountId: fromId, amount: converted.originalAmount, currency: toCurrency, date: txDate, linkedId: outId, updatedAt: now },
    ok: true,
  }, { status: 201 });
}
