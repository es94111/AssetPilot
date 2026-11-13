import crypto from 'node:crypto';
import { decryptSecret, WEBHOOK_SECRET_PREFIX } from './apiTokenCore';
import { getDB, queryAll, queryOne } from './db';
import { getActiveKey, getKeyById, getLegacyKey, getLegacyKeys, isKeyringEnabled, clearKeyringCache, KEYRING_ROTATION_LOCK_NAME } from './keyring';
import {
  decryptVersionedSecret,
  encryptVersionedSecret,
  parseRootKek,
  parseVersionedSecret,
  unwrapPurposeKey,
  wrapPurposeKey,
  type KeyringPurpose,
} from './keyringCore';
import { unwrapDek, wrapDek } from './photoCryptoCore';

const BATCH_SIZE = 100;
const IN_FLIGHT_STATUSES = ['prepared', 'running', 'paused'] as const;

interface RotationJob {
  id: string;
  purpose: KeyringPurpose;
  from_kid: string;
  to_kid: string;
  status: 'prepared' | 'running' | 'paused' | 'completed' | 'rolled_back';
  cursor_id: string;
  scanned_count: number | string;
  reencrypted_count: number | string;
}

interface RotationRow {
  [key: string]: string | number | null | undefined;
  id: string;
  payload?: string | number | null;
  secret_prefix?: string | number | null;
  wrapped_dek?: string | number | null;
  iv?: string | number | null;
  tag?: string | number | null;
  key_id?: string | number | null;
}

export interface RotationPreview {
  purpose: KeyringPurpose;
  activeKid: string;
  rowsToReencrypt: number;
  message: string;
}

export interface RotationProgress {
  id: string;
  purpose: KeyringPurpose;
  status: RotationJob['status'];
  scanned: number;
  reencrypted: number;
}

export class KeyRotationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'KeyRotationError';
    this.code = code;
  }
}

function requireEnabledKeyring(): void {
  if (!isKeyringEnabled()) {
    throw new KeyRotationError(
      'KEYRING_DISABLED',
      'Keyring 尚未啟用；先完成支援新舊格式的部署，再設定 KEYRING_ENABLE=true。',
    );
  }
}

function rootKek(): Buffer {
  const root = parseRootKek(process.env.KEYRING_ROOT_KEK);
  if (!root) throw new KeyRotationError('ROOT_KEK_MISSING', '未設定 KEYRING_ROOT_KEK');
  return root;
}

function countRowsToReencrypt(purpose: KeyringPurpose, kid: string): number {
  let row: Record<string, string | number | null> | null;
  const prefix = `v1.${kid}.`;
  if (purpose === 'api-token') {
    row = queryOne(
      'SELECT COUNT(*) AS count FROM webhook_subscriptions WHERE LEFT(secret_encrypted, LENGTH(?)) <> ?',
      [prefix, prefix],
    );
  } else if (purpose === 'photo') {
    row = queryOne('SELECT COUNT(*) AS count FROM user_photo_keys WHERE key_id IS DISTINCT FROM ?', [kid]);
  } else {
    return 0;
  }
  return Number(row?.count) || 0;
}

export function previewKeyRotation(purpose: KeyringPurpose): RotationPreview {
  requireEnabledKeyring();
  const active = getActiveKey(purpose);
  if (!active) throw new KeyRotationError('ACTIVE_KEY_MISSING', `找不到 ${purpose} 用途的 active key`);
  const activeKid = active.kid;
  active.key.fill(0);
  const rowsToReencrypt = countRowsToReencrypt(purpose, activeKid);
  return {
    purpose,
    activeKid,
    rowsToReencrypt,
    message: purpose === 'jwt'
      ? 'JWT 不需資料庫重加密；新 Token 將使用新 key，舊 Token 仍由 previous/legacy key 驗證。'
      : `待重新加密資料列：${rowsToReencrypt}`,
  };
}

function testPendingKey(key: Buffer, purpose: KeyringPurpose, kid: string, root: Buffer): void {
  let unwrapped: Buffer | null = null;
  try {
    const wrapped = wrapPurposeKey(key, root, purpose, kid);
    unwrapped = unwrapPurposeKey(wrapped, root, purpose, kid);
    const probe = 'assetpilot-key-rotation-self-test';
    const encrypted = encryptVersionedSecret(probe, unwrapped, purpose, kid);
    if (decryptVersionedSecret(encrypted, unwrapped, purpose, kid) !== probe) {
      throw new KeyRotationError('KEY_SELF_TEST_FAILED', '用途金鑰自我測試未通過');
    }
  } finally {
    unwrapped?.fill(0);
  }
}

function withTransaction<T>(lockName: string, action: () => T): T {
  const db = getDB();
  db.run('BEGIN');
  try {
    const lock = queryOne('SELECT pg_try_advisory_xact_lock(hashtext(?)) AS locked', [lockName]);
    const held = Number(lock?.locked) === 1 || String(lock?.locked).toLowerCase() === 'true';
    if (!held) throw new KeyRotationError('ROTATION_BUSY', '同用途已有金鑰輪換工作正在執行');
    const result = action();
    db.run('COMMIT');
    return result;
  } catch (error) {
    try { db.run('ROLLBACK'); } catch { /* preserve the original error */ }
    throw error;
  }
}

export function prepareKeyRotation(purpose: KeyringPurpose): string {
  requireEnabledKeyring();
  const active = getActiveKey(purpose);
  if (!active) throw new KeyRotationError('ACTIVE_KEY_MISSING', `找不到 ${purpose} 用途的 active key`);
  const activeKid = active.kid;
  active.key.fill(0);

  const root = rootKek();
  const key = crypto.randomBytes(32);
  const kid = `k_${crypto.randomBytes(12).toString('base64url')}`;
  const rotationId = crypto.randomUUID();
  try {
    const wrapped = wrapPurposeKey(key, root, purpose, kid);
    testPendingKey(key, purpose, kid, root);
    withTransaction(KEYRING_ROTATION_LOCK_NAME, () => {
      const inflight = queryOne(
        `SELECT id FROM keyring_rotations WHERE purpose = ? AND status IN (${IN_FLIGHT_STATUSES.map(() => '?').join(',')}) LIMIT 1`,
        [purpose, ...IN_FLIGHT_STATUSES],
      );
      if (inflight) throw new KeyRotationError('ROTATION_IN_PROGRESS', `已有 ${purpose} 金鑰輪換工作尚未完成`);
      const current = queryOne("SELECT kid FROM keyring_keys WHERE purpose = ? AND status = 'active'", [purpose]);
      if (String(current?.kid || '') !== activeKid) {
        throw new KeyRotationError('ACTIVE_KEY_CHANGED', 'active key 已變更，請重新執行 dry-run');
      }
      const now = Date.now();
      getDB().run(
        `INSERT INTO keyring_keys
           (kid, purpose, wrapped_key, wrap_iv, wrap_tag, status, accept_legacy, created_at)
         VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)`,
        [kid, purpose, wrapped.ciphertext, wrapped.iv, wrapped.tag, now],
      );
      getDB().run(
        `INSERT INTO keyring_rotations
           (id, purpose, from_kid, to_kid, status, cursor_id, scanned_count, reencrypted_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'prepared', '', 0, 0, ?, ?)`,
        [rotationId, purpose, activeKid, kid, now, now],
      );
    });
    return rotationId;
  } finally {
    key.fill(0);
    root.fill(0);
  }
}

export function activatePreparedRotation(rotationId: string, allInstancesReady: boolean): void {
  if (!allInstancesReady) {
    throw new KeyRotationError('READINESS_NOT_CONFIRMED', '啟用前必須確認所有執行副本都已支援此 keyring 版本');
  }
  requireEnabledKeyring();
  withTransaction(KEYRING_ROTATION_LOCK_NAME, () => {
    const job = queryOne('SELECT * FROM keyring_rotations WHERE id = ?', [rotationId]) as unknown as RotationJob | null;
    if (!job || job.status !== 'prepared') {
      throw new KeyRotationError('ROTATION_NOT_PREPARED', '找不到可啟用的 prepared 輪換工作');
    }
    const active = queryOne("SELECT kid FROM keyring_keys WHERE purpose = ? AND status = 'active'", [job.purpose]);
    if (String(active?.kid || '') !== job.from_kid) {
      throw new KeyRotationError('ACTIVE_KEY_CHANGED', 'active key 已變更；prepared 輪換未啟用');
    }
    const db = getDB();
    db.run("UPDATE keyring_keys SET status = 'previous' WHERE purpose = ? AND status = 'active'", [job.purpose]);
    db.run("UPDATE keyring_keys SET status = 'active' WHERE kid = ? AND purpose = ? AND status = 'pending'", [job.to_kid, job.purpose]);
    if (db.getRowsModified() !== 1) throw new KeyRotationError('PENDING_KEY_MISSING', 'prepared key 不存在或狀態不正確');
    db.run("UPDATE keyring_rotations SET status = 'running', updated_at = ? WHERE id = ?", [Date.now(), rotationId]);
  });
  clearKeyringCache();
}

function loadJob(rotationId: string): RotationJob {
  const job = queryOne('SELECT * FROM keyring_rotations WHERE id = ?', [rotationId]) as unknown as RotationJob | null;
  if (!job) throw new KeyRotationError('ROTATION_NOT_FOUND', '找不到指定的輪換工作');
  return job;
}

function decryptForRotation(payload: string, purpose: 'api-token'): string {
  const versioned = parseVersionedSecret(payload);
  if (versioned) {
    const oldKey = getKeyById(purpose, versioned.kid);
    try {
      return decryptVersionedSecret(payload, oldKey.key, purpose, oldKey.kid);
    } finally {
      oldKey.key.fill(0);
    }
  }
  const legacy = getLegacyKey(purpose);
  if (!legacy) throw new KeyRotationError('LEGACY_KEY_MISSING', `找不到 ${purpose} legacy key`);
  try {
    const plaintext = decryptSecret(payload, legacy.key.toString('utf8'));
    if (!plaintext) throw new KeyRotationError('EMPTY_SECRET', `${purpose} 密文解開後為空`);
    return plaintext;
  } finally {
    legacy.key.fill(0);
  }
}

function rotateWebhookRow(row: RotationRow, target: { kid: string; key: Buffer }): boolean {
  const payload = String(row.payload || '');
  const versioned = parseVersionedSecret(payload);
  if (versioned?.kid === target.kid) return false;
  const plaintext = decryptForRotation(payload, 'api-token');
  const prefix = String(row.secret_prefix || '');
  if (!plaintext.startsWith(WEBHOOK_SECRET_PREFIX) || (prefix && !plaintext.startsWith(prefix))) {
    throw new KeyRotationError('SECRET_VALIDATION_FAILED', 'Webhook secret 結構驗證失敗');
  }
  const encrypted = encryptVersionedSecret(plaintext, target.key, 'api-token', target.kid);
  if (decryptVersionedSecret(encrypted, target.key, 'api-token', target.kid) !== plaintext) {
    throw new KeyRotationError('SECRET_VALIDATION_FAILED', 'Webhook secret 新密文驗證失敗');
  }
  getDB().run(
    'UPDATE webhook_subscriptions SET secret_encrypted = ? WHERE id = ? AND secret_encrypted = ?',
    [encrypted, row.id, payload],
  );
  return getDB().getRowsModified() === 1;
}

function rotatePhotoRow(row: RotationRow, target: { kid: string; key: Buffer }): boolean {
  if (String(row.key_id || '') === target.kid) return false;
  const priorKid = String(row.key_id || '');
  const priorKidValue = row.key_id == null ? null : String(row.key_id);
  const oldKeys = priorKid ? [getKeyById('photo', priorKid)] : getLegacyKeys('photo');
  if (oldKeys.length === 0) throw new KeyRotationError('LEGACY_KEY_MISSING', '找不到照片 DEK legacy key');
  let dek: Buffer | null = null;
  let verified: Buffer | null = null;
  try {
    for (const oldKey of oldKeys) {
      try {
        dek = unwrapDek(oldKey.key, String(row.wrapped_dek || ''), String(row.iv || ''), String(row.tag || ''));
        break;
      } catch {
        if (priorKid) throw new KeyRotationError('DEK_UNWRAP_FAILED', '無法使用指定照片金鑰解開 DEK');
      }
    }
    if (!dek) throw new KeyRotationError('DEK_UNWRAP_FAILED', '無法使用照片 legacy 金鑰解開 DEK');
    const rewrapped = wrapDek(target.key, dek);
    verified = unwrapDek(target.key, rewrapped.wrapped, rewrapped.iv, rewrapped.tag);
    if (!dek.equals(verified)) throw new KeyRotationError('DEK_VALIDATION_FAILED', '照片 DEK 新包裝驗證失敗');
    getDB().run(
      'UPDATE user_photo_keys SET wrapped_dek = ?, iv = ?, tag = ?, key_id = ? WHERE user_id = ? AND key_id IS NOT DISTINCT FROM ?',
      [rewrapped.wrapped, rewrapped.iv, rewrapped.tag, target.kid, row.id, priorKidValue],
    );
    return getDB().getRowsModified() === 1;
  } finally {
    dek?.fill(0);
    verified?.fill(0);
    for (const oldKey of oldKeys) oldKey.key.fill(0);
  }
}

function batchQuery(job: RotationJob): RotationRow[] {
  const cursor = String(job.cursor_id || '');
  if (job.purpose === 'api-token') {
    return queryAll(
      'SELECT id, secret_encrypted AS payload, secret_prefix FROM webhook_subscriptions WHERE id > ? ORDER BY id LIMIT ?',
      [cursor, BATCH_SIZE],
    ) as unknown as RotationRow[];
  }
  if (job.purpose === 'photo') {
    return queryAll(
      'SELECT user_id AS id, wrapped_dek, iv, tag, key_id FROM user_photo_keys WHERE user_id > ? ORDER BY user_id LIMIT ?',
      [cursor, BATCH_SIZE],
    ) as unknown as RotationRow[];
  }
  return [];
}

function markJobPaused(rotationId: string, errorCode: string): void {
  try {
    getDB().run(
      "UPDATE keyring_rotations SET status = 'paused', last_error_code = ?, updated_at = ? WHERE id = ? AND status = 'running'",
      [errorCode, Date.now(), rotationId],
    );
  } catch { /* the original migration failure is more useful than a secondary status-update failure */ }
}

function processBatch(rotationId: string): boolean {
  return withTransaction(KEYRING_ROTATION_LOCK_NAME, () => {
    const job = loadJob(rotationId);
    if (job.status !== 'running') {
      throw new KeyRotationError('ROTATION_NOT_RUNNING', '輪換工作目前不是 running 狀態');
    }
    const rows = batchQuery(job);
    if (rows.length === 0) {
      const remaining = countRowsToReencrypt(job.purpose, job.to_kid);
      if (remaining > 0) {
        getDB().run('UPDATE keyring_rotations SET cursor_id = ?, updated_at = ? WHERE id = ?', ['', Date.now(), rotationId]);
        return true;
      }
      getDB().run(
        "UPDATE keyring_rotations SET status = 'completed', completed_at = ?, updated_at = ?, last_error_code = '' WHERE id = ?",
        [Date.now(), Date.now(), rotationId],
      );
      return false;
    }

    const target = getKeyById(job.purpose, job.to_kid);
    let migrated = 0;
    try {
      for (const row of rows) {
        const changed = job.purpose === 'api-token'
          ? rotateWebhookRow(row, target)
          : job.purpose === 'photo'
            ? rotatePhotoRow(row, target)
            : false;
        if (changed) migrated++;
      }
    } finally {
      target.key.fill(0);
    }
    const last = rows[rows.length - 1];
    getDB().run(
      'UPDATE keyring_rotations SET cursor_id = ?, scanned_count = scanned_count + ?, reencrypted_count = reencrypted_count + ?, updated_at = ? WHERE id = ?',
      [last.id, rows.length, migrated, Date.now(), rotationId],
    );
    return true;
  });
}

export async function runKeyRotation(
  rotationId: string,
  onProgress?: (progress: RotationProgress) => void,
  shouldContinue: () => boolean = () => true,
): Promise<RotationProgress> {
  requireEnabledKeyring();
  let job = loadJob(rotationId);
  if (job.status === 'paused') {
    getDB().run("UPDATE keyring_rotations SET status = 'running', last_error_code = '', updated_at = ? WHERE id = ?", [Date.now(), rotationId]);
    job = loadJob(rotationId);
  }
  if (job.status !== 'running' && job.status !== 'completed') {
    throw new KeyRotationError('ROTATION_NOT_RESUMABLE', '此輪換尚未啟用或已結束，無法續跑');
  }

  try {
    while (job.status === 'running') {
      if (!shouldContinue()) {
        getDB().run("UPDATE keyring_rotations SET status = 'paused', updated_at = ? WHERE id = ? AND status = 'running'", [Date.now(), rotationId]);
        break;
      }
      const hasMore = processBatch(rotationId);
      onProgress?.(getRotationProgress(rotationId));
      if (!hasMore) break;
      await new Promise<void>(resolve => setImmediate(resolve));
      job = loadJob(rotationId);
    }
  } catch (error) {
    if (error instanceof KeyRotationError && error.code === 'ROTATION_BUSY') throw error;
    const sourceCode = String((error as { code?: unknown })?.code || '');
    const errorCode = error instanceof KeyRotationError ? error.code : sourceCode || 'ROTATION_BATCH_FAILED';
    markJobPaused(rotationId, errorCode);
    if (error instanceof KeyRotationError) throw error;
    const wrapped = new KeyRotationError('ROTATION_BATCH_FAILED', '批次重加密失敗；工作已暫停，修正問題後可用 --resume 續跑。');
    (wrapped as Error & { cause?: unknown }).cause = error;
    throw wrapped;
  }
  return getRotationProgress(rotationId);
}

export function getRotationProgress(rotationId: string): RotationProgress {
  const job = loadJob(rotationId);
  return {
    id: job.id,
    purpose: job.purpose,
    status: job.status,
    scanned: Number(job.scanned_count) || 0,
    reencrypted: Number(job.reencrypted_count) || 0,
  };
}

export function rollbackKeyRotation(rotationId: string): void {
  requireEnabledKeyring();
  const initialJob = loadJob(rotationId);
  withTransaction(KEYRING_ROTATION_LOCK_NAME, () => {
    const job = loadJob(rotationId);
    if (job.purpose !== initialJob.purpose) throw new KeyRotationError('ROTATION_CHANGED', '輪換工作狀態已變更，請重試');
    if (job.status === 'rolled_back') return;
    if (!['running', 'paused', 'completed'].includes(job.status)) {
      throw new KeyRotationError('ROTATION_NOT_ROLLBACKABLE', '此輪換目前不可回滾');
    }
    const active = queryOne("SELECT kid FROM keyring_keys WHERE purpose = ? AND status = 'active'", [job.purpose]);
    if (String(active?.kid || '') !== job.to_kid) {
      throw new KeyRotationError('ACTIVE_KEY_CHANGED', 'active key 已再次變更；為避免覆蓋新輪換，取消回滾');
    }
    const db = getDB();
    db.run("UPDATE keyring_keys SET status = 'previous' WHERE purpose = ? AND status = 'active'", [job.purpose]);
    db.run("UPDATE keyring_keys SET status = 'active' WHERE kid = ? AND purpose = ? AND status = 'previous'", [job.from_kid, job.purpose]);
    if (db.getRowsModified() !== 1) throw new KeyRotationError('PREVIOUS_KEY_MISSING', '原 active key 不存在，無法回滾');
    db.run("UPDATE keyring_rotations SET status = 'rolled_back', updated_at = ? WHERE id = ?", [Date.now(), rotationId]);
  });
  clearKeyringCache();
}

export function activateAndRun(rotationId: string, allInstancesReady: boolean): Promise<RotationProgress> {
  activatePreparedRotation(rotationId, allInstancesReady);
  return runKeyRotation(rotationId);
}

export function prepareAndRun(purpose: KeyringPurpose, allInstancesReady: boolean): Promise<RotationProgress> {
  const rotationId = prepareKeyRotation(purpose);
  activatePreparedRotation(rotationId, allInstancesReady);
  return runKeyRotation(rotationId);
}
