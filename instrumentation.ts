import type { DatabaseLike } from './lib/db';

// instrumentation.ts — Next.js 15 穩定 API，無需 experimental.instrumentationHook
// 僅在 Node.js runtime 執行（Edge runtime 不執行此檔）

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { initDB, flushOnExit } = await import('./lib/db');
  await initDB();

  // 程序結束時保留既有關閉 hook；PostgreSQL 寫入已即時 commit。
  process.once('SIGINT', () => { flushOnExit(); process.exit(0); });
  process.once('SIGTERM', () => { flushOnExit(); process.exit(0); });

  // 稽核日誌清除排程（啟動 5s 後立即執行，之後每日午夜循環）
  registerAuditPruneJob();

  // 排程報告心跳（啟動 30s 後開始，每 SCHEDULER_TICK_MS 檢查一次）
  // 預設 1 分鐘，確保分鐘級排程（如 23:59）能準時觸發
  const SCHEDULER_TICK_MS = Number(process.env.SCHEDULER_TICK_MS) || 60 * 1000;
  unrefTimer(setTimeout(async () => {
    try {
      const { checkAndRunSchedule } = await import('./lib/scheduler');
      const { checkAndRunStockPriceUpdate } = await import('./lib/stockPriceUpdater');
      // 單一心跳同時驅動排程報表與股價自動更新；股價更新內部自我節流與交易時段閘門
      const tick = () => {
        checkAndRunSchedule();
        checkAndRunStockPriceUpdate().catch((err) => console.error('[stock-price-update]', err));
      };
      tick();
      unrefTimer(setInterval(tick, SCHEDULER_TICK_MS));
    } catch (_) {
      // scheduler.js 尚未建立時靜默略過
    }
  }, 30 * 1000));
}

// ── 稽核日誌清除（從 server.js registerAuditPruneJob 提取）──
function unrefTimer<T extends { unref?: () => void }>(timer: T): T {
  timer.unref?.();
  return timer;
}

function registerAuditPruneJob() {
  const AUDIT_RETENTION_DAYS = 90;
  const PRUNE_BATCH = 5000;

  async function tick() {
    try {
      const { getDB } = await import('./lib/db');
      const db = getDB();
      pruneTable(db, AUDIT_RETENTION_DAYS, PRUNE_BATCH);
    } catch (e) {
      console.error('[Audit Prune] tick failed', e);
    }
  }

  function pruneTable(db: Pick<DatabaseLike, 'exec' | 'run'>, retentionDays: number, batchSize: number) {
    const threshold = Date.now() - retentionDays * 86400 * 1000;
    // login_audit_logs
    while (true) {
      const res = db.exec(`SELECT id FROM login_audit_logs WHERE login_at < ${threshold} LIMIT ${batchSize}`);
      const rows = res[0]?.values || [];
      if (rows.length === 0) break;
      const placeholders = rows.map(() => '?').join(',');
      db.run(`DELETE FROM login_audit_logs WHERE id IN (${placeholders})`, rows.map((r: Array<string | number | null>) => r[0]));
      if (rows.length < batchSize) break;
    }
    // data_operation_audit_log（timestamp 欄位為 ISO 字串）
    try {
      const iso = new Date(threshold).toISOString();
      db.run(`DELETE FROM data_operation_audit_log WHERE timestamp < ?`, [iso]);
    } catch (e) {
      console.warn('[Audit Prune] data_operation_audit_log prune failed', e);
    }
  }

  // 啟動 5s 後立即執行一次
  unrefTimer(setTimeout(() => tick(), 5000));

  // 之後每日午夜（伺服器時區）循環
  function scheduleNextMidnight() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    unrefTimer(setTimeout(() => { tick(); scheduleNextMidnight(); }, next.getTime() - now.getTime()));
  }
  scheduleNextMidnight();
  console.log('[Audit Prune] registered; next run at server-local midnight');
}
