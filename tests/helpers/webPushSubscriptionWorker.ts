// tests/helpers/webPushSubscriptionWorker.ts — independent process for subscription race tests.
// Each process owns a separate PostgreSQL pool/transaction, matching multi-instance deployment.
const userId = String(process.env.WEBPUSH_TEST_USER_ID || '');
const endpoint = String(process.env.WEBPUSH_TEST_ENDPOINT || '');
if (!userId || !endpoint) throw new Error('WEBPUSH_TEST_USER_ID and WEBPUSH_TEST_ENDPOINT are required');

const { PostgresCompatDatabase } = await import('../../lib/postgresRuntime.ts');
const adapter = new PostgresCompatDatabase();
globalThis.__assetPilotDb = adapter as unknown as import('../../lib/db.ts').DatabaseLike;

try {
  const { savePushSubscription } = await import('../../lib/webPush.ts');
  const result = savePushSubscription(userId, {
    endpoint,
    keys: { p256dh: 'S'.repeat(87), auth: 'T'.repeat(22) },
  });
  console.log(JSON.stringify({ ok: true, ...result }));
} catch (error) {
  console.log(JSON.stringify({
    ok: false,
    code: error instanceof Error && 'code' in error ? String(error.code) : 'UnexpectedError',
    error: error instanceof Error ? error.message : String(error),
  }));
  if (!(error instanceof Error) || !('code' in error)) process.exitCode = 1;
} finally {
  adapter.close();
}
