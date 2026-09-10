// instrumentation.ts — only initialize the database runtime at server startup.
// User-triggered maintenance is invoked from authenticated requests; there is
// intentionally no application scheduler here so Railway can sleep. Database
// reconnects are handled by lib/db.ts with unref'ed timers.

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  let flushOnExit: (() => void) | undefined;
  try {
    const db = await import('./lib/db');
    flushOnExit = db.flushOnExit;
    await db.initDB();
  } catch (error) {
    // Database availability is a runtime dependency, not a reason to make
    // Next.js fail its instrumentation hook. lib/db.ts keeps retrying with an
    // unref'ed backoff and publishes the adapter once migrations succeed.
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[db] startup connection unavailable; retrying: ${message}`);
  }

  // 程序結束時保留既有關閉 hook；PostgreSQL 寫入已即時 commit。
  if (flushOnExit) {
    process.once('SIGINT', () => { flushOnExit?.(); process.exit(0); });
    process.once('SIGTERM', () => { flushOnExit?.(); process.exit(0); });
  }
}
