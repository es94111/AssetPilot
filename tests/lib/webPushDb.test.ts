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
  type DividendEvent = import('../../lib/webPushCore.ts').DividendEvent;

  const subscriptionWorkerScript = fileURLToPath(
    new URL('../helpers/webPushSubscriptionWorker.ts', import.meta.url),
  );

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
    getDB().run(
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
    db.run('DELETE FROM users WHERE id IN (?,?)', [userId, otherUserId]);
    db.close();
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

  test('測試通知：無訂閱時回報 skipped，有訂閱時實際發送且不寫去重紀錄', async () => {
    const none = await sendTestNotification(userId);
    assert.equal(none.status, 'skipped_no_subscription');

    let sends = 0;
    __setPushTransportForTests(async (subscription, payload) => {
      sends += 1;
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
