// lib/einvoiceSecret.ts — 雲端發票載具憑證的加密封裝（issue #253）
//
// 比照 lib/photoCrypto.ts 的加密模式與 lib/apiTokenCore.ts 的密文格式：
//   AES-256-GCM，密文為 `base64(iv).base64(tag).base64(ciphertext)`
//   主金鑰由環境變數 EINVOICE_ENCRYPTION_KEY 提供，經 SHA-256 正規化為 32 bytes。
//
// 與 Webhook 簽章密鑰主金鑰（API_TOKEN_ENCRYPTION_KEY）刻意分開：
// 不同用途的金鑰不共用，任一外洩不會連帶影響另一項功能。
// 未設定時由 lib/envSecrets.ts 於首次啟動自動產生並寫入 .env（比照 JWT_SECRET），
// 讓自架部署無須手動設定即可使用；一旦有載具綁定後即不可更換
// （更換後既有憑證無法解密，使用者需重新綁定）。
//
// 刻意不依賴 DB 或 Next.js，故可於純 Node 測試中直接驗證。

import crypto from 'node:crypto';
import { GCM_TAG_LENGTH, decryptSecret, encryptSecret } from './apiTokenCore';

export const EINVOICE_ENCRYPTION_KEY_ENV = 'EINVOICE_ENCRYPTION_KEY';

/** 讀取主金鑰；未設定回空字串（呼叫端據此回報「尚未啟用」而非例外）。 */
export function einvoiceMasterSecret(env: NodeJS.ProcessEnv = process.env): string {
  return String(env[EINVOICE_ENCRYPTION_KEY_ENV] || '').trim();
}

export function isEinvoiceEncryptionConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return einvoiceMasterSecret(env).length > 0;
}

export class EinvoiceSecretError extends Error {
  readonly code = 'EINVOICE_ENCRYPTION_KEY_MISSING';

  constructor() {
    super('尚未設定發票載具憑證的加密主金鑰（EINVOICE_ENCRYPTION_KEY）');
    this.name = 'EinvoiceSecretError';
  }
}

function requireMasterSecret(env: NodeJS.ProcessEnv): string {
  const secret = einvoiceMasterSecret(env);
  if (!secret) throw new EinvoiceSecretError();
  return secret;
}

/** 加密載具驗證碼。格式與 lib/apiTokenCore.encryptSecret 完全一致。 */
export function encryptCarrierSecret(plaintext: string, env: NodeJS.ProcessEnv = process.env): string {
  return encryptSecret(String(plaintext), requireMasterSecret(env));
}

/** 解密載具驗證碼；密文格式錯誤或金鑰不符皆拋錯（不回應亂碼）。 */
export function decryptCarrierSecret(payload: string, env: NodeJS.ProcessEnv = process.env): string {
  return decryptSecret(String(payload), requireMasterSecret(env));
}

/**
 * 以固定明文往返驗證主金鑰是否可用（供啟動自檢；不觸碰任何使用者資料）。
 * 解密失敗時回 false 而非拋錯，讓呼叫端能優雅降級。
 */
export function verifyEinvoiceEncryptionKey(env: NodeJS.ProcessEnv = process.env): boolean {
  try {
    const secret = requireMasterSecret(env);
    const probe = `probe:${crypto.createHash('sha256').update(secret).digest('hex').slice(0, 8)}`;
    return decryptSecret(encryptSecret(probe, secret), secret) === probe;
  } catch {
    return false;
  }
}

// 明確 re-export，讓呼叫端（與測試）能斷言密文格式與 lib/apiTokenCore 一致。
export { GCM_TAG_LENGTH, encryptSecret, decryptSecret };
