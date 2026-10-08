// lib/smartAssist.ts — 分類建議／固定收支偵測的伺服器端組裝（issue #252）
//
// 這層負責「資料存取 + 組裝」，計算本身留在零相依的純模組：
//   - lib/smartCategorySuggestions.ts（分類建議）
//   - lib/recurringDetection.ts（週期偵測）
//
// 隱私邊界：所有查詢一律以 requireAuth 解析出的 userId 為範圍。個人帳本下
// userId === 本人；共享帳本下 userId 為帳本的 data_owner_id，因此成員只會
// 看到自己帳本內的歷史紀錄，建議不會跨帳本洩漏。

import { getDB, queryAll, queryOne, saveDB } from './db';
import { todayInUserTz } from './userTime';
import {
  suggestCategories,
  type CategorySuggestion,
  type SuggestionHistoryEntry,
} from './smartCategorySuggestions';
import {
  RECURRING_DETECTION_DEFAULT_LIMIT,
  detectRecurringPatterns,
  filterExistingRecurring,
  type DetectedRecurringSuggestion,
  type DetectionTransaction,
} from './recurringDetection';

/** 用於分類建議的歷史交易筆數上限（取最近 N 筆，控制查詢與計算量）。 */
const SUGGESTION_HISTORY_LIMIT = 500;

/** 用於週期偵測的歷史交易筆數上限。 */
const DETECTION_HISTORY_LIMIT = 2000;

/** 分類建議預設 Top-N。 */
export const CATEGORY_SUGGESTION_LIMIT = 3;

export interface CategorySuggestionResult {
  enabled: boolean;
  suggestions: CategorySuggestion[];
}

export interface RecurringSuggestionResult {
  enabled: boolean;
  suggestions: Array<DetectedRecurringSuggestion & { signature: string }>;
}

/**
 * 穩定識別一組「疑似固定收支」的簽章；使用者忽略後即以此記錄，
 * 之後同一組合（類型／分類／帳戶／幣別／金額）不再提示。
 */
export function recurringSuggestionSignature(input: {
  type: string;
  categoryId: string | null;
  accountId: string | null;
  amount: number;
  currency?: string | null;
  suggestedAmount?: number;
}): string {
  const currency = String(input.currency || 'TWD').toUpperCase();
  const signatureAmount = currency !== 'TWD' && Number(input.suggestedAmount) > 0
    ? Math.round(Number(input.suggestedAmount) * 100) / 100
    : Math.round(Number(input.amount) || 0);
  return [
    input.type,
    input.categoryId ?? '',
    input.accountId ?? '',
    currency,
    String(signatureAmount),
  ].join('|');
}

// ── 使用者設定 ──────────────────────────────────────────────

/** 讀取「智慧輔助」開關；預設開啟（使用者可在帳號設定關閉）。 */
export function isSmartAssistEnabled(userId: string): boolean {
  const row = queryOne('SELECT ai_assist_enabled FROM user_settings WHERE user_id = ?', [userId]);
  if (!row) return true;
  return Number(row.ai_assist_enabled ?? 1) !== 0;
}

/** 寫入「智慧輔助」開關。設定列在註冊時建立，故以 UPDATE 為主、缺列時補插。 */
export function setSmartAssistEnabled(userId: string, enabled: boolean): void {
  const now = Date.now();
  getDB().run(
    'UPDATE user_settings SET ai_assist_enabled = ?, updated_at = ? WHERE user_id = ?',
    [enabled ? 1 : 0, now, userId],
  );
  if (getDB().getRowsModified() === 0) {
    getDB().run(
      'INSERT INTO user_settings (user_id, pinned_currencies, default_currency, ai_assist_enabled, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (user_id) DO UPDATE SET ai_assist_enabled = EXCLUDED.ai_assist_enabled, updated_at = EXCLUDED.updated_at',
      [userId, '["TWD"]', 'TWD', enabled ? 1 : 0, now],
    );
  }
  saveDB();
}

// ── 分類建議 ────────────────────────────────────────────────

interface HistoryRow {
  category_id: string | null;
  note: string | null;
  date: string | null;
}

interface CategoryRow {
  id: string;
  name: string;
  parent_id: string | null;
  parent_name: string | null;
}

/**
 * 依「本次摘要 + 同類型歷史紀錄」產生子分類建議（Top-N）。
 * 只在真的有詞彙交集時才回傳結果；關閉開關或摘要為空時回傳空陣列。
 */
export function getCategorySuggestions(input: {
  userId: string;
  /** 由呼叫端解析（操作者本人的偏好）；未提供時自行查詢 userId 的設定。 */
  enabled?: boolean;
  userTimezone?: string;
  note: string;
  type: 'income' | 'expense';
  limit?: number;
}): CategorySuggestionResult {
  const enabled = input.enabled ?? isSmartAssistEnabled(input.userId);
  if (!enabled) return { enabled: false, suggestions: [] };
  const trimmedNote = String(input.note ?? '').trim();
  if (!trimmedNote) return { enabled: true, suggestions: [] };

  const historyRows = queryAll(
    `SELECT category_id, note, date FROM transactions
     WHERE user_id = ? AND type = ? AND category_id IS NOT NULL AND category_id != ''
       AND COALESCE(is_fx_fee, 0) = 0 AND COALESCE(note, '') != ''
     ORDER BY date DESC LIMIT ?`,
    [input.userId, input.type, SUGGESTION_HISTORY_LIMIT],
  ) as unknown as HistoryRow[];

  if (historyRows.length === 0) return { enabled: true, suggestions: [] };

  // 僅 leaf 子分類可承載交易；父分類透過 parent_name 一併回傳供 UI 顯示層級。
  const categoryRows = queryAll(
    `SELECT c.id AS id, c.name AS name, c.parent_id AS parent_id, p.name AS parent_name
     FROM categories c
     LEFT JOIN categories p ON p.id = c.parent_id AND p.user_id = c.user_id
     WHERE c.user_id = ? AND c.type = ? AND c.parent_id IS NOT NULL AND c.parent_id != ''`,
    [input.userId, input.type],
  ) as unknown as CategoryRow[];

  const history: SuggestionHistoryEntry[] = historyRows.map((row) => ({
    categoryId: String(row.category_id),
    note: String(row.note || ''),
    date: String(row.date || ''),
  }));

  return {
    enabled: true,
    suggestions: suggestCategories({
      note: trimmedNote,
      type: input.type,
      history,
      categories: categoryRows.map((row) => ({
        id: String(row.id),
        name: String(row.name),
        parentId: row.parent_id,
        parentName: row.parent_name,
      })),
      today: todayInUserTz(input.userTimezone || 'Asia/Taipei'),
      limit: input.limit ?? CATEGORY_SUGGESTION_LIMIT,
    }),
  };
}

// ── 固定收支偵測 ────────────────────────────────────────────

interface DetectionRow {
  id: string;
  type: string;
  amount: number | string | null;
  twd_amount: number | string | null;
  original_amount: number | string | null;
  currency: string | null;
  fx_rate: string | number | null;
  date: string;
  category_id: string | null;
  account_id: string | null;
  note: string | null;
}

function hasDismissalsTable(): boolean {
  const row = queryOne(
    "SELECT table_name FROM information_schema.tables WHERE table_name = 'recurring_suggestion_dismissals'",
  );
  return !!row;
}

/** 讀取使用者已忽略的建議簽章集合（跨帳本成員共用同一份忽略清單）。 */
export function getDismissedSignatures(userId: string): Set<string> {
  if (!hasDismissalsTable()) return new Set();
  const rows = queryAll(
    'SELECT signature FROM recurring_suggestion_dismissals WHERE user_id = ?',
    [userId],
  ) as unknown as Array<{ signature: string }>;
  return new Set(rows.map((row) => String(row.signature)));
}

/** 記錄使用者「不要提示這組」的決定；重複忽略同一簽章為幂等操作。 */
export function dismissRecurringSuggestion(userId: string, signature: string): void {
  getDB().run(
    `INSERT INTO recurring_suggestion_dismissals (user_id, signature, dismissed_at)
     VALUES (?, ?, ?)
     ON CONFLICT (user_id, signature) DO UPDATE SET dismissed_at = EXCLUDED.dismissed_at`,
    [userId, signature, Date.now()],
  );
  saveDB();
}

/**
 * 掃描既有交易找出疑似週期性群組，排除已是固定收支者與使用者已忽略者。
 */
export function getRecurringSuggestions(input: {
  userId: string;
  userTimezone: string;
  /** 由呼叫端解析（操作者本人的偏好）；未提供時自行查詢 userId 的設定。 */
  enabled?: boolean;
  limit?: number;
}): RecurringSuggestionResult {
  const enabled = input.enabled ?? isSmartAssistEnabled(input.userId);
  if (!enabled) return { enabled: false, suggestions: [] };

  const today = todayInUserTz(input.userTimezone || 'Asia/Taipei');
  const rows = queryAll(
    `SELECT id, type, amount, twd_amount, original_amount, currency, fx_rate, date, category_id, account_id, note
     FROM transactions
     WHERE user_id = ? AND type IN ('income', 'expense')
       AND COALESCE(is_fx_fee, 0) = 0 AND COALESCE(exclude_from_stats, 0) = 0
       AND date <= ?
     ORDER BY date DESC LIMIT ?`,
    [input.userId, today, DETECTION_HISTORY_LIMIT],
  ) as unknown as DetectionRow[];

  const transactions: DetectionTransaction[] = rows.map((row) => ({
    id: String(row.id),
    type: String(row.type),
    amount: Number(row.twd_amount) > 0
      ? Math.round(Number(row.twd_amount))
      : Math.round(Number(row.amount) || 0),
    originalAmount: Number(row.original_amount) || undefined,
    currency: String(row.currency || 'TWD'),
    fxRate: String(row.fx_rate || '1'),
    date: String(row.date),
    categoryId: row.category_id || null,
    accountId: row.account_id || null,
    note: String(row.note || ''),
  }));

  const existing = queryAll(
    'SELECT type, amount, category_id, account_id, currency, fx_rate FROM recurring WHERE user_id = ?',
    [input.userId],
  ) as unknown as Array<{
    type: string;
    amount: number;
    category_id: string | null;
    account_id: string | null;
    currency: string | null;
    fx_rate: string | number | null;
  }>;

  const detected = filterExistingRecurring(
    detectRecurringPatterns({
      transactions,
      today,
      // Fetch the full bounded history-derived candidate set first; remove existing/dismissed
      // groups before applying the UI Top-N limit below.
      limit: DETECTION_HISTORY_LIMIT,
    }),
    existing.map((row) => ({
      type: String(row.type),
      amount: Number(row.amount) || 0,
      categoryId: row.category_id || null,
      accountId: row.account_id || null,
      currency: row.currency || 'TWD',
      fxRate: row.fx_rate || '1',
    })),
  );

  const dismissed = getDismissedSignatures(input.userId);
  const maxSuggestions = Math.max(1, Math.min(input.limit ?? RECURRING_DETECTION_DEFAULT_LIMIT, 20));
  const categoryNames = new Map(
    (queryAll(
      'SELECT id, name FROM categories WHERE user_id = ?',
      [input.userId],
    ) as unknown as Array<{ id: string; name: string }>).map((row) => [String(row.id), String(row.name)]),
  );
  const accountNames = new Map(
    (queryAll(
      'SELECT id, name FROM accounts WHERE user_id = ?',
      [input.userId],
    ) as unknown as Array<{ id: string; name: string }>).map((row) => [String(row.id), String(row.name)]),
  );

  const suggestions = detected
    .map((suggestion) => ({
      ...suggestion,
      categoryName: suggestion.categoryId ? (categoryNames.get(suggestion.categoryId) ?? null) : null,
      accountName: suggestion.accountId ? (accountNames.get(suggestion.accountId) ?? null) : null,
      signature: recurringSuggestionSignature({
        type: suggestion.type,
        categoryId: suggestion.categoryId,
        accountId: suggestion.accountId,
        amount: suggestion.amount,
        currency: suggestion.currency,
        suggestedAmount: suggestion.suggestedAmount,
      }),
    }))
    .filter((suggestion) => !dismissed.has(suggestion.signature))
    .slice(0, maxSuggestions);

  return { enabled: true, suggestions };
}
