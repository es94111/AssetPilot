// lib/reconciliationUi.ts — 對帳頁面專用的純前端輔助（不得 import 任何 node:* 或 DB 模組）。
//
// 對帳頁面需要「欄位對應預設值」與「差異類型／來源類型的中文標籤」等呈現邏輯；
// 這些刻意與 lib/csvReconciliationParser.ts、lib/reconciliationMatch.ts 分離，
// 避免伺服器端模組（連帶 DB 相依）被打包進 client bundle。
// 型別以 `import type` 取得，執行期不產生任何 import。
import type { ReconciliationCsvProfile, ReconciliationDateFormat } from './csvReconciliationParser';
import type { ReconciliationDiffKind } from './reconciliationMatch';

/**
 * 對帳匯入來源種類。
 *
 * 刻意在本模組重新宣告而非自 `lib/reconciliationStore.ts` 匯入型別：後者相依
 * `lib/db.ts`，任何形式的 import 都可能讓打包器把資料庫相依帶進 client bundle
 * （見 tasks/lessons.md「Keep Node-Only Modules Out of Client Bundles」）。
 */
export type ReconciliationSourceKind = 'bank' | 'credit_card' | 'investment';

/** 對帳頁面支援的欄位對應預設樣板（使用者可再調整標題名稱）。 */
export interface ReconciliationProfileTemplate {
  /** i18n 標籤鍵（`features.reconciliation.templates.*`）。 */
  labelKey: string;
  profile: ReconciliationCsvProfile;
}

/** 常見銀行／券商 CSV 的欄位對應樣板。 */
export const RECONCILIATION_PROFILE_TEMPLATES: ReconciliationProfileTemplate[] = [
  {
    labelKey: 'features.reconciliation.templates.signedAmount',
    profile: {
      dateFormat: 'auto',
      amountSign: 'signed',
      columns: { date: '日期', amount: '金額', description: '摘要' },
    },
  },
  {
    labelKey: 'features.reconciliation.templates.debitCredit',
    profile: {
      dateFormat: 'auto',
      amountSign: 'signed',
      columns: { date: '日期', debit: '借方金額', credit: '貸方金額', description: '摘要' },
    },
  },
  {
    labelKey: 'features.reconciliation.templates.creditCard',
    profile: {
      dateFormat: 'auto',
      amountSign: 'credit_card',
      columns: { date: '消費日', amount: '新台幣金額', description: '消費明細' },
    },
  },
];

/** 對帳頁面可選的日期格式（`auto` 之外者需與解析器支援清單一致）。 */
export const RECONCILIATION_DATE_FORMATS: ReconciliationDateFormat[] = [
  'auto',
  'YYYY-MM-DD',
  'YYYY/MM/DD',
  'YYYYMMDD',
  'YYYY年MM月DD日',
  'MM/DD/YYYY',
  'DD/MM/YYYY',
  'DD-MM-YYYY',
];

/** 差異類型 → i18n 標籤鍵。 */
export const RECONCILIATION_DIFF_LABEL_KEYS: Record<ReconciliationDiffKind, string> = {
  ledger_only: 'features.reconciliation.diff.ledgerOnly',
  statement_only: 'features.reconciliation.diff.statementOnly',
  amount_mismatch: 'features.reconciliation.diff.amountMismatch',
};

/** 來源類型 → i18n 標籤鍵。 */
export const RECONCILIATION_SOURCE_LABEL_KEYS: Record<ReconciliationSourceKind, string> = {
  bank: 'features.reconciliation.source.bank',
  credit_card: 'features.reconciliation.source.creditCard',
  investment: 'features.reconciliation.source.investment',
};

/** 差異類型 → Tailwind badge 樣式（沿用既有 Badge 色彩語彙）。 */
export const RECONCILIATION_DIFF_BADGE_CLASSES: Record<ReconciliationDiffKind, string> = {
  amount_mismatch: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  statement_only: 'bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-200',
  ledger_only: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-200',
};

/** 對帳檔可接受的副檔名（前端先擋，後端仍會重新驗證內容）。 */
export const RECONCILIATION_ACCEPT_EXTENSIONS = '.ofx,.qfx,.csv,.txt';

/** 依副檔名推斷上傳格式，無法判定時回傳 `csv`。 */
export function detectReconciliationFormat(filename: string): 'ofx' | 'csv' {
  const lower = String(filename || '').toLowerCase();
  if (lower.endsWith('.ofx') || lower.endsWith('.qfx')) return 'ofx';
  return 'csv';
}

/** 驗證 profile 是否可送出（與後端 parseReconciliationCsv 的前置檢查一致）。 */
export function validateReconciliationProfile(
  profile: ReconciliationCsvProfile,
): 'missingDate' | 'missingAmount' | 'conflictingAmount' | null {
  const { columns } = profile;
  if (!columns?.date) return 'missingDate';
  const hasSplit = Boolean(columns.debit || columns.credit);
  if (columns.amount && hasSplit) return 'conflictingAmount';
  if (!columns.amount && !hasSplit) return 'missingAmount';
  return null;
}

/**
 * 以目前輸入的樣板 + 使用者覆寫建立 profile 物件。
 *
 * 只帶入非空白的欄位，避免把空字串當成「對應到名稱為空的欄位」送出。
 */
export function buildReconciliationProfile(input: {
  dateFormat: ReconciliationDateFormat;
  amountSign: 'signed' | 'credit_card';
  delimiter: string;
  skipRows: number;
  hasHeader: boolean;
  date: string;
  amount: string;
  debit: string;
  credit: string;
  description: string;
  fitid: string;
}): ReconciliationCsvProfile {
  const optional = (value: string) => (value.trim() ? value.trim() : undefined);
  return {
    delimiter: input.delimiter || ',',
    hasHeader: input.hasHeader,
    skipRows: Math.max(0, Number(input.skipRows) || 0),
    dateFormat: input.dateFormat,
    amountSign: input.amountSign,
    columns: {
      date: input.date.trim(),
      amount: optional(input.amount),
      debit: optional(input.debit),
      credit: optional(input.credit),
      description: optional(input.description),
      fitid: optional(input.fitid),
    },
  };
}

/** 差異項目在表格中的顯示形狀（由 API 回應轉成 UI 需要的欄位）。 */
export interface ReconciliationDiffRow {
  id: string;
  kind: ReconciliationDiffKind;
  confidence: string;
  date: string;
  ledgerAmount: number;
  statementAmount: number;
  difference: number;
  ledgerDescription: string;
  statementDescription: string;
  statementLine: number;
  ledgerId: string;
}

/** 依差異類型分組，順序固定為金額不符 → 對帳單有帳本無 → 帳本有對帳單無。 */
export function groupReconciliationDiffs(
  rows: ReconciliationDiffRow[],
): Array<{ kind: ReconciliationDiffKind; rows: ReconciliationDiffRow[] }> {
  const order: ReconciliationDiffKind[] = ['amount_mismatch', 'statement_only', 'ledger_only'];
  return order.map((kind) => ({ kind, rows: rows.filter((row) => row.kind === kind) }));
}
