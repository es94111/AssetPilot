// instrumentation.ts — initialize the database runtime at server startup.
// Request-triggered maintenance is handled in lib/requestMaintenance.ts. Web Push also has
// a low-frequency unref'ed sweep so subscribed users receive day-based events while inactive;
// the timer does not keep an otherwise idle Node process alive. Database reconnects use an
// unref'ed backoff in lib/db.ts.

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

  if (process.env.NEXT_RUNTIME === 'nodejs') {
    void import('./lib/webPushEvents')
      .then(({ startWebPushScheduler }) => startWebPushScheduler())
      .catch((error) => console.error('[web-push] scheduler startup failed', error));
  }

  // 程序結束時保留既有關閉 hook；PostgreSQL 寫入已即時 commit。
  if (flushOnExit) {
    process.once('SIGINT', () => { flushOnExit?.(); process.exit(0); });
    process.once('SIGTERM', () => { flushOnExit?.(); process.exit(0); });
  }
}
