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
  isPhotoEncryptionEnabled as isLegacyPhotoEncryptionEnabled,
  loadMasterKey,
  loadPreviousMasterKey,
  unwrapDek,
  wrapDek,
  _resetMasterKeyCache,
} from './photoCryptoCore';
import { getActiveKey, getKeyById, getLegacyKeys, isKeyringEnabled, KEYRING_ROTATION_LOCK_NAME } from './keyring';

export { isEncryptedBlob };

const dekCache = new Map<string, Buffer>();

export function isPhotoEncryptionEnabled(): boolean {
  if (!isKeyringEnabled()) return isLegacyPhotoEncryptionEnabled();
  const active = getActiveKey('photo');
  active?.key.fill(0);
  return active !== null;
}

/**
 * 取得使用者的 DEK；不存在時依 create 決定是否隨機產生並寫入 DB。
 * @returns DEK，或 create=false 且尚未建立時回 null。
 */
function unwrapStoredDek(row: Record<string, string | number | null>, ringEnabled: boolean): Buffer {
  const kid = String(row.key_id || '');
  if (kid) {
    const key = getKeyById('photo', kid);
    try {
      return unwrapDek(key.key, String(row.wrapped_dek), String(row.iv), String(row.tag));
    } finally {
      key.key.fill(0);
    }
  }

  if (ringEnabled) {
    const legacyKeys = getLegacyKeys('photo');
    if (legacyKeys.length === 0) throw new Error('找不到照片 DEK 的相容金鑰，無法解密');
    let lastError: unknown;
    try {
      for (const legacy of legacyKeys) {
        try {
          return unwrapDek(legacy.key, String(row.wrapped_dek), String(row.iv), String(row.tag));
        } catch (error) {
          lastError = error;
        }
      }
    } finally {
      for (const legacy of legacyKeys) legacy.key.fill(0);
    }
    throw lastError instanceof Error ? lastError : new Error('無法使用設定的照片相容金鑰解開 DEK');
  }

  const current = loadMasterKey();
  const previous = loadPreviousMasterKey();
  if (!current && !previous) throw new Error('照片已加密，但未設定 PHOTO_MASTER_KEY，無法解密');
  let currentError: unknown;
  if (current) {
    try {
      return unwrapDek(current, String(row.wrapped_dek), String(row.iv), String(row.tag));
    } catch (error) {
      currentError = error;
    }
  }
  if (previous && (!current || !previous.equals(current))) {
    try {
      return unwrapDek(previous, String(row.wrapped_dek), String(row.iv), String(row.tag));
    } catch {
      // Preserve the current-key failure when neither configured key can unwrap this DEK.
    }
  }
  throw currentError instanceof Error ? currentError : new Error('無法使用設定的照片主金鑰解開 DEK');
}

function getUserDek(userId: string, create: boolean): Buffer | null {
  const cached = dekCache.get(userId);
  if (cached) return cached;

  const initialRingEnabled = isKeyringEnabled();
  const row = queryOne(
    'SELECT wrapped_dek, iv, tag, key_id FROM user_photo_keys WHERE user_id = ?',
    [userId],
  );
  if (row?.wrapped_dek) {
    const dek = unwrapStoredDek(row, initialRingEnabled);
    dekCache.set(userId, dek);
    return dek;
  }
  if (!create) return null;

  if (initialRingEnabled) {
    const photoKey = getActiveKey('photo');
    photoKey?.key.fill(0);
  }

  const db = getDB();
  let createdDek: Buffer | null = null;
  let activeKey: ReturnType<typeof getActiveKey> = null;
  let legacyMaster: Buffer | null = null;
  let committed = false;
  db.run('BEGIN');
  try {
    db.run('SELECT pg_advisory_xact_lock(hashtext(?))', [KEYRING_ROTATION_LOCK_NAME]);

    const lockedRow = queryOne(
      'SELECT wrapped_dek, iv, tag, key_id FROM user_photo_keys WHERE user_id = ?',
      [userId],
    );
    if (lockedRow?.wrapped_dek) {
      const dek = unwrapStoredDek(lockedRow, Number(queryOne('SELECT enabled FROM keyring_control WHERE id = 1')?.enabled) === 1);
      db.run('COMMIT');
      committed = true;
      dekCache.set(userId, dek);
      return dek;
    }

    const ringEnabled = Number(queryOne('SELECT enabled FROM keyring_control WHERE id = 1')?.enabled) === 1;
    let kid = '';
    let wrappingKey: Buffer | null = null;
    if (ringEnabled) {
      const activeRow = queryOne(
        "SELECT kid FROM keyring_keys WHERE purpose = 'photo' AND status = 'active'",
      );
      if (activeRow?.kid) {
        activeKey = getKeyById('photo', String(activeRow.kid));
        kid = activeKey.kid;
        wrappingKey = activeKey.key;
      }
    } else {
      const configuredMaster = loadMasterKey();
      legacyMaster = configuredMaster ? Buffer.from(configuredMaster) : null;
      wrappingKey = legacyMaster;
    }

    if (!wrappingKey) {
      db.run('COMMIT');
      committed = true;
      return null;
    }

    createdDek = generateDek();
    const wrapped = wrapDek(wrappingKey, createdDek);
    db.run(
      `INSERT INTO user_photo_keys (user_id, wrapped_dek, iv, tag, key_id, created_at)
       VALUES (?,?,?,?,?,?) ON CONFLICT (user_id) DO NOTHING`,
      [userId, wrapped.wrapped, wrapped.iv, wrapped.tag, kid, Date.now()],
    );
    if (db.getRowsModified() === 1) {
      db.run('COMMIT');
      committed = true;
      saveDB();
      dekCache.set(userId, createdDek);
      return createdDek;
    }

    createdDek.fill(0);
    createdDek = null;
    const winner = queryOne(
      'SELECT wrapped_dek, iv, tag, key_id FROM user_photo_keys WHERE user_id = ?',
      [userId],
    );
    if (!winner?.wrapped_dek) throw new Error('無法讀取已建立的照片 DEK');
    const dek = unwrapStoredDek(winner, ringEnabled);
    db.run('COMMIT');
    committed = true;
    dekCache.set(userId, dek);
    return dek;
  } catch (error) {
    if (!committed) {
      try { db.run('ROLLBACK'); } catch { /* preserve the original error */ }
    }
    createdDek?.fill(0);
    throw error;
  } finally {
    activeKey?.key.fill(0);
    legacyMaster?.fill(0);
  }
}

/**
 * 加密一張照片。未啟用加密時原樣回傳明文（維持現狀）。
 * 回傳格式：[MAGIC][iv][tag][ciphertext]。
 */
export function encryptPhoto(userId: string, plain: Buffer): Buffer {
  if (!isPhotoEncryptionEnabled()) return plain;
  const dek = getUserDek(userId, true);
  if (!dek) return plain;
  return encryptWithDek(dek, plain);
}

/**
 * 解密一張照片。非加密內容（舊明文）原樣回傳。
 * 若內容已加密但金鑰未設定 / DEK 不存在則拋錯，避免回傳亂碼。
 */
export function decryptPhoto(userId: string, stored: Buffer): Buffer {
  if (!isEncryptedBlob(stored)) return stored; // 舊明文照片
  const dek = getUserDek(userId, false);
  if (!dek) throw new Error('找不到使用者照片金鑰，無法解密');
  return decryptWithDek(dek, stored);
}

/** 清除快取（測試用 / 金鑰輪替後）。 */
export function _resetPhotoCryptoCache(): void {
  _resetMasterKeyCache();
  for (const dek of dekCache.values()) dek.fill(0);
  dekCache.clear();
}
