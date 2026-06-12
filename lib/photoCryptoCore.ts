// lib/photoCryptoCore.ts — 照片靜態加密的「純密碼學」核心（不依賴 DB / 任何相對模組）
//
// 與 lib/photoCrypto.ts 的分工：本檔只負責主金鑰載入與 AES-256-GCM 的封裝原語，
// 完全沒有 DB 相依，因此可用純 Node 測試（node tests/lib/photoCryptoCore.test.ts）。
// DEK 的持久化（user_photo_keys）與「以 userId 加解密」的對外 API 由 photoCrypto.ts 提供。
//
// 照片密文格式：[MAGIC 4B][iv 12B][tag 16B][ciphertext]

import crypto from 'crypto';

export const MAGIC = Buffer.from('APX1', 'ascii');
export const IV_LEN = 12;
export const TAG_LEN = 16;
export const KEY_LEN = 32;
export const HEADER_LEN = MAGIC.length + IV_LEN + TAG_LEN; // 32

let masterKeyCache: Buffer | null | undefined; // undefined = 尚未載入；null = 未設定

/** 載入並驗證主金鑰；未設定回 null（代表停用加密）。 */
export function loadMasterKey(): Buffer | null {
  if (masterKeyCache !== undefined) return masterKeyCache;
  const raw = String(process.env.PHOTO_MASTER_KEY || '').trim();
  if (!raw) {
    masterKeyCache = null;
    return null;
  }
  let key: Buffer;
  try {
    key = Buffer.from(raw, 'base64');
  } catch {
    throw new Error('PHOTO_MASTER_KEY 不是有效的 base64');
  }
  if (key.length !== KEY_LEN) {
    throw new Error(`PHOTO_MASTER_KEY 解碼後必須為 ${KEY_LEN} bytes（請用：openssl rand -base64 32）`);
  }
  masterKeyCache = key;
  return key;
}

/** 是否已啟用照片加密（PHOTO_MASTER_KEY 已設定且合法）。 */
export function isPhotoEncryptionEnabled(): boolean {
  return loadMasterKey() !== null;
}

/** 判斷一段位元組是否為本模組加密過的照片內容。 */
export function isEncryptedBlob(buf: Buffer): boolean {
  return buf.length >= HEADER_LEN && buf.subarray(0, MAGIC.length).equals(MAGIC);
}

/** 產生一把新的隨機 DEK。 */
export function generateDek(): Buffer {
  return crypto.randomBytes(KEY_LEN);
}

/** 用主金鑰包覆 DEK（AES-256-GCM）。回傳皆為 base64。 */
export function wrapDek(master: Buffer, dek: Buffer): { wrapped: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', master, iv);
  const wrapped = Buffer.concat([cipher.update(dek), cipher.final()]);
  return {
    wrapped: wrapped.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

/** 用主金鑰解開被包覆的 DEK。 */
export function unwrapDek(master: Buffer, wrapped: string, iv: string, tag: string): Buffer {
  const decipher = crypto.createDecipheriv('aes-256-gcm', master, Buffer.from(iv, 'base64'), {
    authTagLength: TAG_LEN,
  });
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(wrapped, 'base64')), decipher.final()]);
}

/** 以 DEK 加密照片，回傳 [MAGIC][iv][tag][ciphertext]。 */
export function encryptWithDek(dek: Buffer, plain: Buffer): Buffer {
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), ciphertext]);
}

/** 以 DEK 解密照片密文（呼叫端需先確認 isEncryptedBlob）。 */
export function decryptWithDek(dek: Buffer, stored: Buffer): Buffer {
  const iv = stored.subarray(MAGIC.length, MAGIC.length + IV_LEN);
  const tag = stored.subarray(MAGIC.length + IV_LEN, HEADER_LEN);
  const ciphertext = stored.subarray(HEADER_LEN);
  const decipher = crypto.createDecipheriv('aes-256-gcm', dek, iv, { authTagLength: TAG_LEN });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/** 清除主金鑰快取（測試用 / 金鑰輪替後）。 */
export function _resetMasterKeyCache(): void {
  masterKeyCache = undefined;
}
