// lib/webPushConfig.ts — VAPID 金鑰的環境變數來源（issue #257）
//
// 硬性要求：金鑰只能來自環境變數，不得硬寫在程式或提交進版控。
// 沿用 lib/envSecrets.ts 的既有慣例：首次啟動且未設定時自動產生一組金鑰，
// 寫入由 ENV_PATH 指定的持久化 .env（Docker 部署為 /app/data volume），
// 之後每次啟動都讀回同一組，因此重啟不會輪替金鑰、既有訂閱不會失效。
//
// 一旦更換金鑰，所有既有訂閱的推播都會被 push service 拒絕（必須重新訂閱）。

import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  generateVapidKeys,
  isValidVapidKeyPair,
  isValidVapidPrivateKey,
  isValidVapidPublicKey,
  resolveVapidSubject,
  type VapidKeyPair,
} from './webPushCore';

export const VAPID_PUBLIC_KEY_ENV = 'VAPID_PUBLIC_KEY';
export const VAPID_PRIVATE_KEY_ENV = 'VAPID_PRIVATE_KEY';

let cached: VapidKeyPair | null = null;

function envPath(): string {
  return process.env.ENV_PATH || path.join(process.cwd(), '.env');
}

function upsertEnvLine(lines: string[], key: string, value: string): string[] {
  const next = [...lines];
  const idx = next.findIndex((line) => line.startsWith(`${key}=`));
  if (idx >= 0) next[idx] = `${key}=${value}`;
  else next.push(`${key}=${value}`);
  return next;
}

/** 把產生的金鑰寫入持久化 .env（權限 0600，與 envSecrets.ts 相同）。 */
function persistKeys(keys: VapidKeyPair): void {
  const file = envPath();
  let content = '';
  try {
    content = fs.readFileSync(file, 'utf-8');
  } catch {
    // 首次啟動尚無 .env 屬正常情況。
  }
  let lines = content ? content.split('\n').filter((line) => line.trim() !== '') : [];
  lines = upsertEnvLine(lines, VAPID_PUBLIC_KEY_ENV, keys.publicKey);
  lines = upsertEnvLine(lines, VAPID_PRIVATE_KEY_ENV, keys.privateKey);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${lines.join('\n')}\n`, { encoding: 'utf-8', mode: 0o600 });
  try { fs.chmodSync(file, 0o600); } catch { /* 非 POSIX 檔案系統 */ }
}

/**
 * 取得 VAPID 金鑰組；缺少時自動產生並持久化。
 * 環境變數若存在但格式不合法（例如被截斷），一律視為未設定並重新產生，
 * 避免以壞掉的金鑰送出必然失敗的推播。
 */
export function getVapidKeys(): VapidKeyPair {
  if (cached) return cached;

  const publicKey = String(process.env[VAPID_PUBLIC_KEY_ENV] || '').trim();
  const privateKey = String(process.env[VAPID_PRIVATE_KEY_ENV] || '').trim();
  if (isValidVapidKeyPair(publicKey, privateKey)) {
    cached = { publicKey, privateKey };
    return cached;
  }

  const generated = generateVapidKeys();
  try {
    persistKeys(generated);
    process.env[VAPID_PUBLIC_KEY_ENV] = generated.publicKey;
    process.env[VAPID_PRIVATE_KEY_ENV] = generated.privateKey;
    cached = generated;
  } catch (error) {
    // 寫檔失敗（例如唯讀檔案系統）時仍以本次產生的金鑰運作，但下次啟動會換新金鑰；
    // 明確記錄以便維運察覺並改為手動設定環境變數。
    console.error('[web-push] 無法寫入 VAPID 金鑰至持久化 .env，重啟後訂閱將失效：', error);
    cached = generated;
  }
  return cached;
}

/** 前端訂閱用的公鑰（可安全公開；私鑰永不外流）。 */
export function getVapidPublicKey(): string {
  return getVapidKeys().publicKey;
}

export function isWebPushConfigured(): boolean {
  try {
    const keys = getVapidKeys();
    return isValidVapidPublicKey(keys.publicKey) && isValidVapidPrivateKey(keys.privateKey);
  } catch {
    return false;
  }
}

/**
 * VAPID subject：優先 APP_URL，其次 APP_HOST，皆未設定則退回系統管理員信箱的 mailto。
 * push service 會以此驗證發送者身分（無效的值會被 Apple／FCM 拒絕）。
 */
export function getVapidSubject(): string {
  const adminEmail = String(process.env.ADMIN_EMAIL || process.env.EMAIL_FROM || '').trim();
  return resolveVapidSubject(
    process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_HOST,
    adminEmail || `admin@${randomHostFallback()}`,
  );
}

// 未設定任何 URL／信箱時，仍需一個 mailto（RFC 8292 不接受空 subject）。
// 以機器 UUID 產生穩定但無意義的網域，避免多實例互相覆蓋。
function randomHostFallback(): string {
  const seed = `${process.env.HOSTNAME || ''}|${process.env.DATABASE_URL || ''}`;
  return `${crypto.createHash('sha256').update(seed).digest('hex').slice(0, 8)}.invalid`;
}

/** 測試用：清除模組層快取（正式路徑不需要）。 */
export function __resetVapidCacheForTests(): void {
  cached = null;
}
