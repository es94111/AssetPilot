// lib/recurringDetection.ts — 固定收支智慧偵測（issue #252）
//
// 純函式模組：從既有交易找出「疑似週期性」的群組並建議轉為固定收支，不接觸
// 資料庫、不引入外部 AI 服務。輸出僅為提示，寫入與否一律由使用者確認。
//
// 分群鍵：類型 + 分類 + 帳戶 + 幣別 + 金額。TWD 交易以本幣金額分群；外幣交易以原幣
// 金額分群（匯率波動不會拆散同一筆固定外幣帳單）。建議表單使用最新交易匯率預填。
//
// 週期判定：取相鄰日期的中位數間隔，並要求間隔離散度低（每個間隔都必須落在
// 週期容差內），避免把「一個月內密集消費 2 次」誤判為每月週期。

import { getNextRecurringDate } from './recurringSchedule';

export type DetectedFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

/** 群組內最多分析的交易筆數（取最近 N 筆，控制計算量）。 */
const MAX_OCCURRENCES_PER_GROUP = 24;

/** 每個週期至少需要的間隔數（= 至少 3 筆交易）。 */
const MIN_INTERVALS = 2;

/**
 * 證據量係數的分母：間隔數達此值才取得完整信心。
 * 2 個間隔（3 筆交易，最短可偵測長度）→ 0.67，仍足以跨過提示門檻；
 * 3 個間隔（4 筆交易）以上 → 1。
 */
const EVIDENCE_FULL_INTERVAL_COUNT = 3;

/** 各週期的標準間隔天數與可接受的個別間隔容差（天）。 */
const FREQUENCY_RULES: Array<{ frequency: DetectedFrequency; days: number; tolerance: number }> = [
  { frequency: 'daily', days: 1, tolerance: 1 },
  { frequency: 'weekly', days: 7, tolerance: 2 },
  { frequency: 'monthly', days: 30, tolerance: 5 },
  { frequency: 'yearly', days: 365, tolerance: 21 },
];

/** 信心度最低門檻：低於此值不提示，避免疲勞轟炸。 */
export const RECURRING_DETECTION_MIN_CONFIDENCE = 0.5;

/** 預設最多回傳的建議筆數。 */
export const RECURRING_DETECTION_DEFAULT_LIMIT = 5;

export interface DetectionTransaction {
  id: string;
  /** 僅 'income' 與 'expense' 會參與偵測。 */
  type: string;
  /** 本幣金額的整數部分（同群組需完全相同）。 */
  amount: number;
  date: string;
  categoryId: string | null;
  accountId: string | null;
  note: string;
  /** 金額欄位為 TWD，用於固定收支群組比對。 */
  originalAmount?: number;
  currency?: string;
  fxRate?: string | number;
}

export interface DetectedRecurringSuggestion {
  categoryId: string | null;
  categoryName: string | null;
  accountId: string | null;
  accountName: string | null;
  type: 'income' | 'expense';
  /** 本幣（TWD）金額，用於顯示與固定收支分群。 */
  amount: number;
  /** 依最近一筆交易的幣別與原幣金額預填表單。 */
  suggestedAmount: number;
  currency: string;
  fxRate: string;
  frequency: DetectedFrequency;
  /** 0～1（四捨五入至小數兩位）。 */
  confidence: number;
  occurrences: number;
  firstDate: string;
  lastDate: string;
  /** 群組中最新的交易摘要，作為建議的預設備註。 */
  sampleNote: string;
  /** 群組中最新一筆交易 ID，供使用者確認時追溯來源。 */
  latestTransactionId: string;
  /** 建議的固定收支起始日（= 最近一筆已觀察交易之後的下一個週期），避免回補歷史交易。 */
  suggestedStartDate: string;
  /** 參與此群組的交易 ID（由舊到新），供呼叫端追溯與除錯。 */
  transactionIds: string[];
}

export interface DetectRecurringInput {
  transactions: DetectionTransaction[];
  /** 目前日期（YYYY-MM-DD）；用於排除尚未到期的未來交易與計算最近性。 */
  today?: string;
  limit?: number;
}

function parseIsoDate(value: string): number | null {
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const ms = Date.UTC(year, month - 1, day);
  const back = new Date(ms);
  if (back.getUTCFullYear() !== year || back.getUTCMonth() !== month - 1 || back.getUTCDate() !== day) {
    return null;
  }
  return ms;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function groupKey(tx: DetectionTransaction): string {
  const currency = String(tx.currency || 'TWD').toUpperCase();
  const comparisonAmount = currency !== 'TWD' && Number(tx.originalAmount) > 0
    ? Math.round(Number(tx.originalAmount) * 100) / 100
    : Math.round(Number(tx.amount) || 0);
  return [
    tx.type,
    tx.categoryId ?? '',
    tx.accountId ?? '',
    currency,
    String(comparisonAmount),
  ].join('|');
}

function recurringIdentity(item: {
  type: string;
  categoryId: string | null;
  accountId: string | null;
  currency?: string | null;
}): string {
  return [item.type, item.categoryId ?? '', item.accountId ?? '', String(item.currency || 'TWD').toUpperCase()].join('|');
}

function comparableAmount(item: {
  amount: number;
  suggestedAmount?: number;
  currency?: string | null;
  fxRate?: string | number | null;
}): number {
  const currency = String(item.currency || 'TWD').toUpperCase();
  if (currency === 'TWD') return Math.round(Number(item.amount) || 0);
  if (Number(item.suggestedAmount) > 0) {
    return Math.round(Number(item.suggestedAmount) * 100) / 100;
  }
  const rate = Number(item.fxRate) || 1;
  const originalAmount = (Number(item.amount) || 0) / rate;
  return Math.round(originalAmount * 100) / 100;
}

interface FrequencyMatch {
  frequency: DetectedFrequency;
  confidence: number;
}

/** 以間隔陣列判定週期；無法穩定對應任何週期時回傳 null。 */
export function matchFrequency(intervalDays: number[]): FrequencyMatch | null {
  if (intervalDays.length < MIN_INTERVALS) return null;
  const medianInterval = median(intervalDays);
  if (!Number.isFinite(medianInterval) || medianInterval <= 0) return null;

  let best: FrequencyMatch | null = null;
  for (const rule of FREQUENCY_RULES) {
    // 以中位數間隔挑選最貼近的週期規則，再要求每個間隔都落在容差內。
    const deviation = Math.abs(medianInterval - rule.days);
    if (deviation > rule.tolerance) continue;
    const spacingFit = 1 - Math.min(1, deviation / rule.tolerance);
    const intervalFit = intervalDays.reduce((sum, value) => {
      const error = Math.min(1, Math.abs(value - rule.days) / rule.tolerance);
      return sum + (1 - error);
    }, 0) / intervalDays.length;
    const regularity = 0.5 * spacingFit + 0.5 * intervalFit;

    // 證據量係數：3 個以上間隔（4 筆交易）才取得完整信心。
    const evidenceFactor = Math.min(1, intervalDays.length / EVIDENCE_FULL_INTERVAL_COUNT);
    const confidence = Math.max(0, Math.min(1, regularity * evidenceFactor));
    if (!best || confidence > best.confidence) best = { frequency: rule.frequency, confidence };
  }
  return best;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * 掃描交易並回傳疑似週期性群組（依信心度遞減排序）。
 * 相同輸入恆得相同輸出；未來日期（晚於 today）一律排除。
 */
export function detectRecurringPatterns(input: DetectRecurringInput): DetectedRecurringSuggestion[] {
  const limit = Math.max(1, Math.min(input.limit ?? RECURRING_DETECTION_DEFAULT_LIMIT, 2000));
  const cutoff = input.today ? parseIsoDate(input.today) : null;

  const groups = new Map<string, DetectionTransaction[]>();
  for (const tx of input.transactions) {
    if (tx.type !== 'income' && tx.type !== 'expense') continue;
    const amount = Math.round(Number(tx.amount) || 0);
    if (!(amount > 0)) continue;
    const ms = parseIsoDate(tx.date);
    if (ms == null) continue;
    if (cutoff != null && ms > cutoff) continue;
    const key = groupKey(tx);
    const bucket = groups.get(key);
    if (bucket) bucket.push(tx);
    else groups.set(key, [tx]);
  }

  const suggestions: DetectedRecurringSuggestion[] = [];
  for (const bucket of groups.values()) {
    const ordered = [...bucket].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const occurrences = ordered.slice(-MAX_OCCURRENCES_PER_GROUP);
    if (occurrences.length < MIN_INTERVALS + 1) continue;

    const intervals: number[] = [];
    for (let i = 1; i < occurrences.length; i += 1) {
      const previous = parseIsoDate(occurrences[i - 1].date);
      const current = parseIsoDate(occurrences[i].date);
      if (previous == null || current == null) {
        intervals.length = 0;
        break;
      }
      intervals.push(Math.round((current - previous) / 86_400_000));
    }
    if (intervals.length < MIN_INTERVALS) continue;

    const match = matchFrequency(intervals);
    if (!match || match.confidence < RECURRING_DETECTION_MIN_CONFIDENCE) continue;

    // Require recent activity in addition to a stable historical cadence. Otherwise
    // an old daily pattern could be mistaken for an active recipe and backfill years
    // of duplicate transactions when the user confirms it.
    if (cutoff != null) {
      const latestMs = parseIsoDate(occurrences[occurrences.length - 1].date);
      const rule = FREQUENCY_RULES.find((candidate) => candidate.frequency === match.frequency);
      if (latestMs == null || !rule) continue;
      const ageDays = Math.max(0, Math.round((cutoff - latestMs) / 86_400_000));
      const maxStalenessDays = rule.days * 1.5 + rule.tolerance;
      if (ageDays > maxStalenessDays) continue;
    }

    const latest = occurrences[occurrences.length - 1];
    suggestions.push({
      categoryId: latest.categoryId,
      categoryName: null,
      accountId: latest.accountId,
      accountName: null,
      type: latest.type as 'income' | 'expense',
      amount: Math.round(Number(latest.amount) || 0),
      suggestedAmount: Number(latest.originalAmount) > 0
        ? Math.round(Number(latest.originalAmount) * 100) / 100
        : Math.round(Number(latest.amount) || 0),
      currency: String(latest.currency || 'TWD').toUpperCase(),
      fxRate: String(latest.fxRate || '1'),
      frequency: match.frequency,
      confidence: round2(match.confidence),
      occurrences: occurrences.length,
      firstDate: occurrences[0].date,
      lastDate: latest.date,
      sampleNote: String(latest.note || ''),
      latestTransactionId: latest.id,
      suggestedStartDate: getNextRecurringDate(latest.date, match.frequency) || latest.date,
      transactionIds: occurrences.map((tx) => tx.id),
    });
  }

  return suggestions
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences;
      if (b.amount !== a.amount) return b.amount - a.amount;
      return String(a.categoryId ?? '').localeCompare(String(b.categoryId ?? ''));
    })
    .slice(0, limit);
}

/**
 * 依既有固定收支排除「已經是固定收支」的建議，避免重複提示。
 * 比對鍵：類型 + 分類 + 帳戶 + 金額（與偵測分群鍵一致）。
 */
export function filterExistingRecurring(
  suggestions: DetectedRecurringSuggestion[],
  existing: Array<{
    type: string;
    amount: number;
    categoryId: string | null;
    accountId: string | null;
    currency?: string | null;
    fxRate?: string | number | null;
  }>,
): DetectedRecurringSuggestion[] {
  const existingByIdentity = new Map<string, Array<{ amount: number; tolerance: number }>>();
  for (const item of existing) {
    const key = recurringIdentity(item);
    const candidates = existingByIdentity.get(key) ?? [];
    const rate = Number(item.fxRate) || 1;
    const tolerance = String(item.currency || 'TWD').toUpperCase() === 'TWD'
      ? 0
      // Existing recurring.amount is stored as whole TWD; reverse conversion
      // can differ by at most half a TWD unit plus one cent of source precision.
      : 0.5 / rate + 0.01;
    candidates.push({ amount: comparableAmount(item), tolerance });
    existingByIdentity.set(key, candidates);
  }

  return suggestions.filter((suggestion) => {
    const candidates = existingByIdentity.get(recurringIdentity(suggestion));
    if (!candidates) return true;
    const amount = comparableAmount(suggestion);
    return !candidates.some((candidate) => Math.abs(candidate.amount - amount) <= candidate.tolerance);
  });
}
