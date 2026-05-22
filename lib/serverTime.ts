import { getDB, queryOne, saveDB } from './db';

let serverTimeOffset: number | null = null;

export const MAX_SERVER_TIME_OFFSET_MS = 10 * 365 * 24 * 60 * 60 * 1000;

export function getServerTimeOffset(): number {
  if (serverTimeOffset === null) {
    const row = queryOne('SELECT server_time_offset FROM system_settings WHERE id = 1');
    serverTimeOffset = Number(row?.server_time_offset) || 0;
  }
  return serverTimeOffset;
}

export function setServerTimeOffset(offsetMs: number, updatedBy = ''): number {
  const nextOffset = Math.trunc(offsetMs);
  if (!Number.isFinite(nextOffset)) throw new Error('offsetMs 必須為數字（毫秒）');
  if (Math.abs(nextOffset) > MAX_SERVER_TIME_OFFSET_MS) {
    throw new Error('偏移量超過 ±10 年上限');
  }

  const db = getDB();
  db.run(
    'UPDATE system_settings SET server_time_offset = ?, updated_at = ?, updated_by = ? WHERE id = 1',
    [nextOffset, Date.now(), updatedBy]
  );
  saveDB();
  serverTimeOffset = nextOffset;
  return serverTimeOffset;
}

export function getServerTimeSnapshot() {
  const offsetMs = getServerTimeOffset();
  const realNow = Date.now();
  const effectiveNow = realNow + offsetMs;
  return {
    realNow,
    realNowIso: new Date(realNow).toISOString(),
    effectiveNow,
    effectiveNowIso: new Date(effectiveNow).toISOString(),
    offsetMs,
  };
}
