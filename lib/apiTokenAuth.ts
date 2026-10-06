// lib/apiTokenAuth.ts — API Token 的建立／驗證／列表／撤銷（第三方自動化整合，issue #258）
//
// 與 lib/mcpAuth.ts（MCP 專用 PAT）並存的獨立憑證體系，差別在於：
// - 逐 Token 的權限範圍（scopes，可多個）而非單一布林寫入開關
// - 提供通用驗證入口 requireApiToken() 供 REST API 使用
// 儲存格式比照 mcp_credentials：只存 SHA-256 雜湊，明文僅在建立時回傳一次。
import crypto from 'node:crypto';
import { getDB, queryOne, queryAll, saveDB } from './db';
import { uid } from './userDefaults';
import { toIsoUtc } from './userTime';
import { isActiveUserFlag } from './userActive';
import {
  ApiTokenError,
  MAX_ACTIVE_API_TOKENS,
  generateApiToken,
  hashApiToken,
  parseApiTokenScopes,
  hasScope,
  type ApiTokenScope,
} from './apiTokenCore';

export { MAX_ACTIVE_API_TOKENS, ApiTokenError };

export type ApiTokenStatus = 'active' | 'expired' | 'revoked';

export interface ApiTokenSummary {
  id: string;
  name: string;
  status: ApiTokenStatus;
  scopes: ApiTokenScope[];
  prefix: string;
  createdAt: number;
  lastUsedAt: number | null;
  expiresAt: number | null;
}

export interface CreateApiTokenResult {
  id: string;
  name: string;
  token: string;
  prefix: string;
  scopes: ApiTokenScope[];
  createdAt: number;
  expiresAt: number;
}

export interface VerifyApiTokenResult {
  tokenId: string;
  userId: string;
  name: string;
  scopes: ApiTokenScope[];
}

interface ApiTokenRow {
  id: string | number;
  user_id?: string | number;
  name: string | number;
  token_prefix?: string | number | null;
  scopes?: string | number | null;
  created_at: string | number | null;
  last_used_at: string | number | null;
  expires_at: string | number | null;
  revoked_at: string | number | null;
}

/** 供列表顯示的前綴（例如 ap_api_AbC123…），不洩漏完整權杖。 */
export function tokenPrefix(plaintext: string): string {
  return plaintext.slice(0, 14);
}

const NAME_MAX_LENGTH = 100;

function normalizeName(raw: unknown): string {
  const name = String(raw ?? '').trim();
  if (!name || name.length > NAME_MAX_LENGTH) {
    throw new ApiTokenError(`名稱必須為 1~${NAME_MAX_LENGTH} 字元`);
  }
  return name;
}

export function parseScopesColumn(raw: unknown): ApiTokenScope[] {
  if (raw == null || raw === '') return [];
  return String(raw)
    .split(/\s+/)
    .map((s) => s.trim())
    .filter(Boolean) as ApiTokenScope[];
}

function deriveStatus(row: ApiTokenRow, now: number): ApiTokenStatus {
  if ((Number(row.revoked_at) || 0) !== 0) return 'revoked';
  const expiresAt = Number(row.expires_at) || 0;
  if (expiresAt !== 0 && expiresAt < now) return 'expired';
  return 'active';
}

export function createApiToken(
  userId: string,
  name: string,
  scopes: unknown,
  expiresAt = 0,
): CreateApiTokenResult {
  // 先驗證輸入再檢查名額：名額已滿時仍應對無效輸入回報參數錯誤，而非誤導性的上限錯誤。
  const safeName = normalizeName(name);
  const parsedScopes = parseApiTokenScopes(scopes);
  const now = Date.now();

  const countRow = queryOne(
    'SELECT COUNT(*) AS cnt FROM api_tokens WHERE user_id = ? AND revoked_at = 0 AND (expires_at = 0 OR expires_at > ?)',
    [userId, now],
  );
  if ((Number(countRow?.cnt) || 0) >= MAX_ACTIVE_API_TOKENS) {
    throw new ApiTokenError(
      `啟用中的 API Token 已達上限（${MAX_ACTIVE_API_TOKENS} 組），請先撤銷既有 Token 再新增`,
      400,
      'TokenLimitReached',
    );
  }

  const id = uid();
  const token = generateApiToken();
  const prefix = tokenPrefix(token);
  getDB().run(
    'INSERT INTO api_tokens (id, user_id, name, token_hash, token_prefix, scopes, created_at, last_used_at, expires_at, revoked_at) VALUES (?,?,?,?,?,?,?,0,?,0)',
    [id, userId, safeName, hashApiToken(token), prefix, parsedScopes.join(' '), now, expiresAt || 0],
  );
  saveDB();
  return { id, name: safeName, token, prefix, scopes: parsedScopes, createdAt: now, expiresAt: expiresAt || 0 };
}

export function verifyApiToken(plaintext: string): VerifyApiTokenResult | null {
  if (typeof plaintext !== 'string' || !plaintext) return null;
  const row = queryOne(
    `SELECT t.id, t.user_id, t.name, t.scopes, t.expires_at, t.revoked_at,
            u.is_active AS user_is_active
       FROM api_tokens t
       JOIN users u ON u.id = t.user_id
      WHERE t.token_hash = ?`,
    [hashApiToken(plaintext)],
  ) as (ApiTokenRow & { user_is_active: unknown }) | null;
  if (!row) return null;

  // 停用帳號即使 Token 未過期也不得再使用（比照 lib/mcpAuth.ts 的安全修補）。
  if (!isActiveUserFlag(row.user_is_active)) return null;

  if ((Number(row.revoked_at) || 0) !== 0) return null;
  const expiresAt = Number(row.expires_at) || 0;
  if (expiresAt !== 0 && expiresAt < Date.now()) return null;

  getDB().run('UPDATE api_tokens SET last_used_at = ? WHERE id = ?', [Date.now(), row.id]);
  saveDB();
  return {
    tokenId: String(row.id),
    userId: String(row.user_id),
    name: String(row.name),
    scopes: parseScopesColumn(row.scopes),
  };
}

export function listApiTokens(userId: string): ApiTokenSummary[] {
  const now = Date.now();
  const rows = queryAll(
    'SELECT id, name, token_prefix, scopes, created_at, last_used_at, expires_at, revoked_at FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
  ) as unknown as ApiTokenRow[];
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    status: deriveStatus(row, now),
    scopes: parseScopesColumn(row.scopes),
    prefix: String(row.token_prefix || ''),
    createdAt: Number(row.created_at) || 0,
    lastUsedAt: Number(row.last_used_at) || null,
    expiresAt: Number(row.expires_at) || null,
  }));
}

export function revokeApiToken(userId: string, id: string): boolean {
  const db = getDB();
  db.run(
    'UPDATE api_tokens SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at = 0',
    [Date.now(), id, userId],
  );
  const hit = db.getRowsModified() > 0;
  saveDB();
  return hit;
}

export function ownsApiToken(userId: string, id: string): boolean {
  return !!queryOne('SELECT id FROM api_tokens WHERE id = ? AND user_id = ?', [id, userId]);
}

/** 依權限範圍驗證；供 REST API 以 `Authorization: Bearer <token>` 呼叫。 */
export function requireApiTokenScope(
  result: VerifyApiTokenResult,
  scope: ApiTokenScope,
): void {
  if (!hasScope(result.scopes, scope)) {
    throw new ApiTokenError(`此 Token 缺少必要權限範圍：${scope}`, 403, 'InsufficientScope');
  }
}

export function isApiTokenPrefix(value: string): boolean {
  return typeof value === 'string' && value.startsWith('ap_api_');
}

/** 常數時間比較，避免以時序差異推測 Token 內容。 */
export function tokensMatch(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function isoOrNull(ms: number | null): string | null {
  return ms == null ? null : toIsoUtc(ms);
}

export function serializeApiToken(t: ApiTokenSummary) {
  return {
    id: t.id,
    name: t.name,
    status: t.status,
    scopes: t.scopes,
    prefix: t.prefix,
    createdAt: toIsoUtc(t.createdAt),
    lastUsedAt: isoOrNull(t.lastUsedAt),
    expiresAt: isoOrNull(t.expiresAt),
  };
}
