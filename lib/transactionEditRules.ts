/**
 * 純模組：交易「列本身不可編輯」規則與備註長度上限常數。
 *
 * 本模組不得 `import './db'` 或任何伺服器端相依——`TRANSACTION_NOTE_MAX_LENGTH` 會同時被
 * client component（`components/features/transactions/TransactionsClient.tsx`）引用，牽連伺服器端
 * 相依會污染前端 bundle。此約束是 FR-009「與既有網頁手動編輯相同的長度限制」與 FR-010「不可編輯
 * 交易判斷須與既有手動編輯共用同一套規則，不得另行維護獨立清單」的共用定義來源（research.md
 * 第 3、4 節）。
 *
 * 抽出範圍刻意限縮在 `is_fx_fee === 1` 這一條「列本身不可編輯」規則；`TransferImmutable` 是
 * 「請求想改 type」才成立的規則，本功能永遠只寫 `note`，搬過來會變成死規則，故留在原處。
 */

/** 備註長度上限（UTF-16 code unit，與瀏覽器 `maxlength` 計數方式一致）。 */
export const TRANSACTION_NOTE_MAX_LENGTH = 200;

export interface TransactionEditBlock {
  code: string;
  message: string;
  status: number;
}

/**
 * 傳入交易列，回傳擋修改的理由；`null` 代表可編輯。
 *
 * `is_fx_fee` 為**必填**屬性（非選填）——比照 `app/api/transactions/[txId]/route.ts` 的
 * `TransactionRow.is_fx_fee: number | null` 本就必填；必填可讓呼叫端若漏了在 SELECT／型別中帶出
 * `is_fx_fee` 時無法通過 `npm run typecheck`，是前置 SELECT 忘記帶欄位的第一道防線。
 */
export function findTransactionEditBlock(row: { is_fx_fee: number | null }): TransactionEditBlock | null {
  if (row.is_fx_fee === 1) {
    return {
      code: 'FxFeeImmutable',
      message: '此為自動產生的國外刷卡手續費交易，請改編輯對應的國外交易（修改後手續費會自動同步）',
      status: 422,
    };
  }
  return null;
}