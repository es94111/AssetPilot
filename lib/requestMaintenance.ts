import type { DatabaseLike } from './db';
import { getDB } from './db';

const AUDIT_RETENTION_DAYS = 90;
const AUDIT_PRUNE_BATCH_SIZE = 5_000;
const AUDIT_PRUNE_COOLDOWN_MS = 24 * 60 * 60 * 1000;

// Webhook 待投遞佇列的排空間隔。重試最快 30 秒後才到期，故每 15 秒掃描一次
// 已足以在到期後立即投遞，同時避免每個請求都做一次全表掃描。
const WEBHOOK_DRAIN_COOLDOWN_MS = 15 * 1000;

let lastAuditPruneAt = 0;
let lastWebhookDrainAt = 0;

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

  // 雲端發票排程同步（issue #253）：每位使用者各自節流，並只同步可重試的到期載具。
  void import('./einvoiceSync')
    .then(({ runDueInvoiceSyncsForUser }) =>
      runDueInvoiceSyncsForUser(userId, userTimezone || 'Asia/Taipei', { now }),
    )
    .catch((error) => console.error('[einvoice-sync] user-triggered import failed', error));

  // Web Push 推播通知（issue #257）：帳單到期／預算超標／股利發放。
  // 與排程報表相同，只在已驗證請求中順帶掃描；發送端另有 UNIQUE 去重，
  // 因此即使多個請求同時觸發也不會重複推播（見 lib/webPush.ts）。
  void import('./webPushEvents')
    .then(({ dispatchDuePushEvents }) => dispatchDuePushEvents(userId, userTimezone || 'Asia/Taipei', now))
    .catch((error) => console.error('[web-push] user-triggered dispatch failed', error));

  // Webhook 待投遞佇列的排空（issue #258）。原本僅在「本次請求剛好排入事件」時觸發，
  // 導致重試永遠不會被後續請求拾起；改為已驗證請求順帶排空到期項目（含冷卻時間）。
  if (now - lastWebhookDrainAt >= WEBHOOK_DRAIN_COOLDOWN_MS) {
    lastWebhookDrainAt = now;
    void import('./webhookHelpers')
      .then(({ runDueWebhookDeliveries }) => runDueWebhookDeliveries(now))
      .catch((error) => console.error('[webhook] user-triggered delivery drain failed', error));
  }
}
