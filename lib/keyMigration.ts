import * as fs from 'node:fs';
import * as path from 'node:path';
import { getDB, queryAll } from './db.ts';
import { clearKeyringCache, createFreshKeyring, getActiveKey, isKeyringEnabled } from './keyring.ts';
import { parseRootKek } from './keyringCore.ts';
import { createPostgresBackupSql, restorePostgresBackupSql, type AnyRow } from './postgresBackup.ts';
import { _resetPhotoCryptoCache, unwrapStoredDek } from './photoCrypto.ts';
import { unwrapDek, wrapDek } from './photoCryptoCore.ts';
import { decryptWebhookSecret, encryptWebhookSecret } from './webhookHelpers.ts';
import {
  buildMigrationPayload,
  packMigrationArchive,
  unpackMigrationArchive,
  type MigrationPayload,
  type MigrationSecrets,
} from './migrationArchive.ts';

export interface MigrationStats {
  photoDeks: number;
  webhookSecrets: number;
  sqlBytes: number;
}

const DROPPED_TABLES = new Set([
  'keyring_keys',
  'keyring_control',
  'user_photo_keys',
  'keyring_rotations',
  'keyring_rotation_readiness',
  'keyring_rotation_instances',
]);

// 這些資料表在匯出時移除或清空，改由匯入端用新金鑰重建。
export function transformBackupRow(table: string, row: AnyRow): AnyRow | null {
  if (DROPPED_TABLES.has(table)) return null;
  if (table === 'webhook_subscriptions') return { ...row, secret_encrypted: '' };
  // 舊的輪換紀錄參照舊 kid，新環境不保留，排程重置錯誤／重試狀態。
  if (table === 'keyring_rotation_schedules') {
    return { ...row, last_rotation_id: '', retry_count: 0, retry_after: 0, last_error_code: '', last_error_at: 0 };
  }
  return row;
}

export function collectSecrets(
  photoRows: AnyRow[],
  webhookRows: AnyRow[],
  unwrap: (row: AnyRow) => Buffer,
  decrypt: (payload: string) => string,
): MigrationSecrets {
  const photoDeks = photoRows.map((row) => {
    let dek: Buffer;
    try {
      dek = unwrap(row);
    } catch {
      throw new Error(`無法解密使用者 ${String(row.user_id)} 的照片金鑰，匯出中止`);
    }
    return {
      user_id: String(row.user_id),
      dek: dek.toString('base64'),
      created_at: Number(row.created_at) || 0,
    };
  });
  const webhookSecrets = webhookRows.map((row) => {
    try {
      return { id: String(row.id), secret: decrypt(String(row.secret_encrypted)) };
    } catch {
      throw new Error(`無法解密 Webhook ${String(row.id)} 的 secret，匯出中止`);
    }
  });
  return { photoDeks, webhookSecrets };
}

export function exportMigration(migrationKey: Buffer): { archive: Buffer; stats: MigrationStats } {
  const sql = createPostgresBackupSql({ transformRow: transformBackupRow });
  const ringEnabled = isKeyringEnabled();
  const secrets = collectSecrets(
    queryAll('SELECT user_id, wrapped_dek, iv, tag, key_id, created_at FROM user_photo_keys') as AnyRow[],
    queryAll('SELECT id, secret_encrypted FROM webhook_subscriptions') as AnyRow[],
    (row) => unwrapStoredDek(row as Record<string, string | number | null>, ringEnabled),
    decryptWebhookSecret,
  );
  const archive = packMigrationArchive(buildMigrationPayload(sql, secrets), migrationKey);
  return {
    archive,
    stats: {
      photoDeks: secrets.photoDeks.length,
      webhookSecrets: secrets.webhookSecrets.length,
      sqlBytes: Buffer.byteLength(sql),
    },
  };
}

function applySecrets(secrets: MigrationSecrets): void {
  const photo = getActiveKey('photo');
  if (!photo && secrets.photoDeks.length > 0) throw new Error('新 keyring 缺少 photo 金鑰');
  const db = getDB();
  for (const item of secrets.photoDeks) {
    const dek = Buffer.from(item.dek, 'base64');
    const wrapped = wrapDek(photo!.key, dek);
    db.run(
      'INSERT INTO user_photo_keys (user_id, wrapped_dek, iv, tag, key_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [item.user_id, wrapped.wrapped, wrapped.iv, wrapped.tag, photo!.kid, item.created_at],
    );
  }
  for (const item of secrets.webhookSecrets) {
    db.run('UPDATE webhook_subscriptions SET secret_encrypted = ? WHERE id = ?', [
      encryptWebhookSecret(item.secret),
      item.id,
    ]);
  }
}

function verifySecrets(secrets: MigrationSecrets): void {
  const photo = getActiveKey('photo');
  const stored = new Map(
    (queryAll('SELECT user_id, wrapped_dek, iv, tag FROM user_photo_keys') as AnyRow[]).map((row) => [
      String(row.user_id),
      row,
    ]),
  );
  for (const item of secrets.photoDeks) {
    const row = stored.get(item.user_id);
    if (!row || !photo) throw new Error(`驗證失敗：缺少使用者 ${item.user_id} 的照片金鑰`);
    const dek = unwrapDek(photo.key, String(row.wrapped_dek), String(row.iv), String(row.tag));
    if (dek.toString('base64') !== item.dek) throw new Error(`驗證失敗：使用者 ${item.user_id} 的照片金鑰不一致`);
  }
  const webhooks = new Map(
    (queryAll('SELECT id, secret_encrypted FROM webhook_subscriptions') as AnyRow[]).map((row) => [
      String(row.id),
      String(row.secret_encrypted),
    ]),
  );
  for (const item of secrets.webhookSecrets) {
    const payload = webhooks.get(item.id);
    if (!payload || decryptWebhookSecret(payload) !== item.secret) {
      throw new Error(`驗證失敗：Webhook ${item.id} 的 secret 不一致`);
    }
  }
  for (const purpose of ['jwt', 'api-token', 'photo'] as const) {
    if (!getActiveKey(purpose)) throw new Error(`驗證失敗：缺少 ${purpose} active key`);
  }
}

function resetCaches(): void {
  clearKeyringCache();
  _resetPhotoCryptoCache();
}

export function importMigration(
  archive: Buffer,
  migrationKey: Buffer,
  options: { backupDir?: string } = {},
): MigrationStats {
  const payload: MigrationPayload = unpackMigrationArchive(archive, migrationKey);
  const root = parseRootKek(process.env.KEYRING_ROOT_KEK);
  if (!root) throw new Error('必須設定新的 KEYRING_ROOT_KEK 才能匯入');

  const backupDir = options.backupDir || path.join(process.cwd(), 'backups');
  fs.mkdirSync(backupDir, { recursive: true });
  const beforeSql = createPostgresBackupSql();
  const beforePath = path.join(backupDir, `before-migration-${Date.now()}.sql`);
  fs.writeFileSync(beforePath, beforeSql, { mode: 0o600 });

  try {
    restorePostgresBackupSql(payload.sql);
    createFreshKeyring(root);
    resetCaches();
    const db = getDB();
    db.run('BEGIN');
    try {
      applySecrets(payload.secrets);
      verifySecrets(payload.secrets);
      db.run('COMMIT');
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }
  } catch (error) {
    try {
      restorePostgresBackupSql(beforeSql);
    } finally {
      resetCaches();
    }
    throw new Error(
      `匯入失敗，已還原至匯入前狀態（${beforePath}）：${error instanceof Error ? error.message : String(error)}`,
    );
  }
  resetCaches();
  return {
    photoDeks: payload.secrets.photoDeks.length,
    webhookSecrets: payload.secrets.webhookSecrets.length,
    sqlBytes: Buffer.byteLength(payload.sql),
  };
}
