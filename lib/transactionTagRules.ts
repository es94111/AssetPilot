/**
 * 純模組（Issue #312）：交易標籤的名稱正規化、驗證與統計彙總。
 * 不得 import './db'，client 與單元測試皆可直接引用。
 */

export const TAG_NAME_MAX_LENGTH = 30;
export const TAG_MAX_PER_TRANSACTION = 20;
export const TAG_DEFAULT_COLOR = '#94a3b8';
/** v1 僅支援收入／支出；轉帳、信用卡還款、股利不支援標籤。 */
export const TAGGABLE_TYPES = new Set(['income', 'expense']);

export type TagMode = 'any' | 'all';

export function normalizeTagName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

/** 唯一性比對鍵：NFKC + trim + 不分大小寫。 */
export function tagNameKey(raw: unknown): string {
  return normalizeTagName(raw).toLowerCase();
}

export function isValidTagColor(c: unknown): c is string {
  return typeof c === 'string' && /^#[0-9A-Fa-f]{6}$/.test(c);
}

export function validateTagName(raw: unknown): { ok: true; name: string } | { ok: false; error: string } {
  const name = normalizeTagName(raw);
  if (!name) return { ok: false, error: '標籤名稱不可為空' };
  if (name.length > TAG_NAME_MAX_LENGTH) {
    return { ok: false, error: `標籤名稱最多 ${TAG_NAME_MAX_LENGTH} 字` };
  }
  return { ok: true, name };
}

export function parseTagMode(raw: unknown): TagMode {
  return String(raw || '').toLowerCase() === 'all' ? 'all' : 'any';
}

/** 去除重複並移除空值，保留原順序。 */
export function dedupeIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) return [];
  const seen = new Set<string>();
  for (const v of ids) {
    if (typeof v === 'string' && v.trim()) seen.add(v.trim());
  }
  return [...seen];
}

/**
 * 解析匯入／匯出的多標籤儲存格。支援「|」「,」「、」「;」分隔，亦容許舊版 JSON 陣列字串
 * （舊欄位 transactions.tags 預設為 '[]'）。
 */
export function parseTagCell(raw: unknown): string[] {
  const text = String(raw ?? '').trim();
  if (!text || text === '[]') return [];
  let parts: string[];
  if (text.startsWith('[')) {
    try {
      const arr = JSON.parse(text);
      parts = Array.isArray(arr) ? arr.map((v) => String(v)) : [];
    } catch {
      parts = text.split(/[|,、;；]/);
    }
  } else {
    parts = text.split(/[|,、;；]/);
  }
  const seen = new Map<string, string>();
  for (const p of parts) {
    const name = normalizeTagName(p);
    if (!name || name.length > TAG_NAME_MAX_LENGTH) continue;
    const key = name.toLowerCase();
    if (!seen.has(key)) seen.set(key, name);
  }
  return [...seen.values()].slice(0, TAG_MAX_PER_TRANSACTION);
}

/** 匯出用：以「|」串接；標籤名稱內的「|」以全形「｜」取代，確保可往返解析。 */
export function formatTagCell(names: string[]): string {
  return names.map((n) => n.replace(/\|/g, '｜')).join('|');
}

export interface TagStatLink {
  txId: string;
  tagId: string;
  type: 'income' | 'expense' | string;
  amount: number;
  month: string;
  categoryId: string | null;
}

export interface TagStatsResult {
  perTag: Array<{ tagId: string; expense: number; income: number; count: number }>;
  /** 去重後合計：每筆交易只計一次，不等於各標籤小計相加。 */
  combined: { expense: number; income: number; count: number };
  crossAnalysis: Array<{ month: string; categoryId: string | null; expense: number; income: number; count: number }>;
}

/**
 * 彙總標籤統計。links 為每個「交易×標籤」一列（已排除 exclude_from_stats 與非收支類型）。
 * - perTag：交易對其每個標籤各計一次。
 * - combined / crossAnalysis：依 tagIds 與 mode 先篩出符合的交易，再以交易為單位去重加總。
 */
export function aggregateTagStats(
  links: TagStatLink[],
  selectedTagIds: string[],
  mode: TagMode,
): TagStatsResult {
  const perTagMap = new Map<string, { expense: number; income: number; count: number }>();
  const txMap = new Map<string, { link: TagStatLink; tags: Set<string> }>();
  for (const l of links) {
    if (l.type !== 'income' && l.type !== 'expense') continue;
    const amt = Number(l.amount) || 0;
    const t = perTagMap.get(l.tagId) || { expense: 0, income: 0, count: 0 };
    if (l.type === 'expense') t.expense += amt; else t.income += amt;
    t.count += 1;
    perTagMap.set(l.tagId, t);
    const entry = txMap.get(l.txId);
    if (entry) entry.tags.add(l.tagId);
    else txMap.set(l.txId, { link: l, tags: new Set([l.tagId]) });
  }

  const selected = new Set(selectedTagIds);
  const combined = { expense: 0, income: 0, count: 0 };
  const crossMap = new Map<string, { month: string; categoryId: string | null; expense: number; income: number; count: number }>();
  for (const { link, tags } of txMap.values()) {
    if (selected.size > 0) {
      const matched = [...selected].filter((id) => tags.has(id)).length;
      const ok = mode === 'all' ? matched === selected.size : matched > 0;
      if (!ok) continue;
    }
    const amt = Number(link.amount) || 0;
    if (link.type === 'expense') combined.expense += amt; else combined.income += amt;
    combined.count += 1;
    const key = `${link.month}|${link.categoryId ?? ''}`;
    const c = crossMap.get(key) || { month: link.month, categoryId: link.categoryId, expense: 0, income: 0, count: 0 };
    if (link.type === 'expense') c.expense += amt; else c.income += amt;
    c.count += 1;
    crossMap.set(key, c);
  }

  const perTag = [...perTagMap.entries()]
    .map(([tagId, v]) => ({ tagId, ...v }))
    .filter((r) => selected.size === 0 || selected.has(r.tagId));
  const crossAnalysis = [...crossMap.values()].sort(
    (a, b) => a.month.localeCompare(b.month) || String(a.categoryId).localeCompare(String(b.categoryId)),
  );
  return { perTag, combined, crossAnalysis };
}
