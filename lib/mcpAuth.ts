// lib/mcpAuth.ts — MCP 個人化存取權杖（PAT）：產生、雜湊、建立、驗證、列表、撤銷
// 雜湊手法比照 lib/userDeletion.ts 的 createHashedEmail()：crypto.createHash('sha256')
// 高熵亂數（crypto.randomBytes(32)）不需 bcrypt 慢雜湊，且需支援雜湊索引查找（見 research.md 第 2 節）
import crypto from 'crypto';
import { getDB, queryOne, queryAll, saveDB } from './db';
import { uid } from './userDefaults';

export const MAX_ACTIVE_MCP_CREDENTIALS = 20;

export class McpCredentialLimitError extends Error {
  constructor() {
    super(`啟用中的 MCP 存取憑證已達上限（${MAX_ACTIVE_MCP_CREDENTIALS} 組），請先撤銷既有憑證再新增`);
    this.name = 'McpCredentialLimitError';
  }
}

export type McpCredentialStatus = 'active' | 'expired' | 'revoked';

export interface McpCredentialSummary {
  id: string;
  name: string;
  status: McpCredentialStatus;
  createdAt: number;
  lastUsedAt: number | null;
  expiresAt: number | null;
}

export interface CreateMcpCredentialResult {
  id: string;
  name: string;
  token: string;
  createdAt: number;
  expiresAt: number;
}

export interface VerifyMcpTokenResult {
  credentialId: string;
  userId: string;
  name: string;
}

interface McpCredentialRow {
  id: string | number;
  user_id?: string | number;
  name: string | number;
  created_at: string | number | null;
  last_used_at: string | number | null;
  expires_at: string | number | null;
  revoked_at: string | number | null;
}

export function generateMcpToken(): string {
  return 'ap_mcp_' + crypto.randomBytes(32).toString('base64url');
}

export function hashMcpToken(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex');
}

function deriveStatus(row: McpCredentialRow, now: number): McpCredentialStatus {
  const revokedAt = Number(row.revoked_at) || 0;
  const expiresAt = Number(row.expires_at) || 0;
  if (revokedAt !== 0) return 'revoked';
  if (expiresAt !== 0 && expiresAt < now) return 'expired';
  return 'active';
}

export function createMcpCredential(userId: string, name: string, expiresAt = 0): CreateMcpCredentialResult {
  const now = Date.now();
  const countRow = queryOne(
    'SELECT COUNT(*) AS cnt FROM mcp_credentials WHERE user_id = ? AND revoked_at = 0 AND (expires_at = 0 OR expires_at > ?)',
    [userId, now]
  );
  const activeCount = Number(countRow?.cnt) || 0;
  if (activeCount >= MAX_ACTIVE_MCP_CREDENTIALS) {
    throw new McpCredentialLimitError();
  }

  const id = uid();
  const token = generateMcpToken();
  const tokenHash = hashMcpToken(token);
  getDB().run(
    'INSERT INTO mcp_credentials (id, user_id, name, token_hash, created_at, last_used_at, expires_at, revoked_at) VALUES (?,?,?,?,?,0,?,0)',
    [id, userId, name, tokenHash, now, expiresAt || 0]
  );
  saveDB();
  return { id, name, token, createdAt: now, expiresAt: expiresAt || 0 };
}

export function verifyMcpToken(plaintext: string): VerifyMcpTokenResult | null {
  const tokenHash = hashMcpToken(plaintext);
  const row = queryOne(
    'SELECT id, user_id, name, expires_at, revoked_at FROM mcp_credentials WHERE token_hash = ?',
    [tokenHash]
  ) as McpCredentialRow | null;
  if (!row) return null;

  const now = Date.now();
  if (Number(row.revoked_at) !== 0) return null;
  const expiresAt = Number(row.expires_at) || 0;
  if (expiresAt !== 0 && expiresAt < now) return null;

  getDB().run('UPDATE mcp_credentials SET last_used_at = ? WHERE id = ?', [now, row.id]);
  saveDB();
  return { credentialId: String(row.id), userId: String(row.user_id), name: String(row.name) };
}

export function listMcpCredentials(userId: string): McpCredentialSummary[] {
  const now = Date.now();
  const rows = queryAll(
    'SELECT id, name, created_at, last_used_at, expires_at, revoked_at FROM mcp_credentials WHERE user_id = ? ORDER BY created_at DESC',
    [userId]
  ) as unknown as McpCredentialRow[];
  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    status: deriveStatus(row, now),
    createdAt: Number(row.created_at) || 0,
    lastUsedAt: Number(row.last_used_at) || 0 ? Number(row.last_used_at) : null,
    expiresAt: Number(row.expires_at) || 0 ? Number(row.expires_at) : null,
  }));
}

export function revokeMcpCredential(userId: string, id: string): boolean {
  const db = getDB();
  db.run(
    'UPDATE mcp_credentials SET revoked_at = ? WHERE id = ? AND user_id = ? AND revoked_at = 0',
    [Date.now(), id, userId]
  );
  const hit = db.getRowsModified() > 0;
  saveDB();
  return hit;
}
