import crypto from 'node:crypto';
import { writeOperationAudit } from './auditHelpers';
import { getDB, queryAll, queryOne } from './db';
import { getPendingKeyById, isKeyringEnabled, KeyringConfigurationError } from './keyring';
import { KEYRING_PURPOSES, decryptVersionedSecret, encryptVersionedSecret, type KeyringPurpose } from './keyringCore';
import {
  activatePreparedRotation,
  KeyRotationError,
  prepareKeyRotation,
  runKeyRotation,
} from './keyringRotation';
import {
  isKeyringPurpose,
  isRotationReadinessSatisfied,
  isTransientRotationError,
  isValidExpectedInstanceCount,
  isValidRotationInterval,
  KEYRING_ROTATION_HEARTBEAT_INTERVAL_MS,
  KEYRING_ROTATION_HEARTBEAT_TTL_MS,
  KEYRING_ROTATION_INSTANCE_MAX,
  KEYRING_ROTATION_READINESS_GRACE_MS,
  KEYRING_ROTATION_MAX_RETRIES,
  retryDelayMs,
  type RotationReadinessSummary,
} from './keyringRotationScheduleCore';

const DAY_MS = 24 * 60 * 60 * 1000;
const SCHEDULER_INTERVAL_MS = 30_000;
const INSTANCE_ID = crypto.randomUUID();
const INSTANCE_STARTED_AT = Date.now();
const READINESS_PROTOCOL_VERSION = 1;

interface ScheduleRow {
  purpose: KeyringPurpose;
  enabled: number | string;
  paused: number | string;
  interval_days: number | string;
  next_run_at: number | string;
  last_started_at: number | string;
  last_completed_at: number | string;
  last_rotation_id: string;
  retry_count: number | string;
  retry_after: number | string;
  last_error_code: string;
  last_error_at: number | string;
  updated_at: number | string;
  updated_by: string;
}

interface RotationRow {
  id: string;
  purpose: KeyringPurpose;
  from_kid: string;
  to_kid: string;
  status: 'prepared' | 'running' | 'paused' | 'completed' | 'rolled_back';
  created_at: number | string;
  completed_at?: number | string;
  last_error_code?: string;
}

interface InstanceRow {
  instance_id: string;
  started_at: number | string;
  last_seen_at: number | string;
  keyring_enabled: number | string;
  protocol_version: number | string;
}

export interface RotationScheduleUpdate {
  purpose: KeyringPurpose;
  enabled: boolean;
  intervalDays: number;
}

export interface RotationSettingsUpdate {
  expectedInstanceCount: number;
  backupConfirmed: boolean;
  schedules: RotationScheduleUpdate[];
}

function asNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asBoolean(value: unknown): boolean {
  return asNumber(value) === 1;
}

function errorCode(error: unknown): string {
  if (error instanceof KeyRotationError) return error.code;
  const code = String((error as { code?: unknown })?.code || '').trim();
  return /^[A-Za-z0-9_-]{1,64}$/.test(code) ? code : 'ROTATION_RUN_FAILED';
}

function withAdvisoryLock<T>(lockName: string, action: () => T): T {
  const db = getDB();
  db.run('BEGIN');
  try {
    const lock = queryOne('SELECT pg_try_advisory_xact_lock(hashtext(?)) AS locked', [lockName]);
    const held = Number(lock?.locked) === 1 || String(lock?.locked).toLowerCase() === 'true';
    if (!held) throw new KeyRotationError('ROTATION_BUSY', 'Another key-rotation operation is in progress');
    const result = action();
    db.run('COMMIT');
    return result;
  } catch (error) {
    try { db.run('ROLLBACK'); } catch { /* preserve the original error */ }
    throw error;
  }
}

function auditSystemEvent(action: string, purpose: KeyringPurpose, rotationId: string, code: string): void {
  writeOperationAudit({
    userId: 'system',
    role: 'system',
    action,
    result: action.endsWith('.paused') ? 'failure' : 'success',
    isAdminOperation: true,
    metadata: { purpose, rotation_id: rotationId, error_code: code },
  });
}

function selfTestPendingKey(purpose: KeyringPurpose, kid: string): void {
  const key = getPendingKeyById(purpose, kid);
  const probe = crypto.randomBytes(24).toString('base64url');
  try {
    const encrypted = encryptVersionedSecret(probe, key.key, purpose, kid);
    if (decryptVersionedSecret(encrypted, key.key, purpose, kid) !== probe) {
      throw new Error('PENDING_KEY_SELF_TEST_FAILED');
    }
  } finally {
    key.key.fill(0);
  }
}

function upsertReadiness(instanceId: string, purpose: KeyringPurpose, kid: string, ready: boolean, code = ''): void {
  getDB().run(
    `INSERT INTO keyring_rotation_readiness (instance_id, purpose, kid, ready, checked_at, error_code)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (instance_id, purpose, kid) DO UPDATE SET
       ready = EXCLUDED.ready, checked_at = EXCLUDED.checked_at, error_code = EXCLUDED.error_code`,
    [instanceId, purpose, kid, ready ? 1 : 0, Date.now(), code],
  );
}

function reportInstanceHeartbeat(): void {
  let keyringEnabled = false;
  let keyringErrorCode = '';
  try {
    keyringEnabled = isKeyringEnabled();
  } catch (error) {
    keyringErrorCode = error instanceof KeyringConfigurationError ? 'KEYRING_CONFIGURATION_FAILED' : 'KEYRING_CHECK_FAILED';
  }

  const now = Date.now();
  getDB().run(
    `INSERT INTO keyring_rotation_instances (instance_id, started_at, last_seen_at, keyring_enabled, protocol_version)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT (instance_id) DO UPDATE SET
       last_seen_at = EXCLUDED.last_seen_at,
       keyring_enabled = EXCLUDED.keyring_enabled,
       protocol_version = EXCLUDED.protocol_version`,
    [INSTANCE_ID, INSTANCE_STARTED_AT, now, keyringEnabled ? 1 : 0, READINESS_PROTOCOL_VERSION],
  );

  const prepared = queryAll(
    "SELECT id, purpose, to_kid FROM keyring_rotations WHERE status = 'prepared'",
  ) as unknown as Array<{ id: string; purpose: KeyringPurpose; to_kid: string }>;
  for (const rotation of prepared) {
    if (!keyringEnabled) {
      upsertReadiness(INSTANCE_ID, rotation.purpose, rotation.to_kid, false, keyringErrorCode || 'KEYRING_DISABLED');
      continue;
    }
    try {
      selfTestPendingKey(rotation.purpose, rotation.to_kid);
      upsertReadiness(INSTANCE_ID, rotation.purpose, rotation.to_kid, true);
    } catch (error) {
      const code = error instanceof KeyringConfigurationError ? 'KEYRING_CONFIGURATION_FAILED' : 'PENDING_KEY_SELF_TEST_FAILED';
      upsertReadiness(INSTANCE_ID, rotation.purpose, rotation.to_kid, false, code);
    }
  }

  getDB().run('DELETE FROM keyring_rotation_readiness WHERE checked_at < ?', [now - 24 * 60 * 60 * 1000]);
  getDB().run('DELETE FROM keyring_rotation_instances WHERE last_seen_at < ?', [now - 7 * 24 * 60 * 60 * 1000]);
}

function readinessSummary(purpose: KeyringPurpose, kid: string, expectedCount: number, now = Date.now()): RotationReadinessSummary {
  const cutoff = now - KEYRING_ROTATION_HEARTBEAT_TTL_MS;
  const instances = queryAll(
    'SELECT instance_id FROM keyring_rotation_instances WHERE last_seen_at >= ?',
    [cutoff],
  ) as unknown as Array<{ instance_id: string }>;
  const rows = queryAll(
    `SELECT r.instance_id, r.ready, r.checked_at
     FROM keyring_rotation_readiness r
     INNER JOIN keyring_rotation_instances i ON i.instance_id = r.instance_id
     WHERE r.purpose = ? AND r.kid = ? AND i.last_seen_at >= ? AND r.checked_at >= ?`,
    [purpose, kid, cutoff, cutoff],
  ) as unknown as Array<{ instance_id: string; ready: number | string; checked_at: number | string }>;
  const readyCount = rows.filter(row => asBoolean(row.ready)).length;
  const failedCount = rows.length - readyCount;
  return {
    expectedCount,
    observedCount: instances.length,
    readyCount,
    pendingCount: Math.max(0, instances.length - rows.length),
    failedCount,
  };
}

function currentRotation(purpose: KeyringPurpose): RotationRow | null {
  return queryOne(
    `SELECT id, purpose, from_kid, to_kid, status, created_at, completed_at, last_error_code
     FROM keyring_rotations WHERE purpose = ? AND status IN ('prepared', 'running', 'paused') LIMIT 1`,
    [purpose],
  ) as unknown as RotationRow | null;
}

function updateScheduleRotation(purpose: KeyringPurpose, rotationId: string, startedAt: number): void {
  getDB().run(
    `UPDATE keyring_rotation_schedules
     SET last_rotation_id = ?, last_started_at = CASE WHEN last_started_at = 0 THEN ? ELSE last_started_at END,
         updated_at = ?
     WHERE purpose = ?`,
    [rotationId, startedAt, Date.now(), purpose],
  );
}

function recordCompletedRotation(purpose: KeyringPurpose, rotationId: string, completedAt: number): void {
  const row = queryOne('SELECT interval_days, last_completed_at FROM keyring_rotation_schedules WHERE purpose = ?', [purpose]) as unknown as { interval_days: number | string; last_completed_at: number | string } | null;
  if (!row || completedAt <= asNumber(row.last_completed_at)) return;
  const nextRunAt = completedAt + asNumber(row.interval_days) * DAY_MS;
  getDB().run(
    `UPDATE keyring_rotation_schedules
     SET last_rotation_id = ?, last_completed_at = ?, next_run_at = ?, retry_count = 0,
         retry_after = 0, last_error_code = '', last_error_at = 0, updated_at = ?
     WHERE purpose = ? AND last_rotation_id = ?`,
    [rotationId, completedAt, nextRunAt, Date.now(), purpose, rotationId],
  );
  auditSystemEvent('keyring.rotation.completed', purpose, rotationId, '');
}

function pauseForSafetyFailure(purpose: KeyringPurpose, rotationId: string, code: string): void {
  const now = Date.now();
  withAdvisoryLock('assetpilot:keyring:rotation-settings', () => {
    getDB().run(
      `UPDATE keyring_rotation_schedules
       SET paused = 1, retry_after = 0, last_error_code = ?, last_error_at = ?, updated_at = ?
       WHERE purpose = ? AND paused = 0`,
      [code, now, now, purpose],
    );
  });
  auditSystemEvent('keyring.rotation.paused', purpose, rotationId, code);
  console.error(JSON.stringify({ event: 'keyring_rotation_paused', purpose, rotationId, code }));
}

function isRotationCoordinationRace(error: unknown): boolean {
  return error instanceof KeyRotationError
    && ['ROTATION_BUSY', 'ROTATION_IN_PROGRESS'].includes(error.code);
}

function scheduleRetryOrPause(purpose: KeyringPurpose, rotationId: string, error: unknown): void {
  if (isRotationCoordinationRace(error)) return;
  const code = errorCode(error);
  const now = Date.now();
  const schedule = queryOne('SELECT retry_count, paused FROM keyring_rotation_schedules WHERE purpose = ?', [purpose]) as unknown as { retry_count: number | string; paused: number | string } | null;
  if (!schedule || asBoolean(schedule.paused)) return;

  if (isTransientRotationError(error) && asNumber(schedule.retry_count) < KEYRING_ROTATION_MAX_RETRIES) {
    const retryNumber = asNumber(schedule.retry_count) + 1;
    const delay = retryDelayMs(retryNumber);
    withAdvisoryLock('assetpilot:keyring:rotation-settings', () => {
      getDB().run(
        `UPDATE keyring_rotation_schedules
         SET retry_count = ?, retry_after = ?, last_error_code = ?, last_error_at = ?, updated_at = ?
         WHERE purpose = ? AND paused = 0`,
        [retryNumber, now + delay, code, now, now, purpose],
      );
    });
    console.warn(JSON.stringify({ event: 'keyring_rotation_retry_scheduled', purpose, rotationId, retryNumber, delayMs: delay, code }));
    return;
  }
  pauseForSafetyFailure(purpose, rotationId, isTransientRotationError(error) ? 'RETRY_LIMIT_EXCEEDED' : code);
}

function pausedState(purpose: KeyringPurpose): boolean {
  const row = queryOne('SELECT paused FROM keyring_rotation_schedules WHERE purpose = ?', [purpose]);
  return asBoolean(row?.paused);
}

async function runPurposeSchedule(purpose: KeyringPurpose): Promise<void> {
  let schedule = queryOne('SELECT * FROM keyring_rotation_schedules WHERE purpose = ?', [purpose]) as unknown as ScheduleRow | null;
  if (!schedule || !asBoolean(schedule.enabled) || asBoolean(schedule.paused)) return;
  const now = Date.now();
  if (asNumber(schedule.retry_after) > now) return;

  let rotation = currentRotation(purpose);
  if (!rotation && schedule.last_rotation_id) {
    const previous = queryOne(
      'SELECT id, purpose, from_kid, to_kid, status, created_at, completed_at FROM keyring_rotations WHERE id = ?',
      [schedule.last_rotation_id],
    ) as unknown as RotationRow | null;
    if (previous?.status === 'completed') {
      recordCompletedRotation(purpose, previous.id, asNumber(previous.completed_at));
      schedule = queryOne('SELECT * FROM keyring_rotation_schedules WHERE purpose = ?', [purpose]) as unknown as ScheduleRow | null;
      if (!schedule || !asBoolean(schedule.enabled) || asBoolean(schedule.paused)) return;
    }
  }

  if (!rotation) {
    if (asNumber(schedule.next_run_at) > now) return;
    const active = queryOne("SELECT kid FROM keyring_keys WHERE purpose = ? AND status = 'active'", [purpose]);
    if (!active) throw new KeyRotationError('ACTIVE_KEY_MISSING', `No active ${purpose} key is available`);
    const rotationId = prepareKeyRotation(purpose);
    updateScheduleRotation(purpose, rotationId, Date.now());
    reportInstanceHeartbeat();
    rotation = currentRotation(purpose);
    if (!rotation) return;
  }

  updateScheduleRotation(purpose, rotation.id, asNumber(rotation.created_at));
  if (rotation.status === 'prepared') {
    const summary = readinessSummary(purpose, rotation.to_kid, asNumber((queryOne('SELECT expected_instance_count FROM keyring_rotation_settings WHERE id = 1') as { expected_instance_count?: number | string } | null)?.expected_instance_count));
    if (!isRotationReadinessSatisfied(summary)) {
      const age = now - asNumber(rotation.created_at);
      if (summary.failedCount > 0 || age >= KEYRING_ROTATION_READINESS_GRACE_MS) {
        pauseForSafetyFailure(purpose, rotation.id, summary.failedCount > 0 ? 'REPLICA_READINESS_FAILED' : 'REPLICA_READINESS_INCOMPLETE');
      }
      return;
    }
    try {
      activatePreparedRotation(rotation.id, true);
    } catch (error) {
      if (!(error instanceof KeyRotationError && error.code === 'ROTATION_NOT_PREPARED')) throw error;
      const latest = currentRotation(purpose);
      if (latest?.status !== 'running') return;
    }
  }

  const latest = currentRotation(purpose);
  if (!latest || !['running', 'paused'].includes(latest.status)) return;
  const progress = await runKeyRotation(latest.id, undefined, () => !pausedState(purpose));
  if (progress.status === 'completed') {
    const completed = queryOne('SELECT completed_at FROM keyring_rotations WHERE id = ?', [latest.id]);
    recordCompletedRotation(purpose, latest.id, asNumber(completed?.completed_at));
  }
}

async function runSchedulerTick(): Promise<void> {
  try {
    reportInstanceHeartbeat();
  } catch (error) {
    console.error(JSON.stringify({ event: 'keyring_rotation_heartbeat_failed', code: errorCode(error) }));
    return;
  }
  let enabled = false;
  try {
    enabled = isKeyringEnabled();
  } catch {
    return;
  }
  if (!enabled) return;

  for (const purpose of KEYRING_PURPOSES) {
    try {
      await runPurposeSchedule(purpose);
    } catch (error) {
      const rotation = currentRotation(purpose);
      scheduleRetryOrPause(purpose, rotation?.id || '', error);
      if (!isRotationCoordinationRace(error)) {
        console.error(JSON.stringify({ event: 'keyring_rotation_run_failed', purpose, rotationId: rotation?.id || '', code: errorCode(error) }));
      }
    }
  }
}

let schedulerStarted = false;
let schedulerRunning = false;

export function startKeyringRotationScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  const heartbeatTimer = setInterval(() => {
    try {
      reportInstanceHeartbeat();
    } catch (error) {
      console.error(JSON.stringify({ event: 'keyring_rotation_heartbeat_failed', code: errorCode(error) }));
    }
  }, KEYRING_ROTATION_HEARTBEAT_INTERVAL_MS);
  heartbeatTimer.unref?.();

  const schedulerTimer = setInterval(() => {
    if (schedulerRunning) return;
    schedulerRunning = true;
    void runSchedulerTick().finally(() => { schedulerRunning = false; });
  }, SCHEDULER_INTERVAL_MS);
  schedulerTimer.unref?.();

  try {
    reportInstanceHeartbeat();
  } catch (error) {
    console.error(JSON.stringify({ event: 'keyring_rotation_heartbeat_failed', code: errorCode(error) }));
  }
  void runSchedulerTick();
}

function readinessForStatus(purpose: KeyringPurpose, rotation: RotationRow | null, expectedCount: number, now: number) {
  if (!rotation || rotation.status !== 'prepared') return null;
  const summary = readinessSummary(purpose, rotation.to_kid, expectedCount, now);
  return { rotationId: rotation.id, kid: rotation.to_kid, status: rotation.status, ...summary, ready: isRotationReadinessSatisfied(summary) };
}

export function getKeyringRotationAdminStatus(): Record<string, unknown> {
  const now = Date.now();
  let keyringEnabled = false;
  let keyringErrorCode = '';
  try {
    keyringEnabled = isKeyringEnabled();
  } catch (error) {
    keyringErrorCode = error instanceof KeyringConfigurationError ? 'KEYRING_CONFIGURATION_FAILED' : 'KEYRING_CHECK_FAILED';
  }
  const settings = queryOne('SELECT expected_instance_count, backup_confirmed_at, backup_confirmed_by FROM keyring_rotation_settings WHERE id = 1') as unknown as {
    expected_instance_count: number | string;
    backup_confirmed_at: number | string;
    backup_confirmed_by: string;
  } | null;
  const schedules = queryAll('SELECT * FROM keyring_rotation_schedules ORDER BY purpose') as unknown as ScheduleRow[];
  const instances = queryAll(
    `SELECT instance_id, started_at, last_seen_at, keyring_enabled, protocol_version
     FROM keyring_rotation_instances WHERE last_seen_at >= ? ORDER BY last_seen_at DESC`,
    [now - 24 * 60 * 60 * 1000],
  ) as unknown as InstanceRow[];
  const activeKeys = queryAll(
    `SELECT kid, purpose, status, created_at, retired_at
     FROM keyring_keys WHERE status IN ('active', 'previous', 'pending') ORDER BY purpose, created_at DESC`,
  ) as unknown as Array<{ kid: string; purpose: KeyringPurpose; status: string; created_at: number | string; retired_at: number | string }>;
  const rotations = queryAll(
    `SELECT id, purpose, from_kid, to_kid, status, cursor_id, scanned_count, reencrypted_count,
            created_at, updated_at, completed_at, last_error_code
     FROM keyring_rotations ORDER BY updated_at DESC LIMIT 20`,
  ) as unknown as Array<Record<string, string | number | null>>;
  const expectedCount = asNumber(settings?.expected_instance_count) || 1;
  const readiness = KEYRING_PURPOSES.map(purpose => {
    const pending = currentRotation(purpose);
    return readinessForStatus(purpose, pending, expectedCount, now);
  }).filter(Boolean);
  return {
    keyringEnabled,
    keyringErrorCode,
    expectedInstanceCount: expectedCount,
    backupConfirmedAt: asNumber(settings?.backup_confirmed_at),
    backupConfirmedBy: settings?.backup_confirmed_by || '',
    freshInstanceCount: instances.filter(instance => now - asNumber(instance.last_seen_at) <= KEYRING_ROTATION_HEARTBEAT_TTL_MS).length,
    instances: instances.map(instance => ({
      id: String(instance.instance_id).slice(0, 8),
      lastSeenAt: asNumber(instance.last_seen_at),
      keyringEnabled: asBoolean(instance.keyring_enabled),
      protocolVersion: asNumber(instance.protocol_version),
      online: now - asNumber(instance.last_seen_at) <= KEYRING_ROTATION_HEARTBEAT_TTL_MS,
    })),
    schedules: schedules.map(schedule => ({
      purpose: schedule.purpose,
      enabled: asBoolean(schedule.enabled),
      paused: asBoolean(schedule.paused),
      intervalDays: asNumber(schedule.interval_days),
      nextRunAt: asNumber(schedule.next_run_at),
      lastStartedAt: asNumber(schedule.last_started_at),
      lastCompletedAt: asNumber(schedule.last_completed_at),
      lastRotationId: schedule.last_rotation_id,
      retryCount: asNumber(schedule.retry_count),
      retryAfter: asNumber(schedule.retry_after),
      lastErrorCode: schedule.last_error_code,
      lastErrorAt: asNumber(schedule.last_error_at),
      updatedAt: asNumber(schedule.updated_at),
      updatedBy: schedule.updated_by,
    })),
    activeKeys: activeKeys.map(key => ({
      kid: key.kid,
      purpose: key.purpose,
      status: key.status,
      createdAt: asNumber(key.created_at),
      retiredAt: asNumber(key.retired_at),
    })),
    rotations: rotations.map(rotation => ({
      id: rotation.id,
      purpose: rotation.purpose,
      fromKid: rotation.from_kid,
      toKid: rotation.to_kid,
      status: rotation.status,
      scanned: asNumber(rotation.scanned_count),
      reencrypted: asNumber(rotation.reencrypted_count),
      createdAt: asNumber(rotation.created_at),
      updatedAt: asNumber(rotation.updated_at),
      completedAt: asNumber(rotation.completed_at),
      lastErrorCode: rotation.last_error_code,
    })),
    readiness,
  };
}

export function updateKeyringRotationSettings(input: RotationSettingsUpdate, userId: string): void {
  if (!input || !isValidExpectedInstanceCount(input.expectedInstanceCount)) {
    throw new KeyRotationError('INVALID_INSTANCE_COUNT', `Expected instance count must be between 1 and ${KEYRING_ROTATION_INSTANCE_MAX}`);
  }
  if (typeof input.backupConfirmed !== 'boolean' || !Array.isArray(input.schedules) || input.schedules.length !== KEYRING_PURPOSES.length) {
    throw new KeyRotationError('INVALID_ROTATION_SETTINGS', 'Invalid automatic rotation settings');
  }
  const seen = new Set<KeyringPurpose>();
  for (const schedule of input.schedules) {
    if (!schedule || !isKeyringPurpose(schedule.purpose) || seen.has(schedule.purpose)
      || typeof schedule.enabled !== 'boolean' || !isValidRotationInterval(schedule.intervalDays)) {
      throw new KeyRotationError('INVALID_ROTATION_SETTINGS', 'Invalid automatic rotation schedule');
    }
    seen.add(schedule.purpose);
  }
  if (seen.size !== KEYRING_PURPOSES.length) {
    throw new KeyRotationError('INVALID_ROTATION_SETTINGS', 'A schedule is required for every key purpose');
  }

  const enabling = input.schedules.some(schedule => schedule.enabled);
  const keyringEnabled = enabling ? isKeyringEnabled() : false;
  if (enabling && !keyringEnabled) throw new KeyRotationError('KEYRING_DISABLED', 'Keyring must be enabled before automatic rotation');

  withAdvisoryLock('assetpilot:keyring:rotation-settings', () => {
    const now = Date.now();
    const currentSettings = queryOne('SELECT backup_confirmed_at FROM keyring_rotation_settings WHERE id = 1');
    const backupConfirmedAt = input.backupConfirmed ? now : asNumber(currentSettings?.backup_confirmed_at);
    if (enabling && backupConfirmedAt <= 0) {
      throw new KeyRotationError('BACKUP_NOT_CONFIRMED', 'Confirm that database backups are configured and tested before enabling scheduled rotation');
    }

    getDB().run(
      `UPDATE keyring_rotation_settings
       SET expected_instance_count = ?, backup_confirmed_at = ?, backup_confirmed_by = ?, updated_at = ?, updated_by = ?
       WHERE id = 1`,
      [input.expectedInstanceCount, backupConfirmedAt, input.backupConfirmed ? userId : String(queryOne('SELECT backup_confirmed_by FROM keyring_rotation_settings WHERE id = 1')?.backup_confirmed_by || ''), now, userId],
    );

    for (const update of input.schedules) {
      const current = queryOne('SELECT enabled, interval_days, next_run_at, last_completed_at FROM keyring_rotation_schedules WHERE purpose = ?', [update.purpose]) as unknown as {
        enabled: number | string; interval_days: number | string; next_run_at: number | string; last_completed_at: number | string;
      } | null;
      if (update.enabled) {
        const active = queryOne("SELECT kid FROM keyring_keys WHERE purpose = ? AND status = 'active'", [update.purpose]);
        if (!active) throw new KeyRotationError('ACTIVE_KEY_MISSING', `No active ${update.purpose} key is available`);
      }
      const wasEnabled = asBoolean(current?.enabled);
      const intervalChanged = asNumber(current?.interval_days) !== update.intervalDays;
      let nextRunAt = asNumber(current?.next_run_at);
      if (update.enabled && (!wasEnabled || intervalChanged || nextRunAt <= 0)) {
        nextRunAt = Math.max(now, asNumber(current?.last_completed_at)) + update.intervalDays * DAY_MS;
      }
      getDB().run(
        `UPDATE keyring_rotation_schedules
         SET enabled = ?, interval_days = ?, next_run_at = ?, updated_at = ?, updated_by = ?
         WHERE purpose = ?`,
        [update.enabled ? 1 : 0, update.intervalDays, nextRunAt, now, userId, update.purpose],
      );
    }
  });
}

export function setKeyringRotationPaused(purpose: KeyringPurpose, paused: boolean, userId: string): void {
  if (!isKeyringPurpose(purpose) || typeof paused !== 'boolean') {
    throw new KeyRotationError('INVALID_ROTATION_ACTION', 'Invalid key purpose or pause state');
  }
  withAdvisoryLock('assetpilot:keyring:rotation-operations', () => {
    const row = queryOne('SELECT paused FROM keyring_rotation_schedules WHERE purpose = ?', [purpose]);
    if (!row) throw new KeyRotationError('SCHEDULE_NOT_FOUND', 'Automatic rotation schedule was not found');
    const now = Date.now();
    getDB().run(
      `UPDATE keyring_rotation_schedules
       SET paused = ?, retry_after = ?, last_error_code = ?, last_error_at = ?, updated_at = ?, updated_by = ?
       WHERE purpose = ?`,
      [paused ? 1 : 0, 0, paused ? 'ADMIN_PAUSED' : '', paused ? now : 0, now, userId, purpose],
    );
    if (paused) {
      getDB().run(
        `UPDATE keyring_rotations SET status = 'paused', last_error_code = 'ADMIN_PAUSED', updated_at = ?
         WHERE purpose = ? AND status = 'running'`,
        [now, purpose],
      );
    } else {
      getDB().run(
        `UPDATE keyring_rotations SET last_error_code = '', updated_at = ?
         WHERE purpose = ? AND status = 'prepared' AND last_error_code = 'ADMIN_PAUSED'`,
        [now, purpose],
      );
    }
  });
}
