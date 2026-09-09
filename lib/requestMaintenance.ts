import type { DatabaseLike } from './db';
import { getDB } from './db';

const AUDIT_RETENTION_DAYS = 90;
const AUDIT_PRUNE_BATCH_SIZE = 5_000;
const AUDIT_PRUNE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

let lastAuditPruneAt = 0;

function pruneAuditTable(
  db: Pick<DatabaseLike, 'exec' | 'run'>,
  retentionDays: number,
  batchSize: number,
) {
  const threshold = Date.now() - retentionDays * 86400 * 1000;

  // login_audit_logs 使用 Unix milliseconds。
  while (true) {
    const result = db.exec(
      `SELECT id FROM login_audit_logs WHERE login_at < ${threshold} LIMIT ${batchSize}`,
    );
    const rows = result[0]?.values || [];
    if (rows.length === 0) break;

    const placeholders = rows.map(() => '?').join(',');
    db.run(
      `DELETE FROM login_audit_logs WHERE id IN (${placeholders})`,
      rows.map((row: Array<string | number | null>) => row[0]),
    );
    if (rows.length < batchSize) break;
  }

  // data_operation_audit_log 使用 ISO timestamp 字串。
  try {
    const iso = new Date(threshold).toISOString();
    db.run('DELETE FROM data_operation_audit_log WHERE timestamp < ?', [iso]);
  } catch (error) {
    console.warn('[audit] data_operation_audit_log prune failed', error);
  }
}

/**
 * Run low-frequency maintenance only as a consequence of an authenticated
 * user request. There is deliberately no timer or startup execution.
 */
export function runAuditPruneOnUserRequest(now = Date.now()) {
  if (now - lastAuditPruneAt < AUDIT_PRUNE_COOLDOWN_MS) return;
  lastAuditPruneAt = now;

  try {
    pruneAuditTable(getDB(), AUDIT_RETENTION_DAYS, AUDIT_PRUNE_BATCH_SIZE);
  } catch (error) {
    lastAuditPruneAt = 0;
    console.error('[audit] user-triggered prune failed', error);
  }
}

/**
 * Opportunistically run work for the active user. Dynamic imports keep the
 * report and quote providers out of the authentication module's startup path.
 */
export function triggerUserRequestMaintenance(userId: string, userTimezone: string) {
  const now = Date.now();
  runAuditPruneOnUserRequest(now);

  void import('./scheduler')
    .then(({ runDueSchedulesForUser }) => {
      runDueSchedulesForUser(userId, userTimezone || 'Asia/Taipei', now);
    })
    .catch((error) => console.error('[scheduled-report] user-triggered import failed', error));

  void import('./stockPriceUpdater')
    .then(({ checkAndRunStockPriceUpdateOnUserRequest }) => checkAndRunStockPriceUpdateOnUserRequest())
    .catch((error) => console.error('[stock-price-update] user-triggered import failed', error));
}
