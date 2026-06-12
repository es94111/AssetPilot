// lib/photoCrypto.ts — 交易憑證照片的「靜態加密」對外 API（DEK 持久化層）
//
// 金鑰階層（envelope / KMS 模型）：
//   PHOTO_MASTER_KEY (env, base64 32 bytes)  ← 伺服器主金鑰，與 DB 分開存放
//        │  AES-256-GCM 包/解
//        ▼
//   每使用者 DEK (隨機 32 bytes)              ← 存 user_photo_keys（已被主金鑰包住）
//        │  AES-256-GCM 加/解
//        ▼
//   每張照片密文 = [MAGIC 4B][iv 12B][tag 16B][ciphertext]
//
// 設計重點：
//  - 主金鑰握在伺服器，因此 LINE bot 背景收圖、後台批次壓縮、備份還原都能正常運作；
//    使用者完全無感，不需設密碼，忘記也不會掉照片。
//  - 主金鑰與 DB 分離，磁碟 / S3 bucket 外洩拿不到金鑰即無法解密。
//  - 每使用者一把 DEK：金鑰隔離；刪除 DEK 即「密碼學銷毀」該用戶全部照片。
//  - 向後相容：未設定 PHOTO_MASTER_KEY 時維持明文（現狀）；已存在的明文照片以 MAGIC
//    標頭辨識，讀取時自動 fallback，無需一次性遷移。
//
// 純密碼學原語見 lib/photoCryptoCore.ts（無 DB 相依、可單元測試）。
//
// 注意：PHOTO_MASTER_KEY 視為永久金鑰。輪替主金鑰需重新包覆所有 DEK，直接更換會導致
//       既有 wrapped DEK 無法解開、照片無法讀取。

import { getDB, queryOne, saveDB } from './db';
import {
  decryptWithDek,
  encryptWithDek,
  generateDek,
  isEncryptedBlob,
  isPhotoEncryptionEnabled,
  loadMasterKey,
  unwrapDek,
  wrapDek,
  _resetMasterKeyCache,
} from './photoCryptoCore';

export { isPhotoEncryptionEnabled, isEncryptedBlob };

const dekCache = new Map<string, Buffer>();

/**
 * 取得使用者的 DEK；不存在時依 create 決定是否隨機產生並寫入 DB。
 * @returns DEK，或 create=false 且尚未建立時回 null。
 */
function getUserDek(userId: string, master: Buffer, create: boolean): Buffer | null {
  const cached = dekCache.get(userId);
  if (cached) return cached;

  const row = queryOne(
    'SELECT wrapped_dek, iv, tag FROM user_photo_keys WHERE user_id = ?',
    [userId]
  );
  if (row?.wrapped_dek) {
    const dek = unwrapDek(master, String(row.wrapped_dek), String(row.iv), String(row.tag));
    dekCache.set(userId, dek);
    return dek;
  }

  if (!create) return null;

  const dek = generateDek();
  const { wrapped, iv, tag } = wrapDek(master, dek);
  getDB().run(
    'INSERT INTO user_photo_keys (user_id, wrapped_dek, iv, tag, created_at) VALUES (?,?,?,?,?)',
    [userId, wrapped, iv, tag, Date.now()]
  );
  saveDB();
  dekCache.set(userId, dek);
  return dek;
}

/**
 * 加密一張照片。未啟用加密時原樣回傳明文（維持現狀）。
 * 回傳格式：[MAGIC][iv][tag][ciphertext]。
 */
export function encryptPhoto(userId: string, plain: Buffer): Buffer {
  const master = loadMasterKey();
  if (!master) return plain;
  const dek = getUserDek(userId, master, true)!;
  return encryptWithDek(dek, plain);
}

/**
 * 解密一張照片。非加密內容（舊明文）原樣回傳。
 * 若內容已加密但主金鑰未設定 / DEK 不存在則拋錯，避免回傳亂碼。
 */
export function decryptPhoto(userId: string, stored: Buffer): Buffer {
  if (!isEncryptedBlob(stored)) return stored; // 舊明文照片
  const master = loadMasterKey();
  if (!master) throw new Error('照片已加密，但未設定 PHOTO_MASTER_KEY，無法解密');
  const dek = getUserDek(userId, master, false);
  if (!dek) throw new Error('找不到使用者照片金鑰，無法解密');
  return decryptWithDek(dek, stored);
}

/** 清除快取（測試用 / 金鑰輪替後）。 */
export function _resetPhotoCryptoCache(): void {
  _resetMasterKeyCache();
  dekCache.clear();
}
