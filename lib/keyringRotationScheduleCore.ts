import type { KeyringPurpose } from './keyringCore';

export const KEYRING_ROTATION_MAX_RETRIES = 3;
export const KEYRING_ROTATION_RETRY_DELAYS_MS = [60_000, 300_000, 900_000] as const;
export const KEYRING_ROTATION_INTERVAL_MIN_DAYS = 1;
export const KEYRING_ROTATION_INTERVAL_MAX_DAYS = 3650;
export const KEYRING_ROTATION_INSTANCE_MIN = 1;
export const KEYRING_ROTATION_INSTANCE_MAX = 100;
export const KEYRING_ROTATION_HEARTBEAT_INTERVAL_MS = 30_000;
export const KEYRING_ROTATION_HEARTBEAT_TTL_MS = 120_000;
export const KEYRING_ROTATION_READINESS_GRACE_MS = 120_000;

export interface RotationReadinessSummary {
  expectedCount: number;
  observedCount: number;
  readyCount: number;
  pendingCount: number;
  failedCount: number;
}

export function isRotationReadinessSatisfied(summary: RotationReadinessSummary): boolean {
  return summary.expectedCount > 0
    && summary.observedCount >= summary.expectedCount
    && summary.readyCount === summary.observedCount
    && summary.pendingCount === 0
    && summary.failedCount === 0;
}

export function retryDelayMs(retryNumber: number): number {
  const index = Math.floor(retryNumber) - 1;
  if (index < 0 || index >= KEYRING_ROTATION_RETRY_DELAYS_MS.length) return 0;
  return KEYRING_ROTATION_RETRY_DELAYS_MS[index];
}

const TRANSIENT_ERROR_CODES = new Set([
  '08000', '08001', '08003', '08006', '08007', '08P01',
  '40001', '40P01', '53300', '53400', '57P01', '57P02', '57P03',
  'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EAI_AGAIN', 'EPIPE',
]);

export function isTransientRotationError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 3 && current && typeof current === 'object'; depth++) {
    const candidate = current as { code?: unknown; cause?: unknown };
    const code = String(candidate.code || '').toUpperCase();
    if (code === 'ROTATION_BUSY') return false;
    if (TRANSIENT_ERROR_CODES.has(code)) return true;
    if (code && code !== 'ROTATION_BATCH_FAILED') return false;
    current = candidate.cause;
  }
  return false;
}

export function isValidRotationInterval(value: unknown): value is number {
  return Number.isInteger(value)
    && Number(value) >= KEYRING_ROTATION_INTERVAL_MIN_DAYS
    && Number(value) <= KEYRING_ROTATION_INTERVAL_MAX_DAYS;
}

export function isValidExpectedInstanceCount(value: unknown): value is number {
  return Number.isInteger(value)
    && Number(value) >= KEYRING_ROTATION_INSTANCE_MIN
    && Number(value) <= KEYRING_ROTATION_INSTANCE_MAX;
}

export function isKeyringPurpose(value: unknown): value is KeyringPurpose {
  return value === 'jwt' || value === 'api-token' || value === 'einvoice' || value === 'photo';
}
