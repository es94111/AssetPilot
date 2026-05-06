// instrumentation.js — Next.js 15 穩定 API，無需 experimental.instrumentationHook
// 僅在 Node.js runtime 執行（Edge runtime 不執行此檔）
// 注意：動態 import 使用 webpackIgnore 防止 webpack 靜態分析 Node.js 專屬模組

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // webpackIgnore: true — 防止 webpack 嘗試 bundle lib/db.js（含 path/fs/crypto 內建模組）
  // 在 standalone 模式下，相對路徑應該是相對於 instrumentation.js 所在位置
  // .next/server/instrumentation.js -> lib/db.js 是 "../../lib/db.js"
  const { initDB, flushOnExit } = await import(/* webpackIgnore: true */ '../../lib/db.js');
  await initDB();

  // 程序結束時同步寫回 DB
  process.once('SIGINT', () => { flushOnExit(); process.exit(0); });
  process.once('SIGTERM', () => { flushOnExit(); process.exit(0); });

  // 稽核日誌清除排程（啟動 5s 後立即執行，之後每日午夜循環）
  registerAuditPruneJob();

  // 排程報告心跳（啟動 30s 後開始，每 SCHEDULER_TICK_MS 檢查一次）
  const SCHEDULER_TICK_MS = Number(process.env.SCHEDULER_TICK_MS) || 5 * 60 * 1000;
  setTimeout(async () => {
    try {
      const { checkAndRunSchedule } = await import(/* webpackIgnore: true */ '../../lib/scheduler.js');
      checkAndRunSchedule();
      setInterval(checkAndRunSchedule, SCHEDULER_TICK_MS);
    } catch (_) {
      // scheduler.js 尚未建立時靜默略過
    }
  }, 30 * 1000);
}

// ── 稽核日誌清除（從 server.js registerAuditPruneJob 提取）──
function registerAuditPruneJob() {
  const AUDIT_RETENTION_DAYS = 90;
  const PRUNE_BATCH = 5000;

  async function tick() {
    try {
      const { getDB } = await import(/* webpackIgnore: true */ '../../lib/db.js');
      const db = getDB();
      pruneTable(db, AUDIT_RETENTION_DAYS, PRUNE_BATCH);
    } catch (e) {
      console.error('[Audit Prune] tick failed', e);
    }
  }

  function pruneTable(db, retentionDays, batchSize) {
    const threshold = Date.now() - retentionDays * 86400 * 1000;
    // login_audit_logs
    while (true) {
      const res = db.exec(`SELECT id FROM login_audit_logs WHERE login_at < ${threshold} LIMIT ${batchSize}`);
      const rows = res[0]?.values || [];
      if (rows.length === 0) break;
      const placeholders = rows.map(() => '?').join(',');
      db.run(`DELETE FROM login_audit_logs WHERE id IN (${placeholders})`, rows.map(r => r[0]));
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
  setTimeout(() => tick(), 5000);

  // 之後每日午夜（伺服器時區）循環
  function scheduleNextMidnight() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
    setTimeout(() => { tick(); scheduleNextMidnight(); }, next - now);
  }
  scheduleNextMidnight();
  console.log('[Audit Prune] registered; next run at server-local midnight');
}
