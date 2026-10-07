// lib/reconciliationMatch.ts — 帳本交易與對帳單交易的差異比對（純函式）。
//
// 三類差異（對應 issue #251 驗收條件）：
//  1. `ledger_only`  帳本有、對帳單無
//  2. `statement_only` 對帳單有、帳本無
//  3. `amount_mismatch` 金額不符
//
// 比對策略（保守、可解釋）：
//  - 第一輪以 FITID 精確配對（銀行／券商端識別碼最可靠，雙方都有時優先採用）。
//  - 第二輪在同日期窗口（預設 ±3 天，涵蓋入帳日與消費日差異）內，以「金額完全相同」
//    配對；多筆同金額時依序配對，確保結果穩定（以來源列號排序，不用物件迭代順序）。
//  - 第三輪把仍未被配對者配成金額不符候選（同方向、日期窗口內、最接近金額），
//    每筆最多配對一次。
//  - 其餘帳本列列為 `ledger_only`、對帳單列列為 `statement_only`。
//
// 本模組為純函式：不觸碰 DB、不寫稽核、不做授權判斷（呼叫端負責）。

/** 差異類型。 */
export type ReconciliationDiffKind = 'ledger_only' | 'statement_only' | 'amount_mismatch';

/** 配對信心度：`exact` 為識別碼或金額完全相符，`fuzzy` 為金額不符的推定配對。 */
export type ReconciliationMatchConfidence = 'exact' | 'fuzzy';

/** 帳本端參與比對的交易（由呼叫端自 `transactions` 表挑選後正規化）。 */
export interface LedgerReconciliationEntry {
  /** 交易列 id。 */
  id: string;
  /** 交易日 `YYYY-MM-DD`。 */
  date: string;
  /** 正值金額（TWD 等值，比照帳本的 `twd_amount`）。 */
  amount: number;
  /** 收支方向；轉出視為 debit、轉入視為 credit。 */
  direction: 'debit' | 'credit';
  /** 顯示用摘要（分類／備註組合，由呼叫端決定）。 */
  description: string;
  /** 帳本端已保存的銀行／券商識別碼（若有）。 */
  fitid?: string;
}

/** 對帳單端參與比對的交易（由解析器產生）。 */
export interface StatementReconciliationEntry {
  /** 來源列號（1-based，供使用者回查原檔）。 */
  line: number;
  /** 交易日 `YYYY-MM-DD`。 */
  date: string;
  /** 正值金額。 */
  amount: number;
  /** 收支方向。 */
  direction: 'debit' | 'credit';
  /** 摘要。 */
  description: string;
  /** 銀行／券商端識別碼。 */
  fitid: string;
}

/** 單一差異項目。 */
export interface ReconciliationDiffItem {
  kind: ReconciliationDiffKind;
  confidence: ReconciliationMatchConfidence;
  /** 配對到的帳本交易 id；`statement_only` 時為空字串。 */
  ledgerId: string;
  /** 配對到的對帳單來源列號；`ledger_only` 時為 0。 */
  statementLine: number;
  date: string;
  direction: 'debit' | 'credit';
  /** 帳本端金額（`statement_only` 時為 0）。 */
  ledgerAmount: number;
  /** 對帳單端金額（`ledger_only` 時為 0）。 */
  statementAmount: number;
  /** 金額差異（帳本 − 對帳單）。 */
  difference: number;
  /** 帳本端摘要（`statement_only` 時為空字串）。 */
  ledgerDescription: string;
  /** 對帳單端摘要（`ledger_only` 時為空字串）。 */
  statementDescription: string;
}

export interface ReconciliationMatchResult {
  diffs: ReconciliationDiffItem[];
  /** 完全配對（識別碼或金額相符）的筆數。 */
  matchedCount: number;
  counts: {
    ledger_only: number;
    statement_only: number;
    amount_mismatch: number;
  };
  /** 帳本端總筆數（參與比對者）。 */
  ledgerTotal: number;
  /** 對帳單端總筆數（參與比對者）。 */
  statementTotal: number;
}

export interface ReconciliationMatchOptions {
  /** 日期配對窗口（天），雙向；預設 3 天。 */
  dateWindowDays?: number;
  /**
   * 「金額不符」推定配對的日期窗口（天）；預設 0（必須同日）。
   *
   * 刻意比 `dateWindowDays` 嚴格：日期窗口內的「金額不同」不足以證明是同一筆交易，
   * 若放寬到整個窗口，對帳單獨有的新消費會被誤判成帳本某筆的金額不符，反而掩蓋
   * 「對帳單有、帳本無」這個真正要提示使用者補登的差異。同日同方向且金額最接近者
   * 才是可信的推定，其餘一律歸為單邊缺漏。
   */
  amountMismatchWindowDays?: number;
}

/** 金額比較容差：對帳檔常有四捨五入差異，1 分以內視為相同。 */
const AMOUNT_EPSILON = 0.01;

function dayNumber(date: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return Number.NaN;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) / 86400000;
}

function daysBetween(a: string, b: string): number {
  return Math.abs(dayNumber(a) - dayNumber(b));
}

function amountsEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < AMOUNT_EPSILON;
}

/**
 * 比對帳本與對帳單交易，輸出三類差異清單。
 *
 * 輸入順序不影響結果：配對一律以「先 FITID、再日期＋金額、最後模糊」的固定順序進行，
 * 且同分候選以來源列號／帳本 id 排序後取首筆。
 */
export function matchReconciliation(
  ledgerEntries: LedgerReconciliationEntry[],
  statementEntries: StatementReconciliationEntry[],
  options: ReconciliationMatchOptions = {},
): ReconciliationMatchResult {
  const windowDays = Math.max(0, Number(options.dateWindowDays ?? 3) || 0);
  const mismatchWindowDays = Math.max(0, Number(options.amountMismatchWindowDays ?? 0) || 0);

  const sortedLedger = [...ledgerEntries].sort((a, b) =>
    a.date === b.date ? a.id.localeCompare(b.id) : a.date.localeCompare(b.date),
  );
  const sortedStatement = [...statementEntries].sort((a, b) =>
    a.date === b.date ? a.line - b.line : a.date.localeCompare(b.date),
  );

  const ledgerMatched = new Set<string>();
  const statementMatched = new Set<number>();
  const diffs: ReconciliationDiffItem[] = [];
  let matchedCount = 0;

  // ── 第一輪：FITID 精確配對 ──
  const ledgerByFitid = new Map<string, LedgerReconciliationEntry[]>();
  for (const entry of sortedLedger) {
    if (!entry.fitid) continue;
    const bucket = ledgerByFitid.get(entry.fitid);
    if (bucket) bucket.push(entry);
    else ledgerByFitid.set(entry.fitid, [entry]);
  }
  for (const statement of sortedStatement) {
    if (!statement.fitid) continue;
    const bucket = ledgerByFitid.get(statement.fitid);
    const counterpart = bucket?.find((entry) => !ledgerMatched.has(entry.id));
    if (!counterpart) continue;
    ledgerMatched.add(counterpart.id);
    statementMatched.add(statement.line);
    matchedCount += 1;
    if (!amountsEqual(counterpart.amount, statement.amount)) {
      diffs.push(buildDiff('amount_mismatch', 'exact', counterpart, statement));
    }
  }

  // ── 第二輪：日期窗口內同方向、金額完全相同 ──
  const exactCandidates = sortedStatement.filter((entry) => !statementMatched.has(entry.line));
  for (const statement of exactCandidates) {
    const counterpart = sortedLedger.find(
      (entry) =>
        !ledgerMatched.has(entry.id) &&
        entry.direction === statement.direction &&
        amountsEqual(entry.amount, statement.amount) &&
        daysBetween(entry.date, statement.date) <= windowDays,
    );
    if (!counterpart) continue;
    ledgerMatched.add(counterpart.id);
    statementMatched.add(statement.line);
    matchedCount += 1;
  }

  // ── 第三輪：同方向、金額不符推定窗口內最接近金額 → 金額不符 ──
  const fuzzyCandidates = sortedStatement.filter((entry) => !statementMatched.has(entry.line));
  for (const statement of fuzzyCandidates) {
    let best: LedgerReconciliationEntry | null = null;
    let bestGap = Number.POSITIVE_INFINITY;
    for (const entry of sortedLedger) {
      if (ledgerMatched.has(entry.id) || entry.direction !== statement.direction) continue;
      if (daysBetween(entry.date, statement.date) > mismatchWindowDays) continue;
      const gap = Math.abs(entry.amount - statement.amount);
      if (gap < bestGap || (gap === bestGap && best && entry.id.localeCompare(best.id) < 0)) {
        best = entry;
        bestGap = gap;
      }
    }
    if (!best) continue;
    ledgerMatched.add(best.id);
    statementMatched.add(statement.line);
    diffs.push(buildDiff('amount_mismatch', 'fuzzy', best, statement));
  }

  // ── 剩餘：單邊缺漏 ──
  for (const entry of sortedLedger) {
    if (ledgerMatched.has(entry.id)) continue;
    diffs.push(buildDiff('ledger_only', 'exact', entry, null));
  }
  for (const statement of sortedStatement) {
    if (statementMatched.has(statement.line)) continue;
    diffs.push(buildDiff('statement_only', 'exact', null, statement));
  }

  const counts = {
    ledger_only: diffs.filter((diff) => diff.kind === 'ledger_only').length,
    statement_only: diffs.filter((diff) => diff.kind === 'statement_only').length,
    amount_mismatch: diffs.filter((diff) => diff.kind === 'amount_mismatch').length,
  };

  return {
    diffs,
    matchedCount,
    counts,
    ledgerTotal: sortedLedger.length,
    statementTotal: sortedStatement.length,
  };
}

function buildDiff(
  kind: ReconciliationDiffKind,
  confidence: ReconciliationMatchConfidence,
  ledger: LedgerReconciliationEntry | null,
  statement: StatementReconciliationEntry | null,
): ReconciliationDiffItem {
  const ledgerAmount = ledger ? ledger.amount : 0;
  const statementAmount = statement ? statement.amount : 0;
  return {
    kind,
    confidence,
    ledgerId: ledger ? ledger.id : '',
    statementLine: statement ? statement.line : 0,
    date: (ledger || statement)!.date,
    direction: (ledger || statement)!.direction,
    ledgerAmount,
    statementAmount,
    difference: statement ? Math.round((ledgerAmount - statementAmount) * 100) / 100 : 0,
    ledgerDescription: ledger ? ledger.description : '',
    statementDescription: statement ? statement.description : '',
  };
}
