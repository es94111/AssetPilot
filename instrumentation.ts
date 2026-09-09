// instrumentation.ts — only initialize the database runtime at server startup.
// User-triggered maintenance is invoked from authenticated requests; there is
// intentionally no timer or background scheduler here so Railway can sleep.

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const { initDB, flushOnExit } = await import('./lib/db');
  await initDB();

  // 程序結束時保留既有關閉 hook；PostgreSQL 寫入已即時 commit。
  process.once('SIGINT', () => { flushOnExit(); process.exit(0); });
  process.once('SIGTERM', () => { flushOnExit(); process.exit(0); });
}
