// lib/transactionWriteCore.ts — 一般收支／轉帳交易的共用寫入核心。
// 從 app/api/transactions/route.ts 與 app/api/transactions/transfer/route.ts 抽出，
// 供既有兩支 Route Handler 與 MCP create_transaction 工具三方共用，確保三者的
// INSERT 邏輯與回應形狀完全一致（FR-011）。呼叫端須先完成驗證與金額換算
// （convertToTwd／resolveOverseasFee／computeTwdAmount），本模組只做 INSERT 陳述式
// 與回應物件組裝，不重新驗證。
import { getDB, saveDB } from './db';
import { uid } from './userDefaults';
import { insertFeeTransaction } from './overseasFee';

export interface InsertIncomeExpenseInput {
  userId: string;
  type: string;
  twdAmount: number;
  currency: string;
  originalAmount: number;
  fxRate: string | number;
  fxFee: number;
  date: string;
  categoryId: string | null;
  accountId: string | null;
  note: string;
  excludeFromStats: boolean;
}

export interface InsertIncomeExpenseResult {
  id: string;
  twdAmount: number;
  fxFee: number;
  feeId: string | null;
  updatedAt: number;
}

export function insertIncomeExpenseTransaction(input: InsertIncomeExpenseInput): InsertIncomeExpenseResult {
  const id = uid();
  const now = Date.now();
  const db = getDB();
  db.run(
    'INSERT INTO transactions (id, user_id, type, amount, currency, original_amount, fx_rate, fx_fee, twd_amount, date, category_id, account_id, note, exclude_from_stats, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, input.userId, input.type, input.twdAmount, input.currency, input.originalAmount, input.fxRate, 0, input.twdAmount, input.date, input.categoryId || null, input.accountId || null, input.note || '', input.excludeFromStats ? 1 : 0, now, now]
  );

  // 僅外幣信用卡「支出」才產生手續費列，並與原交易雙向 linked。
  let feeId: string | null = null;
  if (input.type === 'expense' && input.fxFee > 0) {
    feeId = insertFeeTransaction(db, {
      userId: input.userId, mainId: id, feeAmount: input.fxFee, date: input.date,
      categoryId: input.categoryId, accountId: input.accountId, excludeFromStats: input.excludeFromStats,
    });
    db.run('UPDATE transactions SET linked_id = ? WHERE id = ? AND user_id = ?', [feeId, id, input.userId]);
  }

  saveDB();
  return { id, twdAmount: input.twdAmount, fxFee: input.fxFee, feeId, updatedAt: now };
}

export interface InsertTransferPairInput {
  userId: string;
  fromAccountId: string;
  toAccountId: string;
  fromCurrency: string;
  toCurrency: string;
  twdAmount: number;
  originalAmount: number;
  fxRate: string | number;
  date: string;
  note: string;
}

export interface TransferLegResult {
  id: string;
  accountId: string;
  toAccountId: string;
  amount: number;
  currency: string;
  date: string;
  linkedId: string;
  updatedAt: number;
}

export interface InsertTransferPairResult {
  transferOut: TransferLegResult;
  transferIn: TransferLegResult;
}

export function insertTransferPair(input: InsertTransferPairInput): InsertTransferPairResult {
  const now = Date.now();
  const outId = uid();
  const inId = uid();
  const db = getDB();
  try {
    db.run('BEGIN');
    db.run(
      'INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,fx_fee,twd_amount,date,category_id,account_id,to_account_id,note,linked_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [outId, input.userId, 'transfer_out', input.twdAmount, input.fromCurrency, input.originalAmount, input.fxRate, 0, input.twdAmount, input.date, '', input.fromAccountId, input.toAccountId, input.note, inId, now, now]
    );
    db.run(
      'INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,fx_fee,twd_amount,date,category_id,account_id,to_account_id,note,linked_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
      [inId, input.userId, 'transfer_in', input.twdAmount, input.toCurrency, input.originalAmount, input.fxRate, 0, input.twdAmount, input.date, '', input.toAccountId, input.fromAccountId, input.note, outId, now, now]
    );
    db.run('COMMIT');
  } catch (e) {
    try { db.run('ROLLBACK'); } catch { /* noop */ }
    throw e;
  }
  saveDB();
  return {
    transferOut: { id: outId, accountId: input.fromAccountId, toAccountId: input.toAccountId, amount: input.originalAmount, currency: input.fromCurrency, date: input.date, linkedId: inId, updatedAt: now },
    transferIn: { id: inId, accountId: input.toAccountId, toAccountId: input.fromAccountId, amount: input.originalAmount, currency: input.toCurrency, date: input.date, linkedId: outId, updatedAt: now },
  };
}
