import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import dns from 'node:dns';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import test, { after } from 'node:test';

if (!process.env.DATABASE_URL) {
  test('notification capture route integration', { skip: 'Requires a PostgreSQL test database' }, () => {});
} else {
  const origin = 'https://notification-tests.example';
  process.env.APP_URL = origin;
  process.env.NOTIFICATION_AI_SETTINGS_KEY = '12'.repeat(32);
  const { NextRequest } = await import('next/server');
  const { getDB, initDB, queryOne } = await import('../../lib/db');
  const { createLoginSession, revokeLoginSession } = await import('../../lib/sessionHelpers');
  const { issueCaptureToken } = await import('../../lib/notificationCaptureStore');
  const admin = await import('../../app/api/admin/notification-ai/route');
  const capture = await import('../../app/api/app/notification-capture/route');
  const parse = await import('../../app/api/app/notification-capture/parse/route');
  const transactions = await import('../../app/api/transactions/route');
  const accounts = await import('../../app/api/accounts/route');

  await initDB();
  after(() => getDB().close());

  test('recognition is draft-only, session-scoped and posts exactly once after review', async (t) => {
    const db = getDB();
    if (queryOne('SELECT id FROM notification_ai_settings WHERE id = 1')) {
      t.skip('Requires an empty notification settings row in the test database');
      return;
    }
    const userId = `notify-user-${randomUUID()}`;
    const adminId = `notify-admin-${randomUUID()}`;
    const deviceId = randomUUID();
    const accountId = randomUUID();
    for (const id of [userId, adminId]) {
      db.run(`INSERT INTO users (id, email, password_hash, display_name, is_admin, admin_role, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`, [id, `${id}@example.com`, 'test', 'Fixture', id === adminId ? 1 : 0, 'super', new Date().toISOString()]);
    }
    db.run('INSERT INTO accounts (id, user_id, name, currency, initial_balance) VALUES (?, ?, ?, ?, ?)',
      [accountId, userId, '測試錢包', 'TWD', 1000]);
    t.after(() => {
      db.run('DELETE FROM notification_ai_settings WHERE id = 1');
      for (const id of [userId, adminId]) {
        db.run('DELETE FROM transactions WHERE user_id = ?', [id]);
        db.run('DELETE FROM accounts WHERE user_id = ?', [id]);
        db.run('DELETE FROM ledger_audit_log WHERE actor_user_id = ?', [id]);
        db.run('DELETE FROM ledger_members WHERE user_id = ?', [id]);
        db.run('DELETE FROM financial_ledgers WHERE owner_user_id = ?', [id]);
        db.run('DELETE FROM login_sessions WHERE user_id = ?', [id]);
        db.run('DELETE FROM users WHERE id = ?', [id]);
      }
    });

    const appHeaders = { 'x-assetpilot-device-id': deviceId, 'user-agent': 'AssetPilotApp (iOS)' };
    const adminSession = createLoginSession(adminId, 0, {});
    const mobileSession = createLoginSession(userId, 0, appHeaders);
    function request(method: string, path: string, userHeaders: Record<string, string> = {}, body?: object) {
      return new NextRequest(`${origin}${path}`, {
        method,
        headers: { origin, 'content-type': 'application/json', ...userHeaders },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    }
    const adminHeaders = { cookie: `authToken=${adminSession.token}` };
    const mobileHeaders = { cookie: `authToken=${mobileSession.token}`, ...appHeaders };
    const adminPath = '/api/admin/notification-ai';
    const capturePath = '/api/app/notification-capture';
    const parsePath = `${capturePath}/parse`;
    const accountPath = '/api/accounts';
    const txPath = '/api/transactions';

    const before = await (await capture.GET(request('GET', capturePath, mobileHeaders))).json();
    assert.equal(before.available, false);
    assert.equal((await admin.GET(request('GET', adminPath, mobileHeaders))).status, 403);

    const apiKey = 'test-notification-provider-key';
    const settings = { endpoint: 'https://recognizer.example/v1/', model: 'test-model', enabled: true, version: 0, apiKey };
    const saved = await admin.PUT(request('PUT', adminPath, adminHeaders, settings));
    const savedBody = await saved.text();
    assert.equal(saved.status, 200, savedBody);
    assert.doesNotMatch(savedBody, /test-notification-provider-key/);
    assert.notEqual(queryOne('SELECT key_encrypted FROM notification_ai_settings WHERE id = 1')?.key_encrypted, apiKey);
    const wrongHost = await admin.PUT(request('PUT', adminPath, adminHeaders, {
      ...settings, endpoint: 'https://different.example/v1/', apiKey: undefined, version: 1,
    }));
    assert.equal(wrongHost.status, 400);

    const config = await (await capture.GET(request('GET', capturePath, mobileHeaders))).json();
    assert.equal(config.available, true);
    assert.equal(config.origin, 'https://recognizer.example');
    assert.equal((await capture.PUT(request('PUT', capturePath, { ...mobileHeaders, 'x-assetpilot-device-id': 'another-device' }, { revision: config.revision }))).status, 403);
    const consent = await (await capture.PUT(request('PUT', capturePath, mobileHeaders, { revision: config.revision }))).json();
    assert.match(consent.token, /^ap_notice_/);
    const grantHeaders = { authorization: `Bearer ${consent.token}` };

    let status = 200;
    let providerCalls = 0;
    t.mock.method(dns.promises, 'lookup', async () => [{ address: '203.0.114.21', family: 4 }]);
    t.mock.method(https, 'request', (options: https.RequestOptions, fn: (response: PassThrough) => void) => {
      assert.equal((options.headers as Record<string, string>).Authorization, `Bearer ${apiKey}`);
      providerCalls += 1;
      return Object.assign(new EventEmitter(), { end(outbound: string) {
        assert.doesNotMatch(outbound, /5678/);
        queueMicrotask(() => {
          const response = Object.assign(new PassThrough(), { statusCode: status, complete: true });
          fn(response);
          response.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
            kind: 'purchase', amount: '75', currency: 'TWD', merchant: '測試商店', occurredAt: null, timeEvidence: null,
          }) } }] }));
        });
      } });
    });
    assert.equal((await admin.POST(request('POST', adminPath, adminHeaders))).status, 200);

    const notification = { sourceId: 'line-pay', title: '付款通知', body: '卡號末四碼 5678 於測試商店支付 NT$75。', receivedAt: new Date().toISOString() };
    assert.equal((await parse.POST(request('POST', parsePath, mobileHeaders, notification))).status, 401);
    const recognized = await parse.POST(request('POST', parsePath, grantHeaders, notification));
    const recognizedBody = await recognized.json();
    assert.equal(recognized.status, 200, JSON.stringify(recognizedBody));
    assert.equal(recognizedBody.outcome, 'needs_review');
    assert.equal(recognizedBody.draft.amount, '75');
    assert.equal(recognizedBody.draft.date, null);
    const ignored = await (await parse.POST(request('POST', parsePath, grantHeaders, { ...notification, body: '刷卡驗證碼 567891' }))).json();
    assert.deepEqual(ignored, { outcome: 'ignored' });
    assert.equal(providerCalls, 2);

    status = 429;
    const limited = await parse.POST(request('POST', parsePath, grantHeaders, notification));
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('retry-after'), '120');
    assert.equal((await transactions.POST(request('POST', txPath, grantHeaders, { type: 'expense', amount: 75 }))).status, 401);
    const balance = async () => {
      const response = await (await accounts.GET(request('GET', accountPath, mobileHeaders))).json();
      return (Array.isArray(response) ? response : response.data).find((row: { id: string }) => row.id === accountId).balance;
    };
    assert.equal(await balance(), 1000, 'draft recognition must not change the balance');
    const explicitlyReviewed = { type: 'expense', amount: 75, currency: 'TWD', note: '測試商店', accountId, clientRef: '12'.repeat(16) };
    const posted = await transactions.POST(request('POST', txPath, mobileHeaders, explicitlyReviewed));
    const postedBody = await posted.json();
    assert.equal(posted.status, 201, JSON.stringify(postedBody));
    const retry = await transactions.POST(request('POST', txPath, mobileHeaders, explicitlyReviewed));
    assert.equal((await retry.json()).id, postedBody.id);
    const retryAfterCategoryChange = await transactions.POST(request('POST', txPath, mobileHeaders, {
      ...explicitlyReviewed, categoryId: 'category-removed-after-first-submit',
    }));
    assert.equal((await retryAfterCategoryChange.json()).id, postedBody.id);
    assert.equal(await balance(), 925, 'retry should post exactly once');

    // A destination or model change requires explicit consent before any egress.
    const changed = await admin.PUT(request('PUT', adminPath, adminHeaders, { ...settings, model: 'new-model', version: 1, apiKey: undefined }));
    assert.equal(changed.status, 200);
    assert.equal((await parse.POST(request('POST', parsePath, grantHeaders, notification))).status, 409);
    assert.equal(providerCalls, 3);
    const newConfig = await (await capture.GET(request('GET', capturePath, mobileHeaders))).json();
    const grant = await (await capture.PUT(request('PUT', capturePath, mobileHeaders, { revision: newConfig.revision }))).json();
    db.run('UPDATE users SET token_version = 1 WHERE id = ?', [userId]);
    assert.equal(issueCaptureToken({ userId, sessionId: mobileSession.sessionId, tokenVersion: 0 },
      new Headers(appHeaders), newConfig.revision), null);
    assert.equal((await parse.POST(request('POST', parsePath, { authorization: `Bearer ${grant.token}` }, notification))).status, 401);
    revokeLoginSession(userId, mobileSession.sessionId);
    assert.equal((await parse.POST(request('POST', parsePath, { authorization: `Bearer ${grant.token}` }, notification))).status, 401);
  });
}
