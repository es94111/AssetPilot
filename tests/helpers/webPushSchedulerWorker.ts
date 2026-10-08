// tests/helpers/webPushSchedulerWorker.ts — independent process for shared sweep-lease tests.
// Each child owns a separate PostgreSQL pool, like a separate application replica.
const startAt = Number(process.env.WEBPUSH_SWEEP_START_AT || 0);
const holdMs = Number(process.env.WEBPUSH_SWEEP_HOLD_MS || 0);
const userId = String(process.env.WEBPUSH_TEST_USER_ID || '');

const { PostgresCompatDatabase } = await import('../../lib/postgresRuntime.ts');
const adapter = new PostgresCompatDatabase();
globalThis.__assetPilotDb = adapter as unknown as import('../../lib/db.ts').DatabaseLike;

try {
  const [{ runDuePushEventsForAllUsers }, { __setPushTransportForTests }] = await Promise.all([
    import('../../lib/webPushEvents.ts'),
    import('../../lib/webPush.ts'),
  ]);
  if (holdMs > 0) {
    __setPushTransportForTests(async () => {
      await new Promise((resolve) => setTimeout(resolve, holdMs));
    });
  }
  while (Date.now() < startAt) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(10, startAt - Date.now())));
  }
  const scanned = await runDuePushEventsForAllUsers(
    Date.now(),
    userId ? { onlyUserId: userId } : {},
  );
  console.log(JSON.stringify({ scanned }));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  adapter.close();
}
