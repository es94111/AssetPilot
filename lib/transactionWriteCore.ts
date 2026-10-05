// lib/transactionWriteCore.ts — 一般收支／轉帳交易的共用寫入核心。
// 從 app/api/transactions/route.ts 與 app/api/transactions/transfer/route.ts 抽出，
// 供既有兩支 Route Handler 與 MCP create_transaction 工具三方共用，確保三者的
// INSERT 邏輯與回應形狀完全一致（FR-011）。呼叫端須先完成驗證與金額換算
// （convertToTwd／resolveOverseasFee／computeTwdAmount），本模組只做 INSERT 陳述式
// 與回應物件組裝，不重新驗證。
import { getDB, queryOne, saveDB } from "./db";
import { uid } from "./userDefaults";
import { insertFeeTransaction } from "./overseasFee";
import { deleteTransactionAttachments } from "./transactionAttachments";

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
  aiCreated?: boolean; // 此列是否由 AI 透過 MCP create_transaction 建立（005）
  clientRef?: string; // 離線記帳的 idempotency key（007；線上新增為空）
}

export interface InsertIncomeExpenseResult {
  id: string;
  twdAmount: number;
  fxFee: number;
  feeId: string | null;
  updatedAt: number;
}

/**
 * 依 (user_id, client_ref) 找回已寫入的交易（007-pwa-offline-entry）。
 *
 * 離線佇列恢復連線後可能重送同一筆交易；伺服器以唯一索引
 * `idx_transactions_client_ref` 保證冪等，本函式負責在 INSERT 未新增任何列時
 * 把既有列以與新建完全相同的回應形狀回傳，讓前端無法區分「新建」與「去重」。
 * `clientRef` 為空字串（線上直接新增）時永遠回傳 null，維持既有行為不變。
 */
function findExistingByClientRef(
  userId: string,
  clientRef: string | undefined,
): InsertIncomeExpenseResult | null {
  if (!clientRef) return null;
  const row = queryOne(
    "SELECT id, twd_amount, updated_at FROM transactions WHERE user_id = ? AND client_ref = ? AND is_fx_fee = 0",
    [userId, clientRef],
  );
  if (!row) return null;
  const feeRow = queryOne(
    "SELECT id, amount FROM transactions WHERE user_id = ? AND linked_id = ? AND is_fx_fee = 1",
    [userId, row.id],
  );
  return {
    id: String(row.id),
    twdAmount: Number(row.twd_amount) || 0,
    fxFee: feeRow ? Number(feeRow.amount) || 0 : 0,
    feeId: feeRow ? String(feeRow.id) : null,
    updatedAt: Number(row.updated_at) || 0,
  };
}

export function isDisabledCreditCard(userId: string, accountId: string | null): boolean {
  if (!accountId) return false;
  const account = queryOne(
    "SELECT category, account_type, is_active FROM accounts WHERE id = ? AND user_id = ?",
    [accountId, userId],
  );
  return (
    (account?.category === "credit_card" || account?.account_type === "信用卡") &&
    account?.is_active === 0
  );
}

export function insertIncomeExpenseTransaction(
  input: InsertIncomeExpenseInput,
): InsertIncomeExpenseResult {
  // 離線重送先去重：同一 client_ref 已寫入過就直接回傳既有列（冪等）。
  const existing = findExistingByClientRef(input.userId, input.clientRef);
  if (existing) return existing;

  const id = uid();
  const now = Date.now();
  const db = getDB();
  let feeId: string | null = null;

  if (input.type === "expense" && isDisabledCreditCard(input.userId, input.accountId)) {
    throw new Error("此信用卡已停用，無法新增刷卡消費");
  }

  try {
    db.run("BEGIN");
    db.run(
      "INSERT INTO transactions (id, user_id, type, amount, currency, original_amount, fx_rate, fx_fee, twd_amount, date, category_id, account_id, note, exclude_from_stats, ai_created, client_ref, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        id,
        input.userId,
        input.type,
        input.twdAmount,
        input.currency,
        input.originalAmount,
        input.fxRate,
        0,
        input.twdAmount,
        input.date,
        input.categoryId || null,
        input.accountId || null,
        input.note || "",
        input.excludeFromStats ? 1 : 0,
        input.aiCreated ? 1 : 0,
        input.clientRef || "",
        now,
        now,
      ],
    );

    // 僅外幣信用卡「支出」才產生手續費列，並與原交易雙向 linked。
    if (input.type === "expense" && input.fxFee > 0) {
      feeId = insertFeeTransaction(db, {
        userId: input.userId,
        mainId: id,
        feeAmount: input.fxFee,
        date: input.date,
        categoryId: input.categoryId,
        accountId: input.accountId,
        excludeFromStats: input.excludeFromStats,
        aiCreated: input.aiCreated,
      });
      db.run(
        "UPDATE transactions SET linked_id = ? WHERE id = ? AND user_id = ?",
        [feeId, id, input.userId],
      );
    }
    db.run("COMMIT");
  } catch (error) {
    try {
      db.run("ROLLBACK");
    } catch (rollbackError) {
      console.error("[transactionWriteCore] rollback failed", rollbackError);
    }
    // 併發競態（同一 client_ref 兩個請求同時通過前置檢查）：唯一索引讓後到者
    // 失敗，此時改讀已寫入的列回傳，維持與新建相同的回應形狀。
    const raced = findExistingByClientRef(input.userId, input.clientRef);
    if (raced) return raced;
    throw error;
  }

  saveDB();
  return {
    id,
    twdAmount: input.twdAmount,
    fxFee: input.fxFee,
    feeId,
    updatedAt: now,
  };
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
  aiCreated?: boolean; // 此列是否由 AI 透過 MCP create_transaction 建立（005）
  clientRef?: string; // 離線記帳的 idempotency key（007；線上新增為空）
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

/**
 * 依 (user_id, client_ref) 找回已寫入的轉帳配對（007-pwa-offline-entry）。
 * 形狀與 `insertTransferPair` 的新建結果完全一致，讓重送無法被前端察覺。
 *
 * 僅 SELECT 基底 CREATE TABLE 即保證存在的欄位，避開 `to_account_id` 與
 * `transfer_to_account_id` 兩種命名在新舊部署間的分歧；轉出腳的 toAccountId
 * 語意等同轉入腳的 accountId，故直接由配對關係推導。
 */
function findExistingTransferByClientRef(
  userId: string,
  clientRef: string | undefined,
): InsertTransferPairResult | null {
  if (!clientRef) return null;
  const outRow = queryOne(
    "SELECT id, account_id, amount, currency, date, linked_id, updated_at FROM transactions WHERE user_id = ? AND client_ref = ? AND type = 'transfer_out'",
    [userId, clientRef],
  );
  if (!outRow) return null;
  const inRow = queryOne(
    "SELECT id, account_id, amount, currency, date, linked_id, updated_at FROM transactions WHERE user_id = ? AND client_ref = ? AND type = 'transfer_in'",
    [userId, clientRef],
  );
  const leg = (
    row: Record<string, string | number | null>,
    toAccountId: string,
  ): TransferLegResult => ({
    id: String(row.id),
    accountId: String(row.account_id ?? ""),
    toAccountId,
    amount: Number(row.amount) || 0,
    currency: String(row.currency ?? "TWD"),
    date: String(row.date ?? ""),
    linkedId: String(row.linked_id ?? ""),
    updatedAt: Number(row.updated_at) || 0,
  });
  return {
    transferOut: leg(outRow, String(inRow?.account_id ?? "")),
    transferIn: inRow
      ? leg(inRow, String(outRow.account_id ?? ""))
      : { id: "", accountId: "", toAccountId: String(outRow.account_id ?? ""), amount: 0, currency: "TWD", date: "", linkedId: String(outRow.linked_id ?? ""), updatedAt: 0 },
  };
}

export function insertTransferPair(
  input: InsertTransferPairInput,
): InsertTransferPairResult {
  // 離線重送先去重：同一 client_ref 已寫入過就直接回傳既有配對（冪等）。
  const existing = findExistingTransferByClientRef(input.userId, input.clientRef);
  if (existing) return existing;

  const now = Date.now();
  const outId = uid();
  const inId = uid();
  const db = getDB();
  try {
    db.run("BEGIN");
    db.run(
      "INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,fx_fee,twd_amount,date,category_id,account_id,to_account_id,note,linked_id,ai_created,client_ref,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        outId,
        input.userId,
        "transfer_out",
        input.twdAmount,
        input.fromCurrency,
        input.originalAmount,
        input.fxRate,
        0,
        input.twdAmount,
        input.date,
        "",
        input.fromAccountId,
        input.toAccountId,
        input.note,
        inId,
        input.aiCreated ? 1 : 0,
        input.clientRef || "",
        now,
        now,
      ],
    );
    db.run(
      "INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,fx_fee,twd_amount,date,category_id,account_id,to_account_id,note,linked_id,ai_created,client_ref,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        inId,
        input.userId,
        "transfer_in",
        input.twdAmount,
        input.toCurrency,
        input.originalAmount,
        input.fxRate,
        0,
        input.twdAmount,
        input.date,
        "",
        input.toAccountId,
        input.fromAccountId,
        input.note,
        outId,
        input.aiCreated ? 1 : 0,
        input.clientRef || "",
        now,
        now,
      ],
    );
    db.run("COMMIT");
  } catch (error) {
    try {
      db.run("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "[transactionWriteCore] transfer rollback failed",
        rollbackError,
      );
    }
    const raced = findExistingTransferByClientRef(input.userId, input.clientRef);
    if (raced) return raced;
    throw error;
  }
  saveDB();
  return {
    transferOut: {
      id: outId,
      accountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      amount: input.originalAmount,
      currency: input.fromCurrency,
      date: input.date,
      linkedId: inId,
      updatedAt: now,
    },
    transferIn: {
      id: inId,
      accountId: input.toAccountId,
      toAccountId: input.fromAccountId,
      amount: input.originalAmount,
      currency: input.toCurrency,
      date: input.date,
      linkedId: outId,
      updatedAt: now,
    },
  };
}

// 級聯刪除一筆交易（含其附件與 linked_id 連動對象），供既有 DELETE /api/transactions/{id}
// 與新的 POST .../restore-ai-created 共用（005 FR-005：還原效果須與手動刪除逐位元相同）。
// 回傳實際被移除的 id 陣列（恆含 txId；有連動對象時再多一個）。
export async function deleteTransactionCascade(
  userId: string,
  txId: string,
  linkedId: string,
): Promise<string[]> {
  const ids = linkedId ? [txId, linkedId] : [txId];
  await deleteTransactionAttachments(userId, ids);
  const db = getDB();
  db.run("DELETE FROM transactions WHERE id = ? AND user_id = ?", [
    txId,
    userId,
  ]);
  if (linkedId) {
    db.run("DELETE FROM transactions WHERE id = ? AND user_id = ?", [
      linkedId,
      userId,
    ]);
  }
  saveDB();
  return ids;
}
