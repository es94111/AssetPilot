// tests/lib/webPushDb.test.ts — Web Push 冪等去重與失效訂閱清理（issue #257）
//
// 需要真實 PostgreSQL（DATABASE_URL/POSTGRES_URL）；未設定時略過，維持 `npm test`
// 在無 DB 環境可通過的既有慣例（見 tests/lib/db.test.ts）。
//
// 覆蓋驗收條件：
//   1. 通知發送為冪等，避免重複推播（比照 monthly_report_send_log 去重設計）
//   2. 失效訂閱自動清除（404／410）
//   3. 通知類型逐一開關
import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  test('Web Push 訂閱去重與失效清理（略過：未設定 DATABASE_URL/POSTGRES_URL，需搭配 PostgreSQL 執行完整驗證）', () => {});
} else {
  const { initDB, getDB, queryOne } = await import('../../lib/db.ts');
  const { uid } = await import('../../lib/userDefaults.ts');
  const {
    __setPushTransportForTests,
    MAX_PUSH_SUBSCRIPTIONS,
    MAX_PUSH_FAILURES,
    WEB_PUSH_REQUEST_TIMEOUT_MS,
    countActiveSubscriptions,
    dispatchPushEvent,
    hasRecordedPush,
    getUserPushPreferences,
    listPushSubscriptions,
    removePushSubscription,
    savePushSubscription,
    sendTestNotification,
    setUserPushPreference,
  } = await import('../../lib/webPush.ts');
  const {
    acquirePushSchedulerLease,
    releasePushSchedulerLease,
    renewPushSchedulerLease,
    runDuePushEventsForAllUsers,
    PUSH_SCHEDULE_LEASE_MS,
  } = await import('../../lib/webPushEvents.ts');
  const { assertSharedVapidPublicKey } = await import('../../lib/webPushConfig.ts');
  const { generateVapidKeys } = await import('../../lib/webPushCore.ts');
  const { todayInUserTz } = await import('../../lib/userTime.ts');
  type DividendEvent = import('../../lib/webPushCore.ts').DividendEvent;

  const subscriptionWorkerScript = fileURLToPath(
    new URL('../helpers/webPushSubscriptionWorker.ts', import.meta.url),
  );
  const schedulerWorkerScript = fileURLToPath(
    new URL('../helpers/webPushSchedulerWorker.ts', import.meta.url),
  );

  function runSchedulerWorker(startAt: number, holdMs: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          '--experimental-transform-types',
          '--import',
          './tests/setup/register.mjs',
          schedulerWorkerScript,
        ],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            WEBPUSH_TEST_USER_ID: userId,
            WEBPUSH_SWEEP_START_AT: String(startAt),
            WEBPUSH_SWEEP_HOLD_MS: String(holdMs),
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
      child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
      child.once('error', reject);
      child.once('close', (code) => {
        if (code !== 0) {
          reject(new Error(`scheduler worker exited ${code}: ${stderr || stdout}`));
          return;
        }
        try {
          const line = stdout.trim().split(/\\r?\\n/).at(-1) || '';
          resolve(Number((JSON.parse(line) as { scanned?: number }).scanned) || 0);
        } catch (error) {
          reject(new Error(`scheduler worker returned invalid JSON: ${stdout}; ${stderr}; ${String(error)}`));
        }
      });
    });
  }

  function runSubscriptionWorker(endpoint: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [
          '--experimental-transform-types',
          '--import',
          './tests/setup/register.mjs',
          subscriptionWorkerScript,
        ],
        {
          cwd: process.cwd(),
          env: {
            ...process.env,
            WEBPUSH_TEST_USER_ID: userId,
            WEBPUSH_TEST_ENDPOINT: endpoint,
          },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      );
      let stdout = '';
      let stderr = '';
      child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
      child.stderr.setEncoding('utf8').on('data', (chunk: string) => { stderr += chunk; });
      child.once('error', reject);
      child.once('close', (code) => {
        if (code !== 0) {
          reject(new Error(`subscription worker exited ${code}: ${stderr || stdout}`));
          return;
        }
        try {
          const line = stdout.trim().split(/\\r?\\n/).at(-1) || '';
          resolve(JSON.parse(line) as Record<string, unknown>);
        } catch (error) {
          reject(new Error(`subscription worker returned invalid JSON: ${stdout}; ${stderr}; ${String(error)}`));
        }
      });
    });
  }

  await initDB();

  const userId = `test_webpush_${uid()}`;
  const otherUserId = `test_webpush_other_${uid()}`;
  const now = new Date().toISOString();
  const subscriptionA = {
    endpoint: `https://fcm.googleapis.com/fcm/send/a/${uid()}`,
    keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) },
  };
  const subscriptionB = {
    endpoint: `https://fcm.googleapis.com/fcm/send/b/${uid()}`,
    keys: { p256dh: 'C'.repeat(87), auth: 'D'.repeat(22) },
  };

  const dividendEvent = (dividendId: string): DividendEvent => ({
    category: 'dividend',
    dividendId,
    symbol: '2330',
    stockName: '台積電',
    date: '2026-10-07',
    cashDividend: 5000,
    stockDividendShares: 0,
    currency: 'TWD',
  });

  before(() => {
    const db = getDB();
    db.run('DELETE FROM web_push_vapid_config WHERE id = 1');
    assertSharedVapidPublicKey(process.env.VAPID_PUBLIC_KEY || '');
    db.run(
      'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?,?,?,?,?)',
      [userId, `${userId}@example.com`, 'x', '測試使用者', now],
    );
    getDB().run(
      'INSERT INTO user_settings (user_id, updated_at) VALUES (?,?) ON CONFLICT (user_id) DO NOTHING',
      [userId, Date.now()],
    );
    getDB().run(
      'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?,?,?,?,?)',
      [otherUserId, `${otherUserId}@example.com`, 'x', '其他測試使用者', now],
    );
  });

  after(() => {
    __setPushTransportForTests(null);
    const db = getDB();
    db.run('DELETE FROM web_push_send_log WHERE user_id = ?', [userId]);
    db.run('DELETE FROM web_push_subscriptions WHERE endpoint IN (?,?)', [subscriptionA.endpoint, subscriptionB.endpoint]);
    db.run('DELETE FROM web_push_subscriptions WHERE user_id IN (?,?)', [userId, otherUserId]);
    db.run('DELETE FROM user_settings WHERE user_id = ?', [userId]);
    db.run('DELETE FROM web_push_vapid_config WHERE id = 1');
    db.run('DELETE FROM users WHERE id IN (?,?)', [userId, otherUserId]);
    db.close();
  });

  test('replicas with mismatched VAPID public keys fail closed against the shared marker', () => {
    assertSharedVapidPublicKey(process.env.VAPID_PUBLIC_KEY || '');
    const otherKeys = generateVapidKeys();
    assert.throws(
      () => assertSharedVapidPublicKey(otherKeys.publicKey),
      /different VAPID key/,
    );
    assertSharedVapidPublicKey(process.env.VAPID_PUBLIC_KEY || '');
  });

  test('訂閱：建立後可列出，重複訂閱同一端點不新增列', () => {
    const created = savePushSubscription(userId, subscriptionA, 'Jest UA');
    assert.equal(created.created, true);
    assert.equal(countActiveSubscriptions(userId), 1);

    const again = savePushSubscription(userId, subscriptionA, 'Jest UA');
    assert.equal(again.created, false);
    assert.equal(again.id, created.id);
    assert.equal(countActiveSubscriptions(userId), 1);

    const list = listPushSubscriptions(userId, subscriptionA.endpoint);
    assert.equal(list.length, 1);
    assert.equal(list[0].endpointHost, 'fcm.googleapis.com');
    assert.equal(list[0].disabled, false);
    assert.equal(list[0].isCurrent, true);
    assert.equal(listPushSubscriptions(userId)[0].isCurrent, false);
  });

  test('訂閱：解除訂閱只影響自己的端點', () => {
    savePushSubscription(userId, subscriptionB);
    assert.equal(countActiveSubscriptions(userId), 2);
    assert.equal(removePushSubscription(userId, subscriptionB.endpoint), 1);
    assert.equal(countActiveSubscriptions(userId), 1);
    // 別人的（不存在的）端點不會誤刪
    assert.equal(removePushSubscription(userId, 'https://fcm.googleapis.com/fcm/send/nope'), 0);
  });

  test('通知類型可逐一開關（預設全開，關閉後該種類直接跳過）', () => {
    const initial = getUserPushPreferences(userId);
    assert.deepEqual(initial, { bill_due: true, budget_exceeded: true, dividend: true });

    setUserPushPreference(userId, 'dividend', false);
    assert.equal(getUserPushPreferences(userId).dividend, false);
    assert.equal(getUserPushPreferences(userId).bill_due, true);

    setUserPushPreference(userId, 'dividend', true);
    assert.equal(getUserPushPreferences(userId).dividend, true);
  });

  test('偏好列不存在時，更新開關會建立 user_settings 並持久化', () => {
    getDB().run('DELETE FROM user_settings WHERE user_id = ?', [userId]);
    setUserPushPreference(userId, 'bill_due', false);
    assert.deepEqual(getUserPushPreferences(userId), {
      bill_due: false,
      budget_exceeded: true,
      dividend: true,
    });
  });

  test('冪等：同一事件第一次發送成功、第二次因去重而跳過', async () => {
    let sends = 0;
    __setPushTransportForTests(async () => { sends += 1; });

    const event = dividendEvent(`div_${uid()}`);
    const first = await dispatchPushEvent(userId, event);
    assert.equal(first.status, 'completed');
    assert.equal(first.delivered, 1);
    assert.equal(sends, 1);

    const second = await dispatchPushEvent(userId, event);
    assert.equal(second.status, 'skipped_duplicate');
    assert.equal(second.delivered, 0);
    assert.equal(sends, 1, '第二次不得再呼叫 push service');
    assert.equal(hasRecordedPush(userId, 'dividend', `dividend:${event.dividendId}`), true);
  });

  test('冪等：同一事件併發發送只會有一個成功（UNIQUE 去重）', async () => {
    let sends = 0;
    __setPushTransportForTests(async () => { sends += 1; });
    const event = dividendEvent(`div_${uid()}`);
    const results = await Promise.all([
      dispatchPushEvent(userId, event),
      dispatchPushEvent(userId, event),
      dispatchPushEvent(userId, event),
    ]);
    const completed = results.filter((r) => r.status === 'completed');
    const skipped = results.filter((r) => r.status === 'skipped_duplicate');
    assert.equal(completed.length, 1, '併發時僅一個請求負責推播');
    assert.equal(skipped.length, 2);
    assert.equal(sends, 1);
  });

  test('種類關閉時不寫入去重紀錄，重新開啟後仍可推播', async () => {
    let sends = 0;
    __setPushTransportForTests(async () => { sends += 1; });
    setUserPushPreference(userId, 'dividend', false);
    const event = dividendEvent(`div_${uid()}`);
    const skipped = await dispatchPushEvent(userId, event);
    assert.equal(skipped.status, 'skipped_disabled');
    assert.equal(hasRecordedPush(userId, 'dividend', `dividend:${event.dividendId}`), false);

    setUserPushPreference(userId, 'dividend', true);
    const after = await dispatchPushEvent(userId, event);
    assert.equal(after.status, 'completed');
    assert.equal(sends, 1);
  });

  test('失效訂閱自動清除：push service 回 404/410 時刪除該訂閱', async () => {
    const before = countActiveSubscriptions(userId);
    assert.ok(before >= 1);

    __setPushTransportForTests(async () => {
      const error = new Error('push subscription has unsubscribed or expired');
      (error as { statusCode?: number }).statusCode = 410;
      throw error;
    });

    const event = dividendEvent(`div_${uid()}`);
    const result = await dispatchPushEvent(userId, event);
    assert.equal(result.expired, before, '所有已失效訂閱都應被清除');
    assert.equal(countActiveSubscriptions(userId), 0, '失效訂閱不得留在資料表中');
    assert.equal(result.status, 'failed', '沒有成功送達即為失敗');
    // 已無有效訂閱：後續同事件不會再嘗試發送（事件已消耗，避免重新訂閱後被舊事件洗版）
    const retry = await dispatchPushEvent(userId, event);
    assert.equal(retry.status, 'skipped_no_subscription');
    assert.equal(
      hasRecordedPush(userId, 'dividend', `dividend:${event.dividendId}`),
      true,
      '失效清理已算一次送達嘗試，事件應保持已消耗',
    );
  });

  test('舊使用者的 in-flight 失效回應不會刪除已轉移給另一使用者的訂閱', async () => {
    const endpoint = `https://fcm.googleapis.com/fcm/send/reassign-inflight/${uid()}`;
    savePushSubscription(userId, {
      endpoint,
      keys: { p256dh: 'U'.repeat(87), auth: 'V'.repeat(22) },
    });

    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    let failDelivery!: (error: Error & { statusCode: number }) => void;
    const delivery = new Promise<void>((_resolve, reject) => { failDelivery = reject; });
    __setPushTransportForTests(async () => {
      markStarted();
      await delivery;
    });

    const event = dividendEvent(`div_${uid()}`);
    const dispatch = dispatchPushEvent(userId, event);
    await started;
    savePushSubscription(otherUserId, {
      endpoint,
      keys: { p256dh: 'U'.repeat(87), auth: 'V'.repeat(22) },
    });
    const statusError = Object.assign(new Error('Gone'), { statusCode: 410 });
    failDelivery(statusError);

    const result = await dispatch;
    assert.equal(result.expired, 0, '舊 owner 的 response 不再操作已轉移的資料列');
    const reassigned = queryOne(
      'SELECT user_id, disabled_at FROM web_push_subscriptions WHERE endpoint = ?',
      [endpoint],
    );
    assert.equal(reassigned?.user_id, otherUserId);
    assert.equal(Number(reassigned?.disabled_at), 0);
  });

  test('舊使用者的成功 in-flight 推播不含財務明細，重新指派後忽略舊 owner 狀態更新', async () => {
    const endpoint = `https://fcm.googleapis.com/fcm/send/reassign-success/${uid()}`;
    savePushSubscription(userId, {
      endpoint,
      keys: { p256dh: 'Y'.repeat(87), auth: 'Z'.repeat(22) },
    });

    let markStarted!: () => void;
    const started = new Promise<void>((resolve) => { markStarted = resolve; });
    let finishDelivery!: () => void;
    const delivery = new Promise<void>((resolve) => { finishDelivery = resolve; });
    let sentPayload = '';
    __setPushTransportForTests(async (_subscription, payload) => {
      sentPayload = payload;
      markStarted();
      await delivery;
    });

    const event = dividendEvent(`PRIVATE_DIVIDEND_ID_${uid()}`);
    event.symbol = 'PRIVATE_SYMBOL_2330';
    event.stockName = 'PRIVATE_STOCK_NAME';
    event.cashDividend = 987654321;
    event.date = 'PRIVATE_DATE_2026-10-08';
    const dispatch = dispatchPushEvent(userId, event);
    await started;
    savePushSubscription(otherUserId, {
      endpoint,
      keys: { p256dh: 'Y'.repeat(87), auth: 'Z'.repeat(22) },
    });
    finishDelivery();

    const result = await dispatch;
    assert.equal(result.status, 'skipped_no_subscription', '已轉移的 endpoint 不得計入舊使用者送達');
    for (const privateValue of [event.dividendId, event.symbol, event.stockName, String(event.cashDividend), event.date]) {
      assert.equal(sentPayload.includes(privateValue), false, `push payload must not expose ${privateValue}`);
    }
    const parsedPayload = JSON.parse(sentPayload) as { tag: string; title: string; body: string; url: string };
    assert.equal(parsedPayload.title, 'AssetPilot 通知');
    assert.equal(parsedPayload.body, '有一則通知，開啟 AssetPilot 查看詳情。');
    assert.equal(parsedPayload.url, '/dashboard');
    assert.doesNotMatch(sentPayload, /\"category\"/);
    assert.equal(parsedPayload.tag.includes(event.dividendId), false);
    const reassigned = queryOne('SELECT user_id, disabled_at FROM web_push_subscriptions WHERE endpoint = ?', [endpoint]);
    assert.equal(reassigned?.user_id, otherUserId);
    assert.equal(Number(reassigned?.disabled_at), 0);
  });

  test('404 亦視為失效並清除訂閱', async () => {
    const endpoint = `https://fcm.googleapis.com/fcm/send/gone/${uid()}`;
    savePushSubscription(userId, { endpoint, keys: { p256dh: 'E'.repeat(87), auth: 'F'.repeat(22) } });
    assert.equal(countActiveSubscriptions(userId), 1);

    __setPushTransportForTests(async () => {
      const error = new Error('Not Found');
      (error as { statusCode?: number }).statusCode = 404;
      throw error;
    });
    const event = dividendEvent(`div_${uid()}`);
    await dispatchPushEvent(userId, event);
    assert.equal(countActiveSubscriptions(userId), 0);
  });

  test('非失效錯誤（如 500）保留訂閱，連續失敗達門檻才停用', async () => {
    const endpoint = `https://fcm.googleapis.com/fcm/send/flaky/${uid()}`;
    savePushSubscription(userId, { endpoint, keys: { p256dh: 'G'.repeat(87), auth: 'H'.repeat(22) } });

    __setPushTransportForTests(async () => {
      const error = new Error('Internal Server Error');
      (error as { statusCode?: number }).statusCode = 500;
      throw error;
    });

    for (let i = 0; i < 4; i += 1) {
      await dispatchPushEvent(userId, dividendEvent(`div_${uid()}`));
      const list = listPushSubscriptions(userId);
      const target = list.find((s) => s.endpointHost === 'fcm.googleapis.com' && !s.disabled);
      assert.ok(target, `第 ${i + 1} 次失敗後訂閱仍應保留`);
      assert.equal(target.failureCount, i + 1);
    }
    // 第 5 次失敗達到門檻 → 停用（不再嘗試發送）
    await dispatchPushEvent(userId, dividendEvent(`div_${uid()}`));
    assert.equal(countActiveSubscriptions(userId), 0, '達門檻後不再列入有效訂閱');

    let sends = 0;
    __setPushTransportForTests(async () => { sends += 1; });
    const after = await dispatchPushEvent(userId, dividendEvent(`div_${uid()}`));
    assert.equal(after.status, 'skipped_no_subscription');
    assert.equal(sends, 0);
  });

  test('逾時送出保留失敗去重紀錄，不會因後續掃描而重試同一事件', async () => {
    const endpoint = `https://fcm.googleapis.com/fcm/send/timeout/${uid()}`;
    savePushSubscription(userId, {
      endpoint,
      keys: { p256dh: 'D'.repeat(87), auth: 'E'.repeat(22) },
    });
    let attempts = 0;
    __setPushTransportForTests(async (_subscription, _payload, options) => {
      attempts += 1;
      assert.equal(options.timeout, WEB_PUSH_REQUEST_TIMEOUT_MS);
      throw Object.assign(new Error('absolute push request timeout'), { code: 'ETIMEDOUT' });
    });

    const event = dividendEvent(`timeout_${uid()}`);
    const first = await dispatchPushEvent(userId, event);
    assert.equal(first.status, 'failed');
    assert.equal(first.reason, 'absolute push request timeout');
    assert.equal(hasRecordedPush(userId, 'dividend', `dividend:${event.dividendId}`), true);

    const subsequent = await dispatchPushEvent(userId, event);
    assert.equal(subsequent.status, 'skipped_duplicate');
    assert.equal(attempts, 1, 'failed timeout remains deduped, matching the no-retry send-log policy');
    removePushSubscription(userId, endpoint);
  });

  test('併發失敗達停用門檻後，成功的 in-flight response 會一致恢復訂閱', async () => {
    const endpoint = `https://fcm.googleapis.com/fcm/send/failure-race/${uid()}`;
    const saved = savePushSubscription(userId, {
      endpoint,
      keys: { p256dh: 'V'.repeat(87), auth: 'W'.repeat(22) },
    });
    getDB().run(
      'UPDATE web_push_subscriptions SET failure_count = ? WHERE id = ?',
      [MAX_PUSH_FAILURES - 1, saved.id],
    );

    let calls = 0;
    let markBothStarted!: () => void;
    const bothStarted = new Promise<void>((resolve) => { markBothStarted = resolve; });
    let finishFailure!: (error: Error) => void;
    let finishSuccess!: () => void;
    const failure = new Promise<void>((_resolve, reject) => { finishFailure = reject; });
    const success = new Promise<void>((resolve) => { finishSuccess = resolve; });
    __setPushTransportForTests(async () => {
      calls += 1;
      if (calls === 2) markBothStarted();
      if (calls === 1) await failure;
      else await success;
    });

    const failedSend = dispatchPushEvent(userId, dividendEvent(`failure-${uid()}`));
    const successfulSend = dispatchPushEvent(userId, dividendEvent(`success-${uid()}`));
    await bothStarted;
    finishFailure(Object.assign(new Error('transient push failure'), { statusCode: 500 }));
    const failureResult = await failedSend;
    assert.equal(failureResult.status, 'failed');
    const afterFailure = listPushSubscriptions(userId).find((item) => item.id === saved.id);
    assert.equal(afterFailure?.disabled, true, 'failure count is atomically incremented to threshold');

    finishSuccess();
    const successResult = await successfulSend;
    assert.equal(successResult.status, 'completed');
    const afterSuccess = listPushSubscriptions(userId).find((item) => item.id === saved.id);
    assert.equal(afterSuccess?.disabled, false);
    assert.equal(afterSuccess?.failureCount, 0);
    __setPushTransportForTests(null);
    removePushSubscription(userId, endpoint);
  });

  test('沒有訂閱時不寫入去重紀錄，訂閱後仍可收到該事件', async () => {
    const endpoint = `https://fcm.googleapis.com/fcm/send/late/${uid()}`;
    const event = dividendEvent(`div_${uid()}`);

    const noSub = await dispatchPushEvent(userId, event);
    assert.equal(noSub.status, 'skipped_no_subscription');
    assert.equal(
      hasRecordedPush(userId, 'dividend', `dividend:${event.dividendId}`),
      false,
      '沒有訂閱時不得消耗該事件',
    );

    let sends = 0;
    __setPushTransportForTests(async () => { sends += 1; });
    savePushSubscription(userId, { endpoint, keys: { p256dh: 'K'.repeat(87), auth: 'L'.repeat(22) } });
    const after = await dispatchPushEvent(userId, event);
    assert.equal(after.status, 'completed', '事後訂閱仍應收到當前狀態');
    assert.equal(sends, 1);
    removePushSubscription(userId, endpoint);
  });

  test('訂閱上限同時套用於新訂閱、重新啟用與跨帳號端點轉移', () => {
    const db = getDB();
    db.run('DELETE FROM web_push_subscriptions WHERE user_id = ?', [userId]);

    const endpoints = Array.from({ length: MAX_PUSH_SUBSCRIPTIONS + 1 }, (_, index) =>
      `https://fcm.googleapis.com/fcm/send/limit/${userId}/${index}/${uid()}`,
    );
    for (let index = 0; index < MAX_PUSH_SUBSCRIPTIONS; index += 1) {
      savePushSubscription(userId, {
        endpoint: endpoints[index],
        keys: { p256dh: 'M'.repeat(87), auth: 'N'.repeat(22) },
      });
    }
    assert.equal(countActiveSubscriptions(userId), MAX_PUSH_SUBSCRIPTIONS);
    assert.throws(
      () => savePushSubscription(userId, {
        endpoint: endpoints[MAX_PUSH_SUBSCRIPTIONS],
        keys: { p256dh: 'O'.repeat(87), auth: 'P'.repeat(22) },
      }),
      /上限/,
    );

    // 已停用的既有端點重新啟用也會增加 active 數，不能繞過上限。
    db.run('UPDATE web_push_subscriptions SET disabled_at = ? WHERE user_id = ? AND endpoint = ?', [
      Date.now(), userId, endpoints[0],
    ]);
    savePushSubscription(userId, {
      endpoint: endpoints[MAX_PUSH_SUBSCRIPTIONS],
      keys: { p256dh: 'O'.repeat(87), auth: 'P'.repeat(22) },
    });
    assert.equal(countActiveSubscriptions(userId), MAX_PUSH_SUBSCRIPTIONS);
    assert.throws(
      () => savePushSubscription(userId, {
        endpoint: endpoints[0],
        keys: { p256dh: 'M'.repeat(87), auth: 'N'.repeat(22) },
      }),
      /上限/,
    );
    assert.equal(countActiveSubscriptions(userId), MAX_PUSH_SUBSCRIPTIONS);

    // 另一個使用者現有端點轉入目前帳號同樣會新增一個 active 訂閱，必須拒絕。
    const sharedEndpoint = `https://fcm.googleapis.com/fcm/send/reassign/${uid()}`;
    savePushSubscription(otherUserId, {
      endpoint: sharedEndpoint,
      keys: { p256dh: 'Q'.repeat(87), auth: 'R'.repeat(22) },
    });
    assert.throws(
      () => savePushSubscription(userId, {
        endpoint: sharedEndpoint,
        keys: { p256dh: 'Q'.repeat(87), auth: 'R'.repeat(22) },
      }),
      /上限/,
    );
    const owner = queryOne('SELECT user_id FROM web_push_subscriptions WHERE endpoint = ?', [sharedEndpoint]);
    assert.equal(owner?.user_id, otherUserId, '超過上限時不可先把其他使用者的端點改綁');
    db.run('DELETE FROM web_push_subscriptions WHERE user_id = ?', [userId]);
  });

  test('不同 PostgreSQL 連線併發新增時，advisory lock 保證訂閱上限不超過 20', async () => {
    const db = getDB();
    db.run('DELETE FROM web_push_subscriptions WHERE user_id = ?', [userId]);

    const attemptCount = MAX_PUSH_SUBSCRIPTIONS + 5;
    const results = await Promise.all(
      Array.from({ length: attemptCount }, (_, index) =>
        runSubscriptionWorker(`https://fcm.googleapis.com/fcm/send/race/${userId}/${index}/${uid()}`),
      ),
    );
    const succeeded = results.filter((result) => result.ok === true);
    const rejected = results.filter((result) => result.ok === false);
    assert.equal(succeeded.length, MAX_PUSH_SUBSCRIPTIONS);
    assert.equal(rejected.length, attemptCount - MAX_PUSH_SUBSCRIPTIONS);
    assert.ok(rejected.every((result) => result.code === 'InvalidPushSubscription'));

    const persisted = queryOne(
      'SELECT COUNT(*) AS cnt FROM web_push_subscriptions WHERE user_id = ? AND disabled_at = 0',
      [userId],
    );
    assert.equal(Number(persisted?.cnt), MAX_PUSH_SUBSCRIPTIONS, '競態不得留下超額訂閱列');
    db.run('DELETE FROM web_push_subscriptions WHERE user_id = ?', [userId]);
  });

  test('過期 sweep lease 可在程序崩潰後由其他 replica 接管', () => {
    const ownerA = `scheduler-a-${uid()}`;
    const ownerB = `scheduler-b-${uid()}`;
    const now = Date.now();
    assert.equal(acquirePushSchedulerLease(ownerA, now), true);
    assert.equal(acquirePushSchedulerLease(ownerB, now + 1), false, '有效 lease 不可被搶佔');
    assert.equal(renewPushSchedulerLease(ownerA, now + 100), true);
    assert.equal(
      acquirePushSchedulerLease(ownerB, now + 100 + PUSH_SCHEDULE_LEASE_MS + 1),
      true,
      '過期 lease 應可由另一個 replica 接管',
    );
    releasePushSchedulerLease(ownerA);
    assert.equal(
      acquirePushSchedulerLease(ownerA, now + 100 + PUSH_SCHEDULE_LEASE_MS + 2),
      false,
      '舊 owner 的釋放不可清除新 owner 的 lease',
    );
    releasePushSchedulerLease(ownerB);
    assert.equal(acquirePushSchedulerLease(ownerA, Date.now()), true);
    releasePushSchedulerLease(ownerA);
  });

  test('多個 PostgreSQL worker 同時啟動時共享 lease 僅允許一個 sweep，事件只送一次', async () => {
    const db = getDB();
    const endpoint = `https://fcm.googleapis.com/fcm/send/lease-race/${uid()}`;
    const stockId = uid();
    const dividendId = uid();
    const today = todayInUserTz('Asia/Taipei');
    savePushSubscription(userId, {
      endpoint,
      keys: { p256dh: 'W'.repeat(87), auth: 'X'.repeat(22) },
    });
    db.run(
      'INSERT INTO stocks (id,user_id,symbol,name,market,currency,shares,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [stockId, userId, '2330', '台積電', 'TW', 'TWD', 1, Date.now(), Date.now()],
    );
    db.run(
      'INSERT INTO stock_dividends (id,user_id,stock_id,amount,shares,date,note,created_at,cash_dividend,stock_dividend_shares) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [dividendId, userId, stockId, 100, 0, today, '', Date.now(), 100, 0],
    );

    const startAt = Date.now() + 1500;
    const scanned = await Promise.all([
      runSchedulerWorker(startAt, 1000),
      runSchedulerWorker(startAt, 1000),
      runSchedulerWorker(startAt, 1000),
    ]);
    assert.deepEqual(scanned.sort((a, b) => a - b), [0, 0, 1]);

    const deliveries = queryOne(
      'SELECT COUNT(*) AS cnt FROM web_push_send_log WHERE user_id = ? AND category = ? AND event_key = ?',
      [userId, 'dividend', `dividend:${dividendId}`],
    );
    assert.equal(Number(deliveries?.cnt), 1, '同一事件只應有一筆送達紀錄');
    db.run('DELETE FROM web_push_send_log WHERE user_id = ? AND event_key = ?', [
      userId,
      `dividend:${dividendId}`,
    ]);
    db.run('DELETE FROM stock_dividends WHERE id = ?', [dividendId]);
    db.run('DELETE FROM stocks WHERE id = ?', [stockId]);
    removePushSubscription(userId, endpoint);
  });

  test('使用者分頁掃描超過一頁時會 yield 回 event loop', async () => {
    const db = getDB();
    const fixtureUserIds = Array.from({ length: 105 }, () => `test_webpush_page_${uid()}`);
    const now = Date.now();
    for (const fixtureUserId of fixtureUserIds) {
      db.run(
        'INSERT INTO users (id,email,password_hash,display_name,created_at,is_active,timezone) VALUES (?,?,?,?,?,?,?)',
        [fixtureUserId, `${fixtureUserId}@example.com`, 'x', '分頁測試', new Date().toISOString(), 1, 'Asia/Taipei'],
      );
      db.run(
        'INSERT INTO user_settings (user_id,push_bill_due,push_budget_exceeded,push_dividend,updated_at) VALUES (?,?,?,?,?)',
        [fixtureUserId, 0, 0, 0, now],
      );
      db.run(
        'INSERT INTO web_push_subscriptions (id,user_id,endpoint,p256dh,auth,user_agent,created_at,updated_at,last_success_at,failure_count,disabled_at) VALUES (?,?,?,?,?,?,?,?,0,0,0)',
        [uid(), fixtureUserId, `https://fcm.googleapis.com/fcm/send/page/${fixtureUserId}`, 'A'.repeat(87), 'B'.repeat(22), 'page-test', now, now],
      );
    }

    let eventLoopYielded = false;
    setImmediate(() => { eventLoopYielded = true; });
    const scanned = await runDuePushEventsForAllUsers(now);
    assert.ok(scanned >= fixtureUserIds.length);
    assert.equal(eventLoopYielded, true, 'page boundary must yield before scanning the next batch');

    const placeholders = fixtureUserIds.map(() => '?').join(',');
    db.run(`DELETE FROM user_settings WHERE user_id IN (${placeholders})`, fixtureUserIds);
    db.run(`DELETE FROM web_push_subscriptions WHERE user_id IN (${placeholders})`, fixtureUserIds);
    db.run(`DELETE FROM users WHERE id IN (${placeholders})`, fixtureUserIds);
  });

  test('伺服器背景掃描會通知未發出請求的已訂閱使用者', async () => {
    const db = getDB();
    const endpoint = `https://fcm.googleapis.com/fcm/send/scheduled/${uid()}`;
    const stockId = uid();
    const dividendId = uid();
    const today = todayInUserTz('Asia/Taipei');
    savePushSubscription(userId, {
      endpoint,
      keys: { p256dh: 'W'.repeat(87), auth: 'X'.repeat(22) },
    });
    db.run(
      'INSERT INTO stocks (id,user_id,symbol,name,market,currency,shares,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
      [stockId, userId, '2330', '台積電', 'TW', 'TWD', 1, Date.now(), Date.now()],
    );
    db.run(
      'INSERT INTO stock_dividends (id,user_id,stock_id,amount,shares,date,note,created_at,cash_dividend,stock_dividend_shares) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [dividendId, userId, stockId, 100, 0, today, '', Date.now(), 100, 0],
    );

    const payloads: Array<{ tag?: string; title?: string; body?: string }> = [];
    __setPushTransportForTests(async (_subscription, payload) => {
      payloads.push(JSON.parse(payload) as { tag?: string; title?: string; body?: string });
    });
    const scannedUsers = await runDuePushEventsForAllUsers(Date.now(), { onlyUserId: userId });

    assert.ok(scannedUsers >= 1);
    assert.equal(payloads.length, 1);
    assert.match(payloads[0].tag || '', /^assetpilot:[a-f0-9]{32}$/);
    assert.equal(payloads[0].title, 'AssetPilot 通知');
    assert.equal(payloads[0].body, '有一則通知，開啟 AssetPilot 查看詳情。');
    assert.equal(hasRecordedPush(userId, 'dividend', `dividend:${dividendId}`), true);
    db.run('DELETE FROM web_push_send_log WHERE user_id = ? AND event_key = ?', [
      userId,
      `dividend:${dividendId}`,
    ]);
    db.run('DELETE FROM stock_dividends WHERE id = ?', [dividendId]);
    db.run('DELETE FROM stocks WHERE id = ?', [stockId]);
    removePushSubscription(userId, endpoint);
  });

  test('測試通知：無訂閱時回報 skipped，有訂閱時實際發送且不寫去重紀錄', async () => {
    const none = await sendTestNotification(userId);
    assert.equal(none.status, 'skipped_no_subscription');

    let sends = 0;
    __setPushTransportForTests(async (subscription, payload, options) => {
      sends += 1;
      assert.equal(options.timeout, WEB_PUSH_REQUEST_TIMEOUT_MS);
      assert.ok(options.timeout > 0 && options.timeout <= 30_000);
      const parsed = JSON.parse(payload) as { title?: string; url?: string };
      assert.ok(parsed.title, '測試通知必須帶標題');
      assert.equal(parsed.url, '/settings/notifications');
      assert.ok(subscription.keys.p256dh);
    });
    savePushSubscription(userId, { endpoint: `https://fcm.googleapis.com/fcm/send/test/${uid()}`, keys: { p256dh: 'I'.repeat(87), auth: 'J'.repeat(22) } });

    const first = await sendTestNotification(userId);
    assert.equal(first.status, 'completed');
    const second = await sendTestNotification(userId);
    assert.equal(second.status, 'completed');
    assert.equal(sends, 2, '測試通知不去重，每次按下都應發送');
  });
}
