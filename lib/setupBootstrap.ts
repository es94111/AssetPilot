// lib/setupBootstrap.ts — Passkey-first 首次部署初始化（issue #307）
//
// 安全設計：
//   - 僅在「尚無使用者」且「未曾完成初始化」時開放；完成後 completed_at 永久關閉入口，
//     即使日後使用者被刪光也不會重開。
//   - users=0 本身不足以授權：必須提供部署者持有的一次性高熵 bootstrap 憑證
//     （啟動日誌顯示一次，或由 SETUP_BOOTSTRAP_TOKEN 指定）。資料庫只存 HMAC-SHA256 雜湊與到期時間。
//   - 建立管理員、Passkey、預設資料並消耗憑證於同一個同步交易內完成；
//     以 `UPDATE ... WHERE completed_at = 0` 原子搶佔，並發時最多一個成功。
//   - 交易不可跨 await：WebAuthn 驗證須在 BEGIN 之前完成。
import crypto from 'crypto';
import { getDB, queryOne } from './db';
import { createDefaultsForUser, todayStr } from './userDefaults';
import { checkRateLimit, type RateLimitEntry } from './rateLimit';
import { isValidEmail, normalizeEmail, uid, getRequestIpFromHeaders, getUserAgentFromHeaders } from './loginHelpers';
import { resolvePasskeyExpectedOrigin, type OriginHeadersLike } from './originPolicy';
import { writeOperationAudit } from './auditHelpers';
import { INSERT_PASSKEY_SQL, passkeyInsertParams, type VerifiedPasskeyCredential } from './passkeyRegistration';

export const SETUP_CHALLENGE_PURPOSE = 'setup';
export const SETUP_TOKEN_MIN_LENGTH = 32;
const DEFAULT_TTL_MINUTES = 24 * 60;
const TOKEN_BYTES = 24; // 192 bits

const IP_MAX_ATTEMPTS = 8;
const GLOBAL_MAX_ATTEMPTS = 40;
const THROTTLE_WINDOW_MS = 15 * 60 * 1000;
const ipThrottle = new Map<string, RateLimitEntry>();
const globalThrottle = new Map<string, RateLimitEntry>();

export class SetupError extends Error {
  constructor(message: string, public status: number, public code: string) {
    super(message);
    this.name = 'SetupError';
  }
}

export function resetSetupThrottleForTests(): void {
  ipThrottle.clear();
  globalThrottle.clear();
}

function hmacSecret(): string {
  return String(process.env.JWT_SECRET || '');
}

export function hashSetupToken(token: string): string {
  return crypto.createHmac('sha256', hmacSecret()).update(`setup-bootstrap:${token}`).digest('hex');
}

export function generateSetupToken(): string {
  return `ap-setup-${crypto.randomBytes(TOKEN_BYTES).toString('base64url')}`;
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && ab.length > 0 && crypto.timingSafeEqual(ab, bb);
}

function userCount(): number {
  return Number(queryOne('SELECT COUNT(1) AS count FROM users')?.count || 0);
}

function getState() {
  return queryOne('SELECT token_hash, created_at, expires_at, consumed_at, completed_at FROM system_bootstrap WHERE id = 1');
}

/** 已有使用者（含經 Google／LINE 建立的第一位使用者）時，永久關閉初始化入口。 */
function closeIfInitialised(): void {
  const db = getDB();
  const now = Date.now();
  db.run(
    `INSERT INTO system_bootstrap (id, token_hash, created_at, expires_at, consumed_at, completed_at)
     VALUES (1, '', ?, 0, 0, ?) ON CONFLICT (id) DO NOTHING`,
    [now, 0],
  );
  db.run('UPDATE system_bootstrap SET completed_at = ?, token_hash = ? WHERE id = 1 AND completed_at = 0', [now, '']);
}

export function isSetupRequired(): boolean {
  const state = getState();
  if (Number(state?.completed_at) > 0) return false;
  if (userCount() > 0) {
    closeIfInitialised();
    return false;
  }
  return true;
}

export interface SetupStatus {
  required: boolean;
  tokenActive: boolean;
}

export function getSetupStatus(): SetupStatus {
  const required = isSetupRequired();
  if (!required) return { required: false, tokenActive: false };
  const state = getState();
  const tokenActive = !!state && !!String(state.token_hash || '') && Number(state.consumed_at) === 0 && Number(state.expires_at) > Date.now();
  return { required, tokenActive };
}

function ttlMs(): number {
  const minutes = Number(process.env.SETUP_BOOTSTRAP_TTL_MINUTES);
  return (Number.isFinite(minutes) && minutes > 0 ? minutes : DEFAULT_TTL_MINUTES) * 60 * 1000;
}

/**
 * 啟動時呼叫：全新實例且無有效憑證時產生新憑證並回傳明文（僅供一次性輸出）。
 * 若以環境變數 SETUP_BOOTSTRAP_TOKEN 指定憑證則只寫入其雜湊，不回傳明文。
 */
export function ensureSetupBootstrapToken(now = Date.now()): { token: string | null; source: 'env' | 'generated'; expiresAt: number } | null {
  if (!isSetupRequired()) return null;
  const db = getDB();
  const envToken = String(process.env.SETUP_BOOTSTRAP_TOKEN || '').trim();
  if (envToken && envToken.length < SETUP_TOKEN_MIN_LENGTH) {
    throw new SetupError(`SETUP_BOOTSTRAP_TOKEN 長度至少需 ${SETUP_TOKEN_MIN_LENGTH} 字元`, 500, 'weak_token');
  }
  const token = envToken || generateSetupToken();
  const expiresAt = now + ttlMs();
  db.run(
    `INSERT INTO system_bootstrap (id, token_hash, created_at, expires_at, consumed_at, completed_at)
     VALUES (1, ?, ?, ?, 0, 0)
     ON CONFLICT (id) DO UPDATE SET token_hash = EXCLUDED.token_hash, created_at = EXCLUDED.created_at, expires_at = EXCLUDED.expires_at
     WHERE system_bootstrap.completed_at = 0`,
    [hashSetupToken(token), now, expiresAt],
  );
  return { token: envToken ? null : token, source: envToken ? 'env' : 'generated', expiresAt };
}

export function auditSetup(headers: OriginHeadersLike, action: string, result: 'success' | 'failure', userId?: string, reason?: string): void {
  writeOperationAudit({
    userId,
    action,
    result,
    ipAddress: getRequestIpFromHeaders(headers as Parameters<typeof getRequestIpFromHeaders>[0]),
    userAgent: getUserAgentFromHeaders(headers as Parameters<typeof getUserAgentFromHeaders>[0]),
    metadata: reason ? { reason } : undefined,
  });
}

export function isTrustedSetupOrigin(headers: OriginHeadersLike): boolean {
  const get = (headers as Headers).get?.bind(headers) as ((n: string) => string | null) | undefined;
  const origin = String(get ? get('origin') || '' : (headers as Record<string, string | undefined>).origin || '').trim();
  if (!origin) return false;
  const resolved = resolvePasskeyExpectedOrigin(origin);
  return !!resolved.origin && resolved.origin === origin;
}

/** 節流：同 IP 與全域雙層限制，每次呼叫（無論成敗）都計數，避免暴力猜測。 */
export function checkSetupThrottle(ip: string, now = Date.now()): boolean {
  const a = checkRateLimit(ipThrottle, ip || 'unknown', IP_MAX_ATTEMPTS, THROTTLE_WINDOW_MS, now);
  const b = checkRateLimit(globalThrottle, 'global', GLOBAL_MAX_ATTEMPTS, THROTTLE_WINDOW_MS, now);
  return a && b;
}

/** 驗證憑證（常數時間比較）；回傳目前憑證雜湊供 challenge 綁定。不洩漏失敗原因細節。 */
export function verifySetupToken(token: unknown, now = Date.now()): string | null {
  const value = String(token || '').trim();
  if (!value || value.length > 256) return null;
  const state = getState();
  if (!state || Number(state.completed_at) > 0 || Number(state.consumed_at) > 0) return null;
  if (Number(state.expires_at) <= now) return null;
  const stored = String(state.token_hash || '');
  const candidate = hashSetupToken(value);
  return timingSafeEqualHex(stored, candidate) ? stored : null;
}

export interface SetupIdentity {
  email: string;
  displayName: string;
}

export function validateSetupIdentity(input: { email?: unknown; displayName?: unknown }): SetupIdentity {
  const email = normalizeEmail(String(input.email || ''));
  const displayName = String(input.displayName || '').trim().slice(0, 60);
  if (!isValidEmail(email)) throw new SetupError('請輸入有效的電子郵件', 400, 'invalid_email');
  if (!displayName) throw new SetupError('請輸入顯示名稱', 400, 'invalid_name');
  return { email, displayName };
}

/**
 * 原子完成初始化：搶佔憑證 → 建立管理員 → 寫入 Passkey → 建立預設資料。
 * 任何一步失敗皆 ROLLBACK，不留下孤兒使用者或 Passkey，憑證維持可重試。
 * 必須為同步函式（交易不可跨 await）。
 */
export function completeSetup(args: {
  tokenHash: string;
  userId: string;
  identity: SetupIdentity;
  credential: VerifiedPasskeyCredential;
  deviceName: unknown;
  now?: number;
}): { userId: string } {
  const db = getDB();
  const now = args.now ?? Date.now();
  db.run('BEGIN');
  try {
    db.run(
      `UPDATE system_bootstrap SET consumed_at = ?, completed_at = ?
       WHERE id = 1 AND completed_at = 0 AND consumed_at = 0 AND token_hash = ? AND expires_at > ?`,
      [now, now, args.tokenHash, now],
    );
    if (db.getRowsModified() !== 1) throw new SetupError('初始化憑證已被使用或失效', 409, 'token_unavailable');
    if (userCount() > 0) throw new SetupError('系統已初始化', 409, 'already_initialised');
    if (queryOne('SELECT credential_id FROM passkey_credentials WHERE credential_id = ?', [args.credential.id])) {
      throw new SetupError('此 Passkey 已註冊過', 400, 'duplicate_credential');
    }
    db.run(
      'INSERT INTO users (id, email, password_hash, display_name, google_id, avatar_url, is_admin, has_password, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [args.userId, args.identity.email, `disabled:${uid()}`, args.identity.displayName, '', '', 1, 0, todayStr()],
    );
    db.run(INSERT_PASSKEY_SQL, passkeyInsertParams(args.userId, args.credential, args.deviceName));
    createDefaultsForUser(args.userId);
    db.run('COMMIT');
    return { userId: args.userId };
  } catch (error) {
    try { db.run('ROLLBACK'); } catch { /* connection already reset */ }
    throw error;
  }
}
