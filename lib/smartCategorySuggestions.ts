// lib/smartCategorySuggestions.ts — 交易分類建議（issue #252）
//
// 純函式模組：只做「依交易摘要與歷史紀錄推薦分類」的計算，不接觸資料庫、
// 不引入任何外部 AI 服務。所有輸入（歷史紀錄、候選分類）由呼叫端提供，
// 因此可完整單元測試（tests/lib/smartCategorySuggestions.test.ts）。
//
// 設計原則（可解釋、可重現）：
// 1. 只在「本次摘要與某筆歷史摘要真的有詞彙交集」時才產生建議；沒有交集
//    就回傳空陣列（例如摘要空白、全新使用者），不對使用者瞎猜。
// 2. 分數 = 0.8 × 加權摘要相似度 + 0.2 × 該分類在命中筆數中的佔比，
//    再乘上「證據量」係數（1 筆歷史不足以高信心）。
// 3. 同分時以分類名稱排序，確保輸出穩定（相同輸入恆得相同順序）。

/** 信心度最低門檻：低於此值不顯示，避免雜訊干擾使用者。 */
export const SUGGESTION_MIN_CONFIDENCE = 0.2;

/** 預設回傳筆數（Top-N）。 */
export const SUGGESTION_DEFAULT_LIMIT = 3;

/** 相似度加權的時間半衰期（天）：越近期的歷史越有參考價值。 */
const RECENCY_HALF_LIFE_DAYS = 180;

/** 證據量係數的分母：命中筆數達此值才取得完整分數。 */
const EVIDENCE_FULL_HIT_COUNT = 3;

/** 摘要長度上限：避免超長備註拖慢詞彙比對（備註本身上限為 200 字元）。 */
const NOTE_TOKEN_INPUT_MAX_LENGTH = 200;

export interface SuggestionHistoryEntry {
  /** 歷史交易所指派的子分類 ID（僅 leaf 分類會被納入）。 */
  categoryId: string;
  /** 歷史交易摘要。 */
  note: string;
  /** 歷史交易日期（YYYY-MM-DD）。 */
  date: string;
}

export interface SuggestionCandidateCategory {
  id: string;
  name: string;
  /** 空字串或 null 代表父分類；父分類不會被建議（交易僅能指派至子分類）。 */
  parentId?: string | null;
  parentName?: string | null;
}

export interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  parentName: string | null;
  /** 0～1（四捨五入至小數兩位），僅為提示強度，不代表正確機率。 */
  confidence: number;
  /** 支持此建議的歷史交易筆數，用於向使用者說明依據。 */
  matchedCount: number;
}

export interface SuggestCategoriesInput {
  /** 本次交易的摘要。 */
  note: string;
  /** 本次交易的類型；歷史紀錄須為同類型才會被採用。 */
  type: 'income' | 'expense';
  /** 歷史交易（已由呼叫端依 user_id／帳本範圍過濾，僅含 income／expense）。 */
  history: SuggestionHistoryEntry[];
  /** 候選分類（僅含 leaf 子分類）。 */
  categories: SuggestionCandidateCategory[];
  /** 目前時間（YYYY-MM-DD），用於計算時間衰減；未提供時不做衰減。 */
  today?: string;
  limit?: number;
}

const CJK_RANGE = /[\u3400-\u4dbf\u4e00-\u9fff\u3040-\u30ff\uff66-\uff9f\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/;

function isCjkChar(ch: string): boolean {
  return CJK_RANGE.test(ch);
}

function isLatinOrDigit(ch: string): boolean {
  return /[0-9a-z]/i.test(ch);
}

/**
 * 將摘要切為詞彙集合。
 * - 拉丁字母／數字：連續片段視為一個詞（小寫化）。
 * - CJK：單字與相鄰二字（bigram）皆納入，讓「早餐店」能與「早餐」產生交集。
 */
export function tokenizeNote(note: string): string[] {
  const normalized = String(note ?? '').toLowerCase().slice(0, NOTE_TOKEN_INPUT_MAX_LENGTH);
  const tokens = new Set<string>();
  let latin = '';
  let cjkRun: string[] = [];

  const flushLatin = () => {
    if (latin) tokens.add(latin);
    latin = '';
  };
  const flushCjk = () => {
    for (let i = 0; i < cjkRun.length; i += 1) {
      tokens.add(cjkRun[i]);
      if (i + 1 < cjkRun.length) tokens.add(cjkRun[i] + cjkRun[i + 1]);
    }
    cjkRun = [];
  };

  for (const ch of normalized) {
    if (isCjkChar(ch)) {
      flushLatin();
      cjkRun.push(ch);
    } else if (isLatinOrDigit(ch)) {
      flushCjk();
      latin += ch;
    } else {
      flushLatin();
      flushCjk();
    }
  }
  flushLatin();
  flushCjk();

  return [...tokens];
}

/** Dice 係數（0～1）：2|A∩B| / (|A|+|B|)，空集合回傳 0。 */
export function diceCoefficient(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let intersection = 0;
  for (const token of new Set(a)) {
    if (setB.has(token)) intersection += 1;
  }
  return (2 * intersection) / (new Set(a).size + setB.size);
}

/** 以 YYYY-MM-DD 計算天數差；無法解析時回傳 null。 */
function daysBetween(fromIso: string, toIso: string): number | null {
  const parse = (value: string): number | null => {
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = Date.UTC(year, month - 1, day);
    const back = new Date(date);
    if (back.getUTCFullYear() !== year || back.getUTCMonth() !== month - 1 || back.getUTCDate() !== day) {
      return null;
    }
    return date;
  };
  const a = parse(fromIso);
  const b = parse(toIso);
  if (a == null || b == null) return null;
  return Math.round((b - a) / 86_400_000);
}

/** 時間衰減權重：半衰期 180 天；無法計算天數時視為 1（不衰減）。 */
function recencyWeight(entryDate: string, today?: string): number {
  if (!today) return 1;
  const age = daysBetween(entryDate, today);
  if (age == null) return 1;
  const positiveAge = Math.max(0, age);
  return 0.5 ** (positiveAge / RECENCY_HALF_LIFE_DAYS);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

interface CategoryAccumulator {
  weightedSimilarity: number;
  weightSum: number;
  matchedCount: number;
}

/**
 * 產生 Top-N 分類建議。
 * 回傳值依信心度遞減、再依分類名稱遞增排序；相同輸入恆得相同輸出。
 */
export function suggestCategories(input: SuggestCategoriesInput): CategorySuggestion[] {
  const limit = Math.max(1, Math.min(input.limit ?? SUGGESTION_DEFAULT_LIMIT, 10));
  const queryTokens = tokenizeNote(input.note);
  // 摘要沒有可用詞彙時不建議任何分類（保守、避免瞎猜）。
  if (queryTokens.length === 0) return [];

  const leafCategories = input.categories.filter(
    (category) => category.parentId != null && String(category.parentId) !== '',
  );
  if (leafCategories.length === 0) return [];
  const byId = new Map(leafCategories.map((category) => [category.id, category]));

  const accumulators = new Map<string, CategoryAccumulator>();
  for (const entry of input.history) {
    if (!entry?.categoryId || !byId.has(entry.categoryId)) continue;
    const similarity = diceCoefficient(queryTokens, tokenizeNote(entry.note));
    if (similarity <= 0) continue;
    const weight = recencyWeight(entry.date, input.today);
    const current = accumulators.get(entry.categoryId)
      ?? { weightedSimilarity: 0, weightSum: 0, matchedCount: 0 };
    current.weightedSimilarity += similarity * weight;
    current.weightSum += weight;
    current.matchedCount += 1;
    accumulators.set(entry.categoryId, current);
  }
  if (accumulators.size === 0) return [];

  const totalMatched = [...accumulators.values()].reduce((sum, item) => sum + item.matchedCount, 0);

  const scored = [...accumulators.entries()].map(([categoryId, accumulator]) => {
    const averageSimilarity = accumulator.weightSum > 0
      ? accumulator.weightedSimilarity / accumulator.weightSum
      : 0;
    const frequencyShare = totalMatched > 0 ? accumulator.matchedCount / totalMatched : 0;
    const evidenceFactor = Math.min(1, accumulator.matchedCount / EVIDENCE_FULL_HIT_COUNT);
    const score = (0.8 * averageSimilarity + 0.2 * frequencyShare) * evidenceFactor;
    return { categoryId, score, matchedCount: accumulator.matchedCount };
  });

  return scored
    .filter((item) => item.score >= SUGGESTION_MIN_CONFIDENCE)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const nameA = byId.get(a.categoryId)?.name ?? '';
      const nameB = byId.get(b.categoryId)?.name ?? '';
      if (nameA !== nameB) return nameA.localeCompare(nameB, 'zh-Hant');
      return a.categoryId.localeCompare(b.categoryId);
    })
    .slice(0, limit)
    .map((item): CategorySuggestion => {
      const category = byId.get(item.categoryId) as SuggestionCandidateCategory;
      const parentName = category.parentName == null || String(category.parentName) === ''
        ? null
        : String(category.parentName);
      return {
        categoryId: category.id,
        categoryName: category.name,
        parentName,
        confidence: round2(Math.min(1, item.score)),
        matchedCount: item.matchedCount,
      };
    });
}
