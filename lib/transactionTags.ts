import { getDB, queryAll, queryOne } from './db';
import { uid } from './userDefaults';
import {
  TAGGABLE_TYPES,
  TAG_DEFAULT_COLOR,
  TAG_MAX_PER_TRANSACTION,
  dedupeIds,
  tagNameKey,
  type TagMode,
} from './transactionTagRules';

export interface TagDto {
  id: string;
  name: string;
  color: string;
  isActive: boolean;
}

type Row = Record<string, string | number | null>;

export class TagError extends Error {
  constructor(message: string, public code: string, public status = 400) {
    super(message);
  }
}

function toDto(r: Row): TagDto {
  return { id: String(r.id), name: String(r.name), color: String(r.color || TAG_DEFAULT_COLOR), isActive: Number(r.is_active) !== 0 };
}

export function listTags(userId: string): Array<TagDto & { usageCount: number }> {
  const rows = queryAll(
    `SELECT g.id, g.name, g.color, g.is_active,
       (SELECT COUNT(*) FROM transaction_tag_links l WHERE l.tag_id = g.id AND l.user_id = g.user_id) AS usage_count
     FROM transaction_tags g WHERE g.user_id = ? ORDER BY g.name_key`,
    [userId],
  ) as Row[];
  return rows.map((r) => ({ ...toDto(r), usageCount: Number(r.usage_count) || 0 }));
}

export function findTagByName(userId: string, name: string): TagDto | null {
  const r = queryOne('SELECT id, name, color, is_active FROM transaction_tags WHERE user_id = ? AND name_key = ?', [userId, tagNameKey(name)]) as Row | null;
  return r ? toDto(r) : null;
}

export function createTag(userId: string, name: string, color: string): TagDto {
  if (findTagByName(userId, name)) throw new TagError('標籤名稱已存在', 'TagNameDuplicate', 409);
  const id = uid();
  const now = Date.now();
  getDB().run(
    'INSERT INTO transaction_tags (id,user_id,name,name_key,color,is_active,created_at,updated_at) VALUES (?,?,?,?,?,1,?,?)',
    [id, userId, name, tagNameKey(name), color, now, now],
  );
  return { id, name, color, isActive: true };
}

export function updateTag(
  userId: string,
  id: string,
  patch: { name?: string; color?: string; isActive?: boolean },
): TagDto {
  const cur = queryOne('SELECT id, name, color, is_active FROM transaction_tags WHERE id = ? AND user_id = ?', [id, userId]) as Row | null;
  if (!cur) throw new TagError('標籤不存在', 'NotFound', 404);
  const name = patch.name ?? String(cur.name);
  if (patch.name != null) {
    const dup = findTagByName(userId, name);
    if (dup && dup.id !== id) throw new TagError('標籤名稱已存在', 'TagNameDuplicate', 409);
  }
  const color = patch.color ?? String(cur.color);
  const active = patch.isActive ?? Number(cur.is_active) !== 0;
  getDB().run(
    'UPDATE transaction_tags SET name=?, name_key=?, color=?, is_active=?, updated_at=? WHERE id=? AND user_id=?',
    [name, tagNameKey(name), color, active ? 1 : 0, Date.now(), id, userId],
  );
  return { id, name, color, isActive: active };
}

/** 刪除標籤僅移除關聯，絕不影響交易本身。回傳被移除的關聯數。 */
export function deleteTag(userId: string, id: string): number {
  const cur = queryOne('SELECT id FROM transaction_tags WHERE id = ? AND user_id = ?', [id, userId]);
  if (!cur) throw new TagError('標籤不存在', 'NotFound', 404);
  const cnt = Number((queryOne('SELECT COUNT(*) AS c FROM transaction_tag_links WHERE tag_id = ? AND user_id = ?', [id, userId]) as Row | null)?.c) || 0;
  const db = getDB();
  db.run('DELETE FROM transaction_tag_links WHERE tag_id = ? AND user_id = ?', [id, userId]);
  db.run('DELETE FROM transaction_tags WHERE id = ? AND user_id = ?', [id, userId]);
  return cnt;
}

/** 驗證標籤皆屬於此帳本（擋跨帳本 ID）；需要新增關聯時另要求標籤為啟用狀態。 */
export function assertTagsUsable(userId: string, tagIds: string[], requireActive: boolean): void {
  if (tagIds.length === 0) return;
  const ph = tagIds.map(() => '?').join(',');
  const rows = queryAll(`SELECT id, is_active FROM transaction_tags WHERE user_id = ? AND id IN (${ph})`, [userId, ...tagIds]) as Row[];
  if (rows.length !== tagIds.length) throw new TagError('標籤不存在或無權限', 'TagNotFound', 400);
  if (requireActive && rows.some((r) => Number(r.is_active) === 0)) {
    throw new TagError('標籤已停用，無法新增至交易', 'TagDisabled', 409);
  }
}

export function assertTaggableTransaction(userId: string, txId: string): void {
  const tx = queryOne('SELECT type, is_fx_fee FROM transactions WHERE id = ? AND user_id = ?', [txId, userId]) as Row | null;
  if (!tx) throw new TagError('交易不存在', 'NotFound', 404);
  if (!TAGGABLE_TYPES.has(String(tx.type)) || Number(tx.is_fx_fee) === 1) {
    throw new TagError('標籤僅支援收入與支出交易', 'TagUnsupportedType', 422);
  }
}

export function getTagIdsForTransaction(userId: string, txId: string): string[] {
  return (queryAll('SELECT tag_id FROM transaction_tag_links WHERE transaction_id = ? AND user_id = ?', [txId, userId]) as Row[]).map((r) => String(r.tag_id));
}

/** 完整取代一筆交易的標籤集合（已存在且停用的標籤可保留，不可新增）。 */
export function setTransactionTags(userId: string, txId: string, rawIds: unknown): string[] {
  const ids = dedupeIds(rawIds);
  if (ids.length > TAG_MAX_PER_TRANSACTION) {
    throw new TagError(`每筆交易最多 ${TAG_MAX_PER_TRANSACTION} 個標籤`, 'TagLimitExceeded', 400);
  }
  assertTaggableTransaction(userId, txId);
  const current = new Set(getTagIdsForTransaction(userId, txId));
  assertTagsUsable(userId, ids.filter((i) => !current.has(i)), true);
  assertTagsUsable(userId, ids.filter((i) => current.has(i)), false);
  const db = getDB();
  const next = new Set(ids);
  for (const id of current) {
    if (!next.has(id)) db.run('DELETE FROM transaction_tag_links WHERE transaction_id = ? AND tag_id = ? AND user_id = ?', [txId, id, userId]);
  }
  const now = Date.now();
  for (const id of ids) {
    if (!current.has(id)) {
      db.run('INSERT INTO transaction_tag_links (transaction_id,tag_id,user_id,created_at) VALUES (?,?,?,?) ON CONFLICT DO NOTHING', [txId, id, userId, now]);
    }
  }
  return ids;
}

/** 批次新增／移除；不可標籤的交易會被略過並回報。 */
export function batchChangeTags(
  userId: string,
  txIds: string[],
  rawTagIds: unknown,
  action: 'add' | 'remove',
): { changed: number; skipped: string[] } {
  const tagIds = dedupeIds(rawTagIds);
  if (tagIds.length === 0) throw new TagError('未選擇任何標籤', 'ValidationError', 400);
  assertTagsUsable(userId, tagIds, action === 'add');
  const db = getDB();
  const skipped: string[] = [];
  let changed = 0;
  const now = Date.now();
  for (const txId of txIds) {
    const tx = queryOne('SELECT type, is_fx_fee FROM transactions WHERE id = ? AND user_id = ?', [txId, userId]) as Row | null;
    if (!tx) throw new TagError('交易不存在', 'NotFound', 404);
    if (!TAGGABLE_TYPES.has(String(tx.type)) || Number(tx.is_fx_fee) === 1) { skipped.push(txId); continue; }
    if (action === 'add') {
      const have = new Set(getTagIdsForTransaction(userId, txId));
      if (have.size + tagIds.filter((i) => !have.has(i)).length > TAG_MAX_PER_TRANSACTION) { skipped.push(txId); continue; }
      for (const tagId of tagIds) {
        if (have.has(tagId)) continue;
        db.run('INSERT INTO transaction_tag_links (transaction_id,tag_id,user_id,created_at) VALUES (?,?,?,?) ON CONFLICT DO NOTHING', [txId, tagId, userId, now]);
        changed++;
      }
    } else {
      const ph = tagIds.map(() => '?').join(',');
      db.run(`DELETE FROM transaction_tag_links WHERE transaction_id = ? AND user_id = ? AND tag_id IN (${ph})`, [txId, userId, ...tagIds]);
      changed++;
    }
  }
  return { changed, skipped };
}

export function deleteLinksForTransactions(userId: string, txIds: string[]): void {
  const db = getDB();
  for (const id of txIds) db.run('DELETE FROM transaction_tag_links WHERE transaction_id = ? AND user_id = ?', [id, userId]);
}

export function getTagsForTransactions(userId: string, txIds: string[]): Map<string, TagDto[]> {
  const out = new Map<string, TagDto[]>();
  if (txIds.length === 0) return out;
  const ph = txIds.map(() => '?').join(',');
  const rows = queryAll(
    `SELECT l.transaction_id, g.id, g.name, g.color, g.is_active
     FROM transaction_tag_links l JOIN transaction_tags g ON g.id = l.tag_id AND g.user_id = l.user_id
     WHERE l.user_id = ? AND l.transaction_id IN (${ph}) ORDER BY g.name_key`,
    [userId, ...txIds],
  ) as Row[];
  for (const r of rows) {
    const k = String(r.transaction_id);
    const arr = out.get(k) || [];
    arr.push(toDto(r));
    out.set(k, arr);
  }
  return out;
}

/** 產生 Any/All 篩選 SQL 片段（作用於別名 t 的 transactions）。 */
export function buildTagFilter(tagIds: string[], mode: TagMode): { sql: string; params: string[] } {
  if (tagIds.length === 0) return { sql: '', params: [] };
  const ph = tagIds.map(() => '?').join(',');
  if (mode === 'all') {
    return {
      sql: ` AND (SELECT COUNT(DISTINCT l.tag_id) FROM transaction_tag_links l WHERE l.transaction_id = t.id AND l.user_id = t.user_id AND l.tag_id IN (${ph})) = ${tagIds.length}`,
      params: tagIds,
    };
  }
  return {
    sql: ` AND EXISTS (SELECT 1 FROM transaction_tag_links l WHERE l.transaction_id = t.id AND l.user_id = t.user_id AND l.tag_id IN (${ph}))`,
    params: tagIds,
  };
}
