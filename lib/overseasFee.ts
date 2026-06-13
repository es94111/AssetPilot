// lib/overseasFee.ts — 國外刷卡手續費「獨立交易列」共用邏輯。
// 設計：外幣信用卡消費的手續費不再併入原交易的 twd_amount，而是另存為一筆
// 獨立的 TWD 支出交易（is_fx_fee=1），與原交易以 linked_id 雙向關聯，方便在
// 「交易記錄」上分別呈現，並於原交易編輯/刪除時連動同步。

import { uid } from './userDefaults';

// 具備 run 方法的資料庫物件（sql.js Database），避免在此引入完整型別。
type RunnableDB = { run: (sql: string, params: Array<string | number | null>) => void };

export const FX_FEE_NOTE = '國外刷卡手續費';

export interface FeeTransactionInput {
  userId: string;
  mainId: string;            // 對應的原交易 id（手續費 linked 回它）
  feeAmount: number;         // 手續費（TWD 整數）
  date: string;
  categoryId?: string | null;
  accountId?: string | null;
  excludeFromStats?: boolean | number | null;
  note?: string;
  sourceRecurringId?: string;       // 來自固定收支時帶入
  scheduledDate?: string | null;    // 來自固定收支時帶入
}

// 寫入一筆手續費交易（is_fx_fee=1，幣別固定 TWD），回傳其 id。
export function insertFeeTransaction(db: RunnableDB, input: FeeTransactionInput): string {
  const feeId = uid();
  const now = Date.now();
  const amount = Math.max(0, Math.round(Number(input.feeAmount) || 0));
  db.run(
    `INSERT INTO transactions
     (id, user_id, type, amount, currency, original_amount, fx_rate, fx_fee, twd_amount,
      date, category_id, account_id, note, exclude_from_stats, linked_id, is_fx_fee,
      source_recurring_id, scheduled_date, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      feeId, input.userId, 'expense', amount, 'TWD', amount, '1', 0, amount,
      input.date, input.categoryId || null, input.accountId || null,
      input.note || FX_FEE_NOTE, input.excludeFromStats ? 1 : 0, input.mainId, 1,
      input.sourceRecurringId || '', input.scheduledDate ?? null, now, now,
    ]
  );
  return feeId;
}
