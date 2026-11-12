// lib/accountRecovery.ts — Passkey 遺失復原碼與受限復原流程（issue #308）
//
// 安全設計：
//   - 復原碼 160-bit CSPRNG，只存 SHA-256（新碼 v2）或相容舊資料的 HMAC-SHA256（v1）；明文僅在產生當下回傳一次。
//   - 驗證復原碼只會發出「復原工作階段」（獨立 cookie `recoveryToken`、獨立資料表），
//     不是 authToken，因此 requireAuth 與所有財務 API 一律拒絕。
//   - 復原碼在「新 Passkey 註冊成功」時才以單一 UPDATE 原子消耗（受影響列數 = 1 才算成功）。
import crypto from 'crypto';
import { server as webauthnServer, type CredentialInfo } from '@passwordless-id/webauthn';
import { getDB, queryAll, queryOne, saveDB } from './db';
import { consumePasskeyChallenge } from './passkeyChallenge';
import { uid, normalizeEmail } from './loginHelpers';
import { checkRateLimit, type RateLimitEntry } from './rateLimit';
import { resolvePasskeyExpectedOrigin, type OriginHeadersLike } from './originPolicy';
import { writeOperationAudit } from './auditHelpers';
import { getRequestIpFromHeaders, getUserAgentFromHeaders } from './loginHelpers';

export const RECOVERY_CODE_COUNT = 10;
export const RECOVERY_SESSION_TTL_MS = 10 * 60 * 1000;
export const RECOVERY_COOKIE_NAME = 'recoveryToken';
export const RECOVERY_REAUTH_WINDOW_MS = 5 * 60 * 1000;
export const RECOVERY_CHALLENGE_PURPOSE = 'recovery';
export const RECOVERY_REAUTH_CHALLENGE_PURPOSE = 'recovery-reauth';

const CODE_BYTES = 20; // 160 bits
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // Crockford base32

type Headers_ = OriginHeadersLike;

function legacyRecoveryCodePepper(): string {
  return String(process.env.RECOVERY_CODE_LEGACY_PEPPER || process.env.JWT_SECRET || '');
}

export function hashRecoveryCode(normalizedCode: string): string {
  return crypto.createHash('sha256').update(`recovery-code:${normalizedCode}`).digest('hex');
}

export function verifyRecoveryCodeHash(normalizedCode: string, storedHash: string, hashVersion: number): boolean {
  let candidate = '';
  if (hashVersion === 1) {
    const pepper = legacyRecoveryCodePepper();
    if (!pepper) return false;
    candidate = crypto.createHmac('sha256', pepper).update(`recovery-code:${normalizedCode}`).digest('hex');
  } else if (hashVersion === 2) {
    candidate = hashRecoveryCode(normalizedCode);
  }
  return candidate ? timingSafeEqualHex(candidate, storedHash) : false;
}

export function normalizeRecoveryCode(input: unknown): string {
  return String(input || '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .replace(/[IL]/g, '1')
    .replace(/O/g, '0')
    .replace(/U/g, 'V');
}

function encodeBase32(bytes: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** 產生單一復原碼（32 字元，每 4 字元以 `-` 分組）。 */
export function generateRecoveryCode(): string {
  const raw = encodeBase32(crypto.randomBytes(CODE_BYTES));
  return raw.match(/.{1,4}/g)!.join('-');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ab.length === bb.length && ab.length > 0 && crypto.timingSafeEqual(ab, bb);
}

export interface RecoveryCodeStatus {
  generated: boolean;
  remaining: number;
  total: number;
  createdAt: number | null;
}

export function getRecoveryCodeStatus(userId: string): RecoveryCodeStatus {
  const rows = queryAll(
    'SELECT created_at, used_at, revoked_at FROM account_recovery_codes WHERE user_id = ? AND revoked_at = 0',
    [userId],
  );
  const remaining = rows.filter((r) => Number(r.used_at) === 0).length;
  const createdAt = rows.reduce<number | null>((max, r) => {
    const v = Number(r.created_at) || 0;
    return max === null || v > max ? v : max;
  }, null);
  return { generated: rows.length > 0, remaining, total: rows.length, createdAt };
}

/** 產生一組新復原碼；舊組立即作廢。回傳明文（僅此一次）。 */
export function regenerateRecoveryCodes(userId: string): string[] {
  const db = getDB();
  const now = Date.now();
  const codes: string[] = [];
  db.run('UPDATE account_recovery_codes SET revoked_at = ? WHERE user_id = ? AND revoked_at = 0', [now, userId]);
  for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
    const code = generateRecoveryCode();
    codes.push(code);
    db.run(
      'INSERT INTO account_recovery_codes (id, user_id, code_hash, hash_version, created_at, used_at, revoked_at) VALUES (?,?,?,?,?,0,0)',
      [uid(), userId, hashRecoveryCode(normalizeRecoveryCode(code)), 2, now],
    );
  }
  // 復原中的工作階段也隨舊碼失效。
  db.run('UPDATE account_recovery_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at = 0 AND consumed_at = 0', [now, userId]);
  saveDB();
  return codes;
}

// ── 節流（IP / 帳號 / 憑證）──
const ipLimits = new Map<string, RateLimitEntry>();
const accountLimits = new Map<string, RateLimitEntry>();
const credentialLimits = new Map<string, RateLimitEntry>();
const WINDOW_MS = 15 * 60 * 1000;
const IP_MAX = 10;
const ACCOUNT_MAX = 5;
const CREDENTIAL_MAX = 3;

export function resetRecoveryThrottleForTests(): void {
  ipLimits.clear();
  accountLimits.clear();
  credentialLimits.clear();
}

/** @returns false 代表已被節流 */
export function checkRecoveryThrottle(ip: string, email: string, normalizedCode: string, now = Date.now()): boolean {
  const ipOk = checkRateLimit(ipLimits, ip || 'unknown', IP_MAX, WINDOW_MS, now);
  const accountOk = checkRateLimit(accountLimits, email, ACCOUNT_MAX, WINDOW_MS, now);
  const credentialOk = checkRateLimit(credentialLimits, hashRecoveryCode(normalizedCode), CREDENTIAL_MAX, WINDOW_MS, now);
  return ipOk && accountOk && credentialOk;
}

const DUMMY_HASH = hashRecoveryCode('DUMMY');

/**
 * 驗證復原碼是否有效（不消耗）。對未知帳號仍做一次比對，回應與耗時盡量一致。
 */
export function findValidRecoveryCode(email: string, normalizedCode: string): { userId: string; codeId: string } | null {
  const user = queryOne('SELECT id, is_active FROM users WHERE LOWER(email) = ?', [normalizeEmail(email)]);
  const candidate = hashRecoveryCode(normalizedCode);
  if (!user || Number(user.is_active) === 0) {
    timingSafeEqualHex(candidate, DUMMY_HASH);
    return null;
  }
  const rows = queryAll(
    'SELECT id, code_hash, hash_version FROM account_recovery_codes WHERE user_id = ? AND used_at = 0 AND revoked_at = 0',
    [String(user.id)],
  );
  let matched: string | null = null;
  for (const row of rows) {
    if (verifyRecoveryCodeHash(normalizedCode, String(row.code_hash || ''), Number(row.hash_version) || 1)) {
      matched = String(row.id);
    }
  }
  return matched ? { userId: String(user.id), codeId: matched } : null;
}

// ── 復原工作階段 ──
function hashSessionToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface RecoverySession {
  id: string;
  userId: string;
  codeId: string;
}

export function createRecoverySession(userId: string, codeId: string, ip: string, now = Date.now()): { token: string; sessionId: string } {
  const db = getDB();
  const token = crypto.randomBytes(32).toString('base64url');
  const sessionId = uid();
  db.run('UPDATE account_recovery_sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at = 0 AND consumed_at = 0', [now, userId]);
  db.run(
    'INSERT INTO account_recovery_sessions (id, user_id, code_id, token_hash, ip_address, created_at, expires_at, consumed_at, revoked_at) VALUES (?,?,?,?,?,?,?,0,0)',
    [sessionId, userId, codeId, hashSessionToken(token), ip, now, now + RECOVERY_SESSION_TTL_MS],
  );
  saveDB();
  return { token, sessionId };
}

export function verifyRecoverySession(token: string | undefined | null, now = Date.now()): RecoverySession | null {
  if (!token) return null;
  const row = queryOne(
    'SELECT id, user_id, code_id, expires_at FROM account_recovery_sessions WHERE token_hash = ? AND consumed_at = 0 AND revoked_at = 0',
    [hashSessionToken(token)],
  );
  if (!row || Number(row.expires_at) <= now) return null;
  const code = queryOne('SELECT id FROM account_recovery_codes WHERE id = ? AND used_at = 0 AND revoked_at = 0', [String(row.code_id)]);
  if (!code) return null;
  return { id: String(row.id), userId: String(row.user_id), codeId: String(row.code_id) };
}

/**
 * 原子消耗復原碼並結束工作階段。回傳 false 代表碼已被使用／作廢（重放或並發）。
 */
export function consumeRecoveryCode(session: RecoverySession, now = Date.now()): boolean {
  const db = getDB();
  db.run(
    'UPDATE account_recovery_codes SET used_at = ? WHERE id = ? AND user_id = ? AND used_at = 0 AND revoked_at = 0',
    [now, session.codeId, session.userId],
  );
  if (db.getRowsModified() !== 1) return false;
  db.run('UPDATE account_recovery_sessions SET consumed_at = ? WHERE id = ? AND consumed_at = 0', [now, session.id]);
  // 復原完成後其餘舊碼一併作廢，要求使用者在新環境重新產生。
  db.run('UPDATE account_recovery_codes SET revoked_at = ? WHERE user_id = ? AND used_at = 0 AND revoked_at = 0', [now, session.userId]);
  saveDB();
  return true;
}

/** 刪除指定使用者「除保留者外」的所有 Passkey。 */
export function removePasskeysExcept(userId: string, keepCredentialId: string): number {
  const rows = queryAll('SELECT credential_id FROM passkey_credentials WHERE user_id = ? AND credential_id <> ?', [userId, keepCredentialId]);
  if (rows.length === 0) return 0;
  getDB().run('DELETE FROM passkey_credentials WHERE user_id = ? AND credential_id <> ?', [userId, keepCredentialId]);
  saveDB();
  return rows.length;
}

/** 復原流程的信任來源檢查：Origin 必須存在且符合伺服器信任清單。 */
export function isTrustedRecoveryOrigin(headers: Headers_): boolean {
  const get = (headers as Headers).get?.bind(headers) as ((n: string) => string | null) | undefined;
  const origin = String(get ? get('origin') || '' : (headers as Record<string, string | undefined>).origin || '').trim();
  if (!origin) return false;
  const resolved = resolvePasskeyExpectedOrigin(origin);
  return !!resolved.origin && resolved.origin === origin;
}

/** 復原稽核事件：只記錄動作與筆數，不含復原碼明文或雜湊。 */
export function auditRecovery(
  headers: Headers_,
  userId: string,
  action: string,
  result: 'success' | 'failure',
  metadata?: Record<string, unknown>,
): void {
  writeOperationAudit({
    userId,
    action,
    result,
    ipAddress: getRequestIpFromHeaders(headers as Parameters<typeof getRequestIpFromHeaders>[0]),
    userAgent: getUserAgentFromHeaders(headers as Parameters<typeof getUserAgentFromHeaders>[0]),
    metadata,
  });
}

/** 是否為最近完成登入（供敏感操作的「近期重新驗證」判斷）。 */
export function isRecentLogin(sessionId: string, now = Date.now()): boolean {
  if (!sessionId) return false;
  const row = queryOne('SELECT login_at FROM login_sessions WHERE id = ? AND revoked_at = 0', [sessionId]);
  return !!row && now - Number(row.login_at) <= RECOVERY_REAUTH_WINDOW_MS;
}

export interface StepUpReauthResult {
  ok: boolean;
  status: number;
  error?: string;
  reauthRequired?: boolean;
}

/**
 * 敏感操作共用的 step-up 重新驗證：近期登入（RECOVERY_REAUTH_WINDOW_MS）內
 * 直接通過；否則必須附上新鮮的 Passkey 使用者驗證（UV）。
 * 供 /api/account/recovery-codes、/api/account/delete 等端點共用；呼叫端依
 * 回傳值轉為 HTTP 回應（reauthRequired: true 供前端觸發重驗流程）。
 */
export async function verifyStepUpReauth(
  userId: string,
  sessionId: string | undefined,
  body: Record<string, unknown>,
  headers: Headers_,
): Promise<StepUpReauthResult> {
  if (isRecentLogin(String(sessionId || ''))) return { ok: true, status: 200 };

  const authentication = body.authentication as { id?: string } | undefined;
  const challengeKey = typeof body.challengeKey === 'string' ? body.challengeKey : '';
  if (!authentication || !challengeKey) {
    return { ok: false, status: 403, error: '需要重新驗證身分', reauthRequired: true };
  }
  const entry = consumePasskeyChallenge(challengeKey);
  if (!entry || entry.purpose || (entry.userId !== null && entry.userId !== userId)) {
    return { ok: false, status: 400, error: 'Challenge 已過期或無效，請重試', reauthRequired: true };
  }
  const cred = queryOne('SELECT * FROM passkey_credentials WHERE credential_id = ? AND user_id = ?', [
    String(authentication.id || ''),
    userId,
  ]);
  const get = (headers as Headers).get?.bind(headers) as ((n: string) => string | null) | undefined;
  const requestOrigin = String(
    get ? get('origin') || '' : (headers as Record<string, string | undefined>).origin || '',
  );
  const { origin } = resolvePasskeyExpectedOrigin(requestOrigin);
  if (!cred || !origin) {
    return { ok: false, status: 403, error: '重新驗證失敗', reauthRequired: true };
  }
  try {
    const credentialKey: CredentialInfo = {
      id: String(cred.credential_id || ''),
      publicKey: String(cred.public_key || ''),
      algorithm: String(cred.algorithm || '') as CredentialInfo['algorithm'],
      transports: JSON.parse(String(cred.transports || '[]')),
    };
    const result = await webauthnServer.verifyAuthentication(authentication as never, credentialKey, {
      challenge: entry.challenge,
      origin,
      userVerified: true,
      counter: Number(cred.counter) || 0,
    });
    getDB().run('UPDATE passkey_credentials SET counter = ? WHERE credential_id = ?', [result.counter || 0, cred.credential_id]);
    saveDB();
    return { ok: true, status: 200 };
  } catch {
    return { ok: false, status: 403, error: '重新驗證失敗', reauthRequired: true };
  }
}
