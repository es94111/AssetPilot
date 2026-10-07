// lib/reconciliationStore.ts — 對帳匯入／比對的共用核心（授權與稽核由呼叫端負責）。
//
// 與 app/api/transactions/import 相同模式：
//  - 解析與比對先在記憶體完成，只有在全部列都合法時才開始 DB transaction，
//    任何一步失敗即整批 ROLLBACK（原子化，不留下半套資料）。
//  - 匯入前先檢查帳本寫入權限與互斥鎖，避免同一使用者同時匯入造成重複列。
//  - 成功與失敗皆寫入 data_operation_audit_log（metadata 受 AUDIT_METADATA_ALLOWED_KEYS 白名單限制）。
import { getDB, queryAll, queryOne, saveDB } from "./db";
import { uid } from "./userDefaults";
import type {
  LedgerReconciliationEntry,
  StatementReconciliationEntry,
  ReconciliationMatchResult,
} from "./reconciliationMatch";
import type {
  ReconciliationCsvProfile,
  ReconciliationCsvRow,
} from "./csvReconciliationParser";
import type { OfxTransaction } from "./ofxParser";

/** 對帳匯入來源種類。 */
export type ReconciliationSourceKind = "bank" | "credit_card" | "investment";

/** 對帳匯入來源格式。 */
export type ReconciliationSourceFormat = "ofx" | "csv";

/** 對帳單端交易 + 來源列號（OFX 沒有列號，以 1-based 序號代替）。 */
export interface ReconciliationStatementEntry extends StatementReconciliationEntry {
  /** 來源類型（OFX 多帳戶聲明時逐筆記錄）。 */
  sourceKind: ReconciliationSourceKind;
}

export interface ReconciliationSessionRecord {
  id: string;
  user_id: string;
  ledger_id: string;
  account_id: string;
  source_kind: string;
  source_format: string;
  filename: string;
  profile_id: string;
  currency: string;
  period_start: string;
  period_end: string;
  statement_total: number;
  ledger_total: number;
  matched_count: number;
  ledger_only_count: number;
  statement_only_count: number;
  amount_mismatch_count: number;
  skipped_types: string;
  created_at: number;
}

export interface ReconciliationItemRecord {
  id: string;
  session_id: string;
  user_id: string;
  kind: string;
  confidence: string;
  ledger_id: string;
  statement_line: number;
  date: string;
  direction: string;
  ledger_amount: number | string;
  statement_amount: number | string;
  difference: number | string;
  ledger_description: string;
  statement_description: string;
  created_at: number;
}

export const RECONCILIATION_MAX_ROWS = 20000;

/**
 * 對帳檔內容長度上限（字元數）。
 *
 * 與 `RECONCILIATION_MAX_ROWS` 互補：筆數上限擋的是「解析後的列數」，但單一列可以
 * 挾帶極長內容在解析階段就吃掉記憶體，因此另訂內容長度上限（25MB 等級，比照既有
 * CSV 匯入端點的 body 上限）。伺服器端在解析前先檢查，避免先建出巨型字串再判超量。
 */
export const RECONCILIATION_MAX_CONTENT_CHARS = 25 * 1024 * 1024;

/** 將 OFX 交易轉為對帳單端比對項目（`amount` 恆為正值）。 */
export function ofxTransactionsToStatementEntries(
  transactions: OfxTransaction[],
  sourceKind: ReconciliationSourceKind,
): ReconciliationStatementEntry[] {
  return transactions.map((tx, index) => ({
    line: index + 1,
    date: tx.date,
    amount: tx.amount,
    direction: tx.direction,
    description: tx.description,
    fitid: tx.fitid,
    sourceKind,
  }));
}

/** 將 CSV 列轉為對帳單端比對項目（`line` 沿用來源檔列號）。 */
export function csvRowsToStatementEntries(
  rows: ReconciliationCsvRow[],
  sourceKind: ReconciliationSourceKind,
): ReconciliationStatementEntry[] {
  return rows.map((row) => ({
    line: row.line,
    date: row.date,
    amount: row.amount,
    direction: row.direction,
    description: row.description,
    fitid: row.fitid,
    sourceKind,
  }));
}

/** 帳本 `transactions.type` → 對帳方向（轉出視為支出、轉入視為收入）。 */
function ledgerDirection(type: string): "debit" | "credit" {
  return type === "income" || type === "transfer_in" ? "credit" : "debit";
}

interface LedgerRow {
  id: string;
  date: string | null;
  type: string | null;
  twd_amount: number | string | null;
  amount: number | string | null;
  note: string | null;
  cat_name: string | null;
  account_id: string | null;
}

/**
 * 讀取帳本期間內的交易作為比對基準。
 *
 * 期間會依 `dateWindowDays` 雙向擴張：對帳單日期與帳本入帳日可能相差數天，若只讀
 * 對帳單日期範圍，邊界外的帳本交易會被誤判為「對帳單有、帳本無」。
 *
 * 統計口徑比照既有報表：以 `twd_amount`（台幣等值）為準；舊列可能為 0 或 NULL，
 * 此時退回 `amount`。已排除外幣手續費子交易（`is_fx_fee = 1`），因為它們在對帳單
 * 上是與主交易合併顯示的一筆扣款，逐筆比對會產生假性差異。
 */
export function loadLedgerEntries(
  userId: string,
  dateFrom: string,
  dateTo: string,
  accountId = "",
  windowDays = 3,
): LedgerReconciliationEntry[] {
  const shift = (date: string, days: number): string => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    if (!match) return date;
    const shifted = new Date(
      Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) +
        days * 86400000,
    );
    return shifted.toISOString().slice(0, 10);
  };
  const window = Math.max(0, Number(windowDays) || 0);

  const params: Array<string | number> = [userId];
  let where = "WHERE t.user_id = ? AND t.is_fx_fee = 0";
  if (dateFrom) {
    where += " AND t.date >= ?";
    params.push(shift(dateFrom, -window));
  }
  if (dateTo) {
    where += " AND t.date <= ?";
    params.push(shift(dateTo, window));
  }
  if (accountId) {
    where += " AND t.account_id = ?";
    params.push(accountId);
  }

  const rows = queryAll(
    `SELECT t.id, t.date, t.type, t.twd_amount, t.amount, t.note,
            c.name AS cat_name, t.account_id
     FROM transactions t
     LEFT JOIN categories c ON t.category_id = c.id
     ${where}
     ORDER BY t.date ASC, t.id ASC`,
    params,
  ) as unknown as LedgerRow[];

  return rows.map((row) => {
    const twd = Number(row.twd_amount);
    const amount =
      Number.isFinite(twd) && twd !== 0 ? twd : Number(row.amount) || 0;
    const description = [row.cat_name, row.note].filter(Boolean).join(" · ");
    return {
      id: String(row.id),
      date: String(row.date || ""),
      amount: Math.abs(amount),
      direction: ledgerDirection(String(row.type || "")),
      description: description.slice(0, 500),
    };
  });
}

/** 建立對帳 session 並寫入差異明細；呼叫端必須已開啟 transaction。 */
export function persistReconciliationResult(input: {
  userId: string;
  ledgerId: string;
  accountId: string;
  sourceKind: ReconciliationSourceKind;
  sourceFormat: ReconciliationSourceFormat;
  filename: string;
  profileId: string;
  currency: string;
  periodStart: string;
  periodEnd: string;
  skippedTypes: Record<string, number>;
  statementEntries: ReconciliationStatementEntry[];
  match: ReconciliationMatchResult;
}): string {
  const sessionId = uid();
  const now = Date.now();
  const db = getDB();

  db.run(
    `INSERT INTO reconciliation_sessions
     (id, user_id, ledger_id, account_id, source_kind, source_format, filename, profile_id, currency,
      period_start, period_end, statement_total, ledger_total, matched_count,
      ledger_only_count, statement_only_count, amount_mismatch_count, skipped_types, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      sessionId,
      input.userId,
      input.ledgerId,
      input.accountId,
      input.sourceKind,
      input.sourceFormat,
      input.filename.slice(0, 255),
      input.profileId.slice(0, 64),
      input.currency.slice(0, 8),
      input.periodStart,
      input.periodEnd,
      input.statementEntries.length,
      input.match.ledgerTotal,
      input.match.matchedCount,
      input.match.counts.ledger_only,
      input.match.counts.statement_only,
      input.match.counts.amount_mismatch,
      JSON.stringify(input.skippedTypes),
      now,
    ],
  );

  for (const diff of input.match.diffs) {
    db.run(
      `INSERT INTO reconciliation_items
       (id, session_id, user_id, kind, confidence, ledger_id, statement_line, date, direction,
        ledger_amount, statement_amount, difference, ledger_description, statement_description, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uid(),
        sessionId,
        input.userId,
        diff.kind,
        diff.confidence,
        diff.ledgerId,
        diff.statementLine,
        diff.date,
        diff.direction,
        diff.ledgerAmount,
        diff.statementAmount,
        diff.difference,
        diff.ledgerDescription.slice(0, 500),
        diff.statementDescription.slice(0, 500),
        now,
      ],
    );
  }

  return sessionId;
}

/** 讀取單一對帳 session（須符合 user_id 與 ledger_id，否則回傳 null）。 */
export function findReconciliationSession(
  userId: string,
  sessionId: string,
  ledgerId: string,
): ReconciliationSessionRecord | null {
  const row = queryOne(
    "SELECT * FROM reconciliation_sessions WHERE id = ? AND user_id = ? AND ledger_id = ?",
    [sessionId, userId, ledgerId],
  );
  return (row as unknown as ReconciliationSessionRecord) || null;
}

/** 讀取對帳差異明細（依類型排序，讓三類差異各自連續呈現）。 */
export function listReconciliationItems(
  userId: string,
  sessionId: string,
): ReconciliationItemRecord[] {
  const rows = queryAll(
    `SELECT * FROM reconciliation_items
     WHERE session_id = ? AND user_id = ?
     ORDER BY CASE kind
       WHEN 'amount_mismatch' THEN 0
       WHEN 'statement_only' THEN 1
       ELSE 2 END, date ASC, statement_line ASC, id ASC`,
    [sessionId, userId],
  );
  return rows as unknown as ReconciliationItemRecord[];
}

/** 讀取使用者的對帳 session 清單（最新在前）。 */
export function listReconciliationSessions(
  userId: string,
  ledgerId: string,
  limit = 20,
): ReconciliationSessionRecord[] {
  const rows = queryAll(
    `SELECT * FROM reconciliation_sessions
     WHERE user_id = ? AND ledger_id = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [userId, ledgerId, Math.max(1, Math.min(100, limit))],
  );
  return rows as unknown as ReconciliationSessionRecord[];
}

export interface ReconciliationProfileRecord {
  id: string;
  user_id: string;
  name: string;
  source: string;
  config: string;
  created_at: number;
  updated_at: number;
}

/** 讀取使用者的欄位對應 profile 清單。 */
export function listReconciliationProfiles(
  userId: string,
): ReconciliationProfileRecord[] {
  const rows = queryAll(
    "SELECT * FROM reconciliation_import_profiles WHERE user_id = ? ORDER BY updated_at DESC",
    [userId],
  );
  return rows as unknown as ReconciliationProfileRecord[];
}

/** 建立或更新欄位對應 profile（同名視為更新，避免使用者重複建立同名設定）。 */
export function upsertReconciliationProfile(input: {
  userId: string;
  name: string;
  profile: ReconciliationCsvProfile;
}): ReconciliationProfileRecord {
  const name = input.name.trim().slice(0, 100);
  if (!name) throw new Error("請提供欄位對應名稱");
  const now = Date.now();
  const existing = queryOne(
    "SELECT id FROM reconciliation_import_profiles WHERE user_id = ? AND name = ?",
    [input.userId, name],
  );
  const config = JSON.stringify(input.profile);
  if (existing) {
    getDB().run(
      "UPDATE reconciliation_import_profiles SET config = ?, updated_at = ? WHERE id = ? AND user_id = ?",
      [config, now, existing.id, input.userId],
    );
    saveDB();
  } else {
    getDB().run(
      "INSERT INTO reconciliation_import_profiles (id, user_id, name, source, config, created_at, updated_at) VALUES (?,?,?,?,?,?,?)",
      [uid(), input.userId, name, "csv", config, now, now],
    );
    saveDB();
  }
  const row = queryOne(
    "SELECT * FROM reconciliation_import_profiles WHERE user_id = ? AND name = ?",
    [input.userId, name],
  );
  return row as unknown as ReconciliationProfileRecord;
}

/** 刪除欄位對應 profile（限本人）。 */
export function deleteReconciliationProfile(
  userId: string,
  profileId: string,
): boolean {
  const existing = queryOne(
    "SELECT id FROM reconciliation_import_profiles WHERE id = ? AND user_id = ?",
    [profileId, userId],
  );
  if (!existing) return false;
  getDB().run(
    "DELETE FROM reconciliation_import_profiles WHERE id = ? AND user_id = ?",
    [profileId, userId],
  );
  saveDB();
  return true;
}

/** 解析 profile 的 `config` 欄位；格式異常時回傳 null（呼叫端據此回 400）。 */
export function parseProfileConfig(
  raw: string,
): ReconciliationCsvProfile | null {
  try {
    const parsed = JSON.parse(raw || "{}");
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.columns !== "object"
    )
      return null;
    return parsed as ReconciliationCsvProfile;
  } catch {
    return null;
  }
}
