// tests/lib/apiTokenWebhook.test.ts — API Token／Webhook 資料層測試（issue #258）
// 需要真實 PostgreSQL（DATABASE_URL/POSTGRES_URL）；未設定時略過，
// 讓 `npm test` 在無資料庫的環境仍可通過（與 mcpAuth.test.ts 相同策略）。
// 執行方式：node --experimental-transform-types --import tests/setup/register.mjs tests/lib/apiTokenWebhook.test.ts
import assert from 'node:assert/strict';
import test, { after } from 'node:test';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  test('apiTokenWebhook（略過：未設定 DATABASE_URL/POSTGRES_URL，需搭配 PostgreSQL 執行完整驗證）', () => {});
} else {
  process.env.API_TOKEN_ENCRYPTION_KEY =
    process.env.API_TOKEN_ENCRYPTION_KEY || 'test-encryption-key-for-webhook-test';

  const { initDB, getDB, queryOne, queryAll } = await import('../../lib/db.ts');
  after(() => { getDB().close(); });
  const { uid } = await import('../../lib/userDefaults.ts');
  const {
    createApiToken,
    verifyApiToken,
    listApiTokens,
    revokeApiToken,
    parseScopesColumn,
    requireApiTokenScope,
    MAX_ACTIVE_API_TOKENS,
    ApiTokenError,
  } = await import('../../lib/apiTokenAuth.ts');
  const {
    createWebhookSubscription,
    getWebhookSubscription,
    updateWebhookSubscription,
    deleteWebhookSubscription,
    enqueueWebhookEvent,
    listWebhookDeliveries,
    attemptWebhookDelivery,
    runDueWebhookDeliveries,
    serializeWebhookDelivery,
    serializeWebhookSubscription,
  } = await import('../../lib/webhookHelpers.ts');
  const { buildTransactionEventData } = await import('../../lib/transactionWebhooks.ts');
  const { decryptSecret, hashApiToken: hashToken } = await import('../../lib/apiTokenCore.ts');

  await initDB();

  function createTestUser(userId: string): void {
    getDB().run(
      'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?,?,?,?,?)',
      [userId, `${userId}@test.local`, 'test', 'Test User', new Date().toISOString().slice(0, 10)],
    );
  }

  function cleanupUser(userId: string): void {
    getDB().run('DELETE FROM webhook_deliveries WHERE user_id = ?', [userId]);
    getDB().run('DELETE FROM webhook_subscriptions WHERE user_id = ?', [userId]);
    getDB().run('DELETE FROM api_tokens WHERE user_id = ?', [userId]);
    getDB().run('DELETE FROM users WHERE id = ?', [userId]);
  }

  // ── API Token ──

  test('createApiToken 僅以雜湊儲存，回傳的明文可通過 verifyApiToken', () => {
    const userId = 'test_apitoken_' + uid();
    createTestUser(userId);
    try {
      const created = createApiToken(userId, '我的自動化腳本', ['transactions:read', 'transactions:write']);
      assert.ok(created.token.startsWith('ap_api_'));

      // 資料庫不得存在明文權杖
      const row = queryOne('SELECT token_hash, token_prefix, scopes FROM api_tokens WHERE id = ?', [created.id]);
      assert.ok(row);
      assert.notEqual(String(row?.token_hash), created.token);
      assert.match(String(row?.token_hash), /^[0-9a-f]{64}$/);
      // 雜湊即等於 sha256(明文)，證明儲存的確實是雜湊而非明文
      assert.equal(String(row?.token_hash), hashToken(created.token));
      assert.equal(String(row?.token_prefix), created.prefix);
      assert.equal(String(row?.scopes), 'transactions:read transactions:write');

      const verified = verifyApiToken(created.token);
      assert.ok(verified);
      assert.equal(verified?.userId, userId);
      assert.equal(verified?.tokenId, created.id);
      assert.deepEqual(verified?.scopes, ['transactions:read', 'transactions:write']);

      // last_used_at 於驗證時更新
      const list = listApiTokens(userId);
      const found = list.find((t) => t.id === created.id);
      assert.ok(found);
      assert.equal(found?.status, 'active');
      assert.ok((found?.lastUsedAt || 0) > 0);
      assert.equal(found?.prefix, created.prefix);
    } finally {
      cleanupUser(userId);
    }
  });

  test('verifyApiToken 對未知權杖回傳 null', () => {
    assert.equal(verifyApiToken('ap_api_definitely-not-issued'), null);
    assert.equal(verifyApiToken(''), null);
  });

  test('撤銷後 verifyApiToken 立即失效，且狀態為 revoked', () => {
    const userId = 'test_apitoken_' + uid();
    createTestUser(userId);
    try {
      const created = createApiToken(userId, '待撤銷', ['transactions:read']);
      assert.ok(verifyApiToken(created.token));
      assert.equal(revokeApiToken(userId, created.id), true);
      assert.equal(verifyApiToken(created.token), null);
      const found = listApiTokens(userId).find((t) => t.id === created.id);
      assert.equal(found?.status, 'revoked');
      // 重複撤銷不應再次生效
      assert.equal(revokeApiToken(userId, created.id), false);
    } finally {
      cleanupUser(userId);
    }
  });

  test('已撤銷的 Token 不佔用啟用上限', () => {
    const userId = 'test_apitoken_' + uid();
    createTestUser(userId);
    try {
      const created = createApiToken(userId, 'A', ['transactions:read']);
      revokeApiToken(userId, created.id);
      // 撤銷後仍可再建立（名額釋放）
      const again = createApiToken(userId, 'B', ['transactions:read']);
      assert.ok(again.id);
    } finally {
      cleanupUser(userId);
    }
  });

  test('超過啟用上限時拋出 TokenLimitReached', () => {
    const userId = 'test_apitoken_' + uid();
    createTestUser(userId);
    try {
      for (let i = 0; i < MAX_ACTIVE_API_TOKENS; i += 1) {
        createApiToken(userId, `token-${i}`, ['transactions:read']);
      }
      assert.throws(() => createApiToken(userId, 'overflow', ['transactions:read']), (e: unknown) => {
        assert.ok(e instanceof ApiTokenError);
        assert.equal(e.code, 'TokenLimitReached');
        return true;
      });
    } finally {
      cleanupUser(userId);
    }
  });

  test('createApiToken 拒絕空名稱與未知 scope', () => {
    const userId = 'test_apitoken_' + uid();
    createTestUser(userId);
    try {
      assert.throws(() => createApiToken(userId, '  ', ['transactions:read']), ApiTokenError);
      assert.throws(() => createApiToken(userId, 'ok', ['nope']), ApiTokenError);
      assert.throws(() => createApiToken(userId, 'ok', []), ApiTokenError);
    } finally {
      cleanupUser(userId);
    }
  });

  test('requireApiTokenScope 對缺少的 scope 拋出 InsufficientScope', () => {
    const readOnly = { tokenId: 't', userId: 'u', name: 'n', scopes: ['transactions:read' as const] };
    assert.doesNotThrow(() => requireApiTokenScope(readOnly, 'transactions:read'));
    assert.throws(() => requireApiTokenScope(readOnly, 'transactions:write'), (e: unknown) => {
      assert.ok(e instanceof ApiTokenError);
      assert.equal(e.code, 'InsufficientScope');
      assert.equal(e.status, 403);
      return true;
    });
  });

  test('parseScopesColumn 對空值回傳空陣列', () => {
    assert.deepEqual(parseScopesColumn(null), []);
    assert.deepEqual(parseScopesColumn(''), []);
    assert.deepEqual(parseScopesColumn('a b'), ['a', 'b']);
  });

  // ── Webhook 訂閱 ──

  test('createWebhookSubscription 只回傳一次密鑰，儲存時以加密形式保存', () => {
    const userId = 'test_webhook_' + uid();
    createTestUser(userId);
    try {
      const created = createWebhookSubscription(userId, 'https://example.com/hooks', ['transaction.created']);
      assert.ok(created.secret.startsWith('whsec_'));
      assert.deepEqual(created.subscription.events, ['transaction.created']);

      const row = queryOne('SELECT secret_encrypted, secret_prefix FROM webhook_subscriptions WHERE id = ?', [
        created.subscription.id,
      ]);
      assert.ok(row);
      // 密文為 iv.tag.ciphertext 三段 base64，且解密後必須等於原密鑰
      const encrypted = String(row?.secret_encrypted);
      assert.match(encrypted, /^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/);
      assert.equal(decryptSecret(encrypted, process.env.API_TOKEN_ENCRYPTION_KEY as string), created.secret);
      assert.equal(String(row?.secret_prefix), created.secret.slice(0, 14));

      // 列表／查詢不應回傳明文密鑰
      const fetched = getWebhookSubscription(userId, created.subscription.id);
      assert.ok(fetched);
      assert.equal(fetched?.secretPrefix, created.secret.slice(0, 14));
      assert.equal(JSON.stringify(fetched).includes(created.secret), false);
      assert.equal(JSON.stringify(serializeWebhookSubscription(fetched!)).includes(created.secret), false);
    } finally {
      cleanupUser(userId);
    }
  });

  test('createWebhookSubscription 拒絕非 HTTPS 與內網網址', () => {
    const userId = 'test_webhook_' + uid();
    createTestUser(userId);
    try {
      assert.throws(() => createWebhookSubscription(userId, 'http://example.com/hooks', []), ApiTokenError);
      assert.throws(() => createWebhookSubscription(userId, 'https://127.0.0.1/hooks', []), ApiTokenError);
    } finally {
      cleanupUser(userId);
    }
  });

  test('updateWebhookSubscription 可改網址／事件／啟用狀態，未知 id 回傳 null', () => {
    const userId = 'test_webhook_' + uid();
    createTestUser(userId);
    try {
      const created = createWebhookSubscription(userId, 'https://example.com/a', ['transaction.created']);
      const updated = updateWebhookSubscription(userId, created.subscription.id, {
        url: 'https://example.com/b',
        events: ['transaction.deleted'],
        active: false,
      });
      assert.ok(updated);
      assert.equal(updated?.url, 'https://example.com/b');
      assert.deepEqual(updated?.events, ['transaction.deleted']);
      assert.equal(updated?.active, false);

      assert.equal(updateWebhookSubscription(userId, 'missing-id', { active: true }), null);
      assert.throws(() => updateWebhookSubscription(userId, created.subscription.id, {}), ApiTokenError);
      assert.throws(() => updateWebhookSubscription(userId, created.subscription.id, { active: 'yes' }), ApiTokenError);
    } finally {
      cleanupUser(userId);
    }
  });

  test('deleteWebhookSubscription 連同投遞紀錄一併移除，未知 id 回傳 false', () => {
    const userId = 'test_webhook_' + uid();
    createTestUser(userId);
    try {
      const created = createWebhookSubscription(userId, 'https://example.com/a', ['transaction.created']);
      enqueueWebhookEvent(userId, 'transaction.created', { id: 'tx1' });
      assert.ok(listWebhookDeliveries(userId).length > 0);

      assert.equal(deleteWebhookSubscription(userId, created.subscription.id), true);
      assert.equal(listWebhookDeliveries(userId).length, 0);
      assert.equal(deleteWebhookSubscription(userId, created.subscription.id), false);
    } finally {
      cleanupUser(userId);
    }
  });

  // ── 事件排出與投遞 ──

  test('enqueueWebhookEvent 只排給訂閱該事件且啟用中的訂閱', () => {
    const userId = 'test_webhook_' + uid();
    createTestUser(userId);
    try {
      createWebhookSubscription(userId, 'https://example.com/created', ['transaction.created']);
      createWebhookSubscription(userId, 'https://example.com/deleted', ['transaction.deleted']);
      const disabled = createWebhookSubscription(userId, 'https://example.com/all', undefined);
      updateWebhookSubscription(userId, disabled.subscription.id, { active: false });

      assert.equal(enqueueWebhookEvent(userId, 'transaction.created', { id: 'tx1' }), 1);
      const deliveries = listWebhookDeliveries(userId);
      assert.equal(deliveries.length, 1);
      assert.equal(deliveries[0].eventType, 'transaction.created');
      assert.equal(deliveries[0].status, 'pending');
      assert.equal(deliveries[0].attempts, 0);
    } finally {
      cleanupUser(userId);
    }
  });

  test('投遞內容為含 id／type／createdAt／data 的事件信封', () => {
    const userId = 'test_webhook_' + uid();
    createTestUser(userId);
    try {
      createWebhookSubscription(userId, 'https://example.com/hooks', ['transaction.created']);
      enqueueWebhookEvent(userId, 'transaction.created', { id: 'tx1', amount: 100 });
      const row = queryOne('SELECT payload FROM webhook_deliveries WHERE user_id = ?', [userId]);
      const envelope = JSON.parse(String(row?.payload));
      assert.equal(envelope.type, 'transaction.created');
      assert.ok(envelope.id);
      assert.match(String(envelope.createdAt), /^\d{4}-\d{2}-\d{2}T.*Z$/);
      assert.deepEqual(envelope.data, { id: 'tx1', amount: 100 });
    } finally {
      cleanupUser(userId);
    }
  });

  test('buildTransactionEventData 只輸出對外欄位（不含 AI 內部欄位）', () => {    const data = buildTransactionEventData({
      id: 'tx1',
      type: 'expense',
      amount: 250,
      currency: 'TWD',
      date: '2026-01-02',
      account_id: 'acc1',
      category_id: 'cat1',
      note: '午餐',
      exclude_from_stats: 1,
      is_fx_fee: 1,
    });
    assert.deepEqual(data, {
      id: 'tx1',
      type: 'expense',
      amount: 250,
      currency: 'TWD',
      date: '2026-01-02',
      accountId: 'acc1',
      categoryId: 'cat1',
      note: '午餐',
    });
    assert.ok(!('is_fx_fee' in data));
    assert.ok(!('exclude_from_stats' in data));
  });

  test('投遞失敗（無法連線）會保留 pending 並排定重試，記錄狀態碼與錯誤', async () => {
    const userId = 'test_webhook_' + uid();
    createTestUser(userId);
    try {
      // .invalid 為保留網域，DNS 一定解析失敗，用來穩定模擬網路錯誤
      createWebhookSubscription(userId, 'https://not-a-real-host.invalid/hooks', ['transaction.created']);
      enqueueWebhookEvent(userId, 'transaction.created', { id: 'tx1' });
      const deliveryId = listWebhookDeliveries(userId)[0].id;

      const status = await attemptWebhookDelivery(deliveryId);
      assert.equal(status, 'pending');

      const after = listWebhookDeliveries(userId)[0];
      assert.equal(after.attempts, 1);
      assert.equal(after.status, 'pending');
      assert.ok(after.lastError.length > 0);

      const row = queryOne('SELECT next_retry_at FROM webhook_deliveries WHERE id = ?', [deliveryId]);
      assert.ok(Number(row?.next_retry_at) > 0);
    } finally {
      cleanupUser(userId);
    }
  });

  test('投遞紀錄可依訂閱過濾，且序列化為 ISO 8601 UTC', () => {
    const userId = 'test_webhook_' + uid();
    createTestUser(userId);
    try {
      const subA = createWebhookSubscription(userId, 'https://example.com/a', ['transaction.created']);
      createWebhookSubscription(userId, 'https://example.com/b', ['transaction.created']);
      enqueueWebhookEvent(userId, 'transaction.created', { id: 'tx1' });

      const filtered = listWebhookDeliveries(userId, { subscriptionId: subA.subscription.id });
      assert.equal(filtered.length, 1);
      assert.equal(filtered[0].subscriptionId, subA.subscription.id);

      const serialized = serializeWebhookDelivery(filtered[0]);
      assert.match(serialized.createdAt, /^\d{4}-\d{2}-\d{2}T.*Z$/);
      assert.equal(serialized.deliveredAt, null);
    } finally {
      cleanupUser(userId);
    }
  });

  test('刪除訂閱後仍存在的投遞紀錄會被標記為 failed（不會無限重試）', async () => {
    const userId = 'test_webhook_' + uid();
    createTestUser(userId);
    try {
      const created = createWebhookSubscription(userId, 'https://example.com/a', ['transaction.created']);
      enqueueWebhookEvent(userId, 'transaction.created', { id: 'tx1' });
      const deliveryId = listWebhookDeliveries(userId)[0].id;

      // 直接刪除訂閱列（模擬外部清理），保留投遞列
      getDB().run('DELETE FROM webhook_subscriptions WHERE id = ?', [created.subscription.id]);
      const status = await attemptWebhookDelivery(deliveryId);
      assert.equal(status, 'failed');
      const row = queryOne('SELECT status, last_error FROM webhook_deliveries WHERE id = ?', [deliveryId]);
      assert.equal(String(row?.status), 'failed');
      assert.ok(String(row?.last_error).length > 0);
    } finally {
      cleanupUser(userId);
    }
  });

  test('停用帳號的 API Token 立即失效（比照 mcpAuth 的 fail-closed 修補）', () => {
    const userId = 'test_apitoken_' + uid();
    createTestUser(userId);
    try {
      const created = createApiToken(userId, '停用測試', ['transactions:read']);
      assert.ok(verifyApiToken(created.token));
      getDB().run('UPDATE users SET is_active = 0 WHERE id = ?', [userId]);
      assert.equal(verifyApiToken(created.token), null);
    } finally {
      cleanupUser(userId);
    }
  });

  test('不同使用者的 Token 互不影響', () => {
    const userA = 'test_apitoken_a_' + uid();
    const userB = 'test_apitoken_b_' + uid();
    createTestUser(userA);
    createTestUser(userB);
    try {
      const created = createApiToken(userA, 'A 的 Token', ['transactions:read']);
      assert.equal(verifyApiToken(created.token)?.userId, userA);
      assert.equal(listApiTokens(userB).length, 0);
      assert.equal(revokeApiToken(userB, created.id), false);
      assert.ok(verifyApiToken(created.token));
    } finally {
      cleanupUser(userA);
      cleanupUser(userB);
    }
  });

  test('成功投遞：以 HMAC 簽章送出，並記錄 success 與狀態碼', async () => {
    // 投遞層只允許「解析後為公開位址的 https 端點」，因此以封閉網路環境
    // （假 DNS + 自簽憑證的測試 https 伺服器）模擬真實公開端點。
    const { installWebhookNetHarness, startTestHttpsServer, TEST_HOSTNAME } =
      await import('../support/webhookNetHarness.ts');
    const { verifyWebhookSignature, WEBHOOK_SIGNATURE_HEADER, WEBHOOK_EVENT_HEADER } =
      await import('../../lib/apiTokenCore.ts');

    const received: Array<{ body: string; signature: string; event: string }> = [];
    const harness = installWebhookNetHarness();
    const { server } = await startTestHttpsServer((req, res) => {
      let raw = '';
      req.on('data', (chunk) => { raw += chunk; });
      req.on('end', () => {
        received.push({
          body: raw,
          signature: String(req.headers[WEBHOOK_SIGNATURE_HEADER.toLowerCase()] || ''),
          event: String(req.headers[WEBHOOK_EVENT_HEADER.toLowerCase()] || ''),
        });
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      });
    });

    const userId = 'test_webhook_' + uid();
    createTestUser(userId);
    try {
      const created = createWebhookSubscription(userId, 'https://example.com/replaced', ['transaction.created']);
      getDB().run('UPDATE webhook_subscriptions SET url = ? WHERE id = ?', [
        harness.publicUrl(TEST_HOSTNAME, server, '/hooks'),
        created.subscription.id,
      ]);
      enqueueWebhookEvent(userId, 'transaction.created', { id: 'tx1', amount: 100 });
      const deliveryId = listWebhookDeliveries(userId)[0].id;

      const status = await attemptWebhookDelivery(deliveryId);
      assert.equal(status, 'success');

      // 接收端以同一把密鑰驗證簽章：必須通過，且事件標頭正確
      assert.equal(received.length, 1);
      assert.equal(received[0].event, 'transaction.created');
      assert.ok(
        verifyWebhookSignature(created.secret, received[0].body, received[0].signature),
        '接收端應能以簽章密鑰驗證 HMAC',
      );
      // 以錯誤密鑰必須驗證失敗
      assert.equal(
        verifyWebhookSignature('whsec_wrong', received[0].body, received[0].signature),
        false,
      );

      const recorded = listWebhookDeliveries(userId)[0];
      assert.equal(recorded.status, 'success');
      assert.equal(recorded.attempts, 1);
      assert.equal(recorded.lastStatusCode, 200);
      assert.ok((recorded.deliveredAt || 0) > 0);

      const sub = getWebhookSubscription(userId, created.subscription.id);
      assert.ok((sub?.lastSuccessAt || 0) > 0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      harness.restore();
      cleanupUser(userId);
    }
  });

  test('5xx 回應會重試，4xx 則直接標記 failed（不再重試）', async () => {
    const { installWebhookNetHarness, startTestHttpsServer, TEST_HOSTNAME } =
      await import('../support/webhookNetHarness.ts');
    let responder: (res: import('node:http').ServerResponse) => void = (res) => {
      res.writeHead(500); res.end('boom');
    };
    const harness = installWebhookNetHarness();
    const { server } = await startTestHttpsServer((_req, res) => responder(res));

    const userId = 'test_webhook_' + uid();
    createTestUser(userId);
    try {
      const created = createWebhookSubscription(userId, 'https://example.com/replaced', ['transaction.created']);
      getDB().run('UPDATE webhook_subscriptions SET url = ? WHERE id = ?', [
        harness.publicUrl(TEST_HOSTNAME, server, '/hooks'),
        created.subscription.id,
      ]);
      enqueueWebhookEvent(userId, 'transaction.created', { id: 'tx1' });
      const deliveryId = listWebhookDeliveries(userId)[0].id;

      assert.equal(await attemptWebhookDelivery(deliveryId), 'pending');
      assert.equal(listWebhookDeliveries(userId)[0].lastStatusCode, 500);

      // 改為永久性錯誤：直接標記 failed 並清除重試排程
      responder = (res) => { res.writeHead(422); res.end('nope'); };
      assert.equal(await attemptWebhookDelivery(deliveryId), 'failed');
      const failed = listWebhookDeliveries(userId)[0];
      assert.equal(failed.status, 'failed');
      assert.equal(failed.lastStatusCode, 422);
      assert.equal(failed.attempts, 2);
      const row = queryOne('SELECT next_retry_at FROM webhook_deliveries WHERE id = ?', [deliveryId]);
      assert.equal(Number(row?.next_retry_at), 0);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      harness.restore();
      cleanupUser(userId);
    }
  });

  test('runDueWebhookDeliveries 認領後投遞，且不會重複投遞同一列', async () => {
    const { installWebhookNetHarness, startTestHttpsServer, TEST_HOSTNAME } =
      await import('../support/webhookNetHarness.ts');
    let hitCount = 0;
    const harness = installWebhookNetHarness();
    const { server } = await startTestHttpsServer((_req, res) => {
      hitCount += 1;
      res.writeHead(200); res.end('ok');
    });

    const userId = 'test_webhook_' + uid();
    createTestUser(userId);
    try {
      const created = createWebhookSubscription(userId, 'https://example.com/replaced', ['transaction.created']);
      getDB().run('UPDATE webhook_subscriptions SET url = ? WHERE id = ?', [
        harness.publicUrl(TEST_HOSTNAME, server, '/hooks'),
        created.subscription.id,
      ]);
      enqueueWebhookEvent(userId, 'transaction.created', { id: 'tx1' });

      const processed = await runDueWebhookDeliveries();
      assert.equal(processed, 1);
      assert.equal(hitCount, 1);
      assert.equal(listWebhookDeliveries(userId)[0].status, 'success');

      // 已成功的列不會被再次掃到
      assert.equal(await runDueWebhookDeliveries(), 0);
      assert.equal(hitCount, 1);

      // 尚未到重試時間的 pending 列不應被提前投遞
      // （先把第一個訂閱停用，避免 tx2 同時排給它而混淆斷言）
      updateWebhookSubscription(userId, created.subscription.id, { active: false });
      const sub2 = createWebhookSubscription(userId, 'https://example.com/second', ['transaction.created']);
      enqueueWebhookEvent(userId, 'transaction.created', { id: 'tx2' });
      const pendingId = listWebhookDeliveries(userId, { subscriptionId: sub2.subscription.id })[0].id;
      getDB().run('UPDATE webhook_deliveries SET next_retry_at = ? WHERE id = ?', [Date.now() + 60_000, pendingId]);
      assert.equal(await runDueWebhookDeliveries(), 0);
      assert.equal(hitCount, 1);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      harness.restore();
      cleanupUser(userId);
    }
  });

  test('批次內每筆 Webhook 都從實際認領時刻開始租約', async () => {
    const { installWebhookNetHarness, startTestHttpsServer, TEST_HOSTNAME } =
      await import('../support/webhookNetHarness.ts');
    let hitCount = 0;
    let secondLeaseRemaining = 0;
    let secondDeliveryId = '';
    const harness = installWebhookNetHarness();
    const { server } = await startTestHttpsServer((_req, res) => {
      hitCount += 1;
      if (hitCount === 1) {
        setTimeout(() => {
          res.writeHead(200);
          res.end('ok');
        }, 6_000);
        return;
      }
      if (hitCount === 2) {
        const row = queryOne('SELECT next_retry_at FROM webhook_deliveries WHERE id = ?', [secondDeliveryId]);
        secondLeaseRemaining = Number(row?.next_retry_at) - Date.now();
      }
      res.writeHead(200);
      res.end('ok');
    });

    const userId = 'test_webhook_lease_' + uid();
    createTestUser(userId);
    try {
      const url = harness.publicUrl(TEST_HOSTNAME, server, '/hooks');
      const first = createWebhookSubscription(userId, 'https://example.com/first', ['transaction.created']);
      const second = createWebhookSubscription(userId, 'https://example.com/second', ['transaction.created']);
      getDB().run('UPDATE webhook_subscriptions SET url = ? WHERE id IN (?, ?)', [
        url,
        first.subscription.id,
        second.subscription.id,
      ]);
      enqueueWebhookEvent(userId, 'transaction.created', { id: 'tx-lease' });

      const firstDeliveryId = listWebhookDeliveries(userId, { subscriptionId: first.subscription.id })[0].id;
      secondDeliveryId = String(listWebhookDeliveries(userId, { subscriptionId: second.subscription.id })[0].id);
      // 保證批次排序為 first → second，即使資料庫在同一毫秒建立兩列。
      getDB().run('UPDATE webhook_deliveries SET created_at = ? WHERE id = ?', [Date.now() - 2_000, firstDeliveryId]);
      getDB().run('UPDATE webhook_deliveries SET created_at = ? WHERE id = ?', [Date.now() - 1_000, secondDeliveryId]);

      assert.equal(await runDueWebhookDeliveries(), 2);
      assert.equal(hitCount, 2);
      assert.ok(
        secondLeaseRemaining > 20_000,
        `第二筆投遞應有完整的新租約（剩餘 ${secondLeaseRemaining}ms），不可沿用批次開始時的舊租約`,
      );
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      harness.restore();
      cleanupUser(userId);
    }
  });

  test('簽章密鑰無法解密時直接永久失敗（不再無意義重試）', async () => {
    const userId = 'test_webhook_' + uid();
    createTestUser(userId);
    try {
      const created = createWebhookSubscription(userId, 'https://example.com/hooks', ['transaction.created']);
      enqueueWebhookEvent(userId, 'transaction.created', { id: 'tx1' });
      const deliveryId = listWebhookDeliveries(userId)[0].id;

      // 模擬主金鑰更換／資料損毀
      getDB().run('UPDATE webhook_subscriptions SET secret_encrypted = ? WHERE id = ?', [
        'corrupted.corrupted.corrupted',
        created.subscription.id,
      ]);

      assert.equal(await attemptWebhookDelivery(deliveryId), 'failed');
      const failed = listWebhookDeliveries(userId)[0];
      assert.equal(failed.status, 'failed');
      assert.match(failed.lastError, /簽章密鑰/);
      const row = queryOne('SELECT next_retry_at FROM webhook_deliveries WHERE id = ?', [deliveryId]);
      assert.equal(Number(row?.next_retry_at), 0);
    } finally {
      cleanupUser(userId);
    }
  });

  test('requireApiToken 解析 Bearer 權杖並依 scope 放行／拒絕', async () => {    const { requireApiToken, extractBearerToken } = await import('../../lib/apiTokenRequestAuth.ts');
    const userId = 'test_apitoken_' + uid();
    createTestUser(userId);
    try {
      const readOnly = createApiToken(userId, '讀取用', ['transactions:read']);
      const writeOnly = createApiToken(userId, '寫入用', ['transactions:write']);

      // 標頭解析
      assert.equal(extractBearerToken(`Bearer ${readOnly.token}`), readOnly.token);
      assert.equal(extractBearerToken(`bearer ${readOnly.token}`), null, '前綴需區分大小寫');
      assert.equal(extractBearerToken('Basic abc'), null);
      assert.equal(extractBearerToken(null), null);
      assert.equal(extractBearerToken('Bearer   '), null);

      const headersOf = (value: string | null) => ({ headers: { get: (n: string) => (n.toLowerCase() === 'authorization' ? value : null) } });

      // 具備 scope 時回傳驗證結果（而非 NextResponse）
      const ok = requireApiToken(headersOf(`Bearer ${readOnly.token}`), 'transactions:read');
      assert.ok(!(ok instanceof (await import('next/server')).NextResponse));
      assert.equal((ok as { userId: string }).userId, userId);

      // 缺少 scope 時 403
      const forbidden = requireApiToken(headersOf(`Bearer ${readOnly.token}`), 'transactions:write');
      assert.ok(forbidden instanceof (await import('next/server')).NextResponse);
      assert.equal((forbidden as { status: number }).status, 403);

      // 未帶／帶錯權杖時 401
      const missing = requireApiToken(headersOf(null), 'transactions:read');
      assert.equal((missing as { status: number }).status, 401);
      const bad = requireApiToken(headersOf('Bearer ap_api_nope'), 'transactions:read');
      assert.equal((bad as { status: number }).status, 401);

      // 已撤銷的權杖立即失效
      revokeApiToken(userId, writeOnly.id);
      const revoked = requireApiToken(headersOf(`Bearer ${writeOnly.token}`), 'transactions:write');
      assert.equal((revoked as { status: number }).status, 401);
    } finally {
      cleanupUser(userId);
    }
  });

  test('/api/v1 POST 拒絕其他使用者的分類／帳戶 id（避免跨使用者寫入）', async () => {
    const v1 = await import('../../app/api/v1/transactions/route.ts');
    const { NextRequest } = await import('next/server');

    const owner = 'test_v1_owner_' + uid();
    const attacker = 'test_v1_attacker_' + uid();
    createTestUser(owner);
    createTestUser(attacker);
    const ownerCat = uid();
    const ownerAcc = uid();
    const ownerParentCat = uid();
    try {
      // 建立子分類（parent）與帳戶，供持有人使用
      getDB().run(
        'INSERT INTO categories (id, user_id, name, type, parent_id) VALUES (?,?,?,?,?)',
        [ownerParentCat, owner, '餐飲', 'expense', ''],
      );
      getDB().run(
        'INSERT INTO categories (id, user_id, name, type, parent_id) VALUES (?,?,?,?,?)',
        [ownerCat, owner, '午餐', 'expense', ownerParentCat],
      );
      getDB().run(
        'INSERT INTO accounts (id, user_id, name, currency) VALUES (?,?,?,?)',
        [ownerAcc, owner, '現金', 'TWD'],
      );

      const attackerToken = createApiToken(attacker, '攻擊者', ['transactions:write', 'transactions:read']);
      const post = (payload: Record<string, unknown>) =>
        v1.POST(
          new NextRequest('http://localhost/api/v1/transactions', {
            method: 'POST',
            headers: { authorization: `Bearer ${attackerToken.token}`, 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          }),
        );

      // 持有他人的 categoryId / accountId 必須被拒絕
      const foreignCat = await post({ type: 'expense', amount: 100, categoryId: ownerCat, accountId: ownerAcc });
      assert.equal(foreignCat.status, 400);
      assert.equal((await foreignCat.json()).code, 'ValidationError');

      const foreignAcc = await post({ type: 'expense', amount: 100, accountId: ownerAcc });
      assert.equal(foreignAcc.status, 400);

      // 父分類不可直接掛交易
      const parentCat = await post({ type: 'expense', amount: 100, categoryId: ownerParentCat });
      assert.equal(parentCat.status, 400);

      // 完全不存在的 id 亦拒絕
      assert.equal((await post({ type: 'expense', amount: 100, categoryId: uid() })).status, 400);

      // 未寫入任何交易
      const rows = queryAll('SELECT id FROM transactions WHERE user_id = ?', [attacker]);
      assert.equal(rows.length, 0, '被拒絕的請求不得寫入交易');

      // 沒有分類／帳戶的正當請求仍可成功，並觸發 transaction.created
      createWebhookSubscription(attacker, 'https://example.com/hooks', ['transaction.created']);
      const ok = await post({ type: 'expense', amount: 100, note: '正常寫入' });
      assert.equal(ok.status, 201);
      assert.equal((await ok.json()).transaction.note, '正常寫入');
      assert.equal(listWebhookDeliveries(attacker)[0].eventType, 'transaction.created');
    } finally {
      getDB().run('DELETE FROM webhook_deliveries WHERE user_id = ?', [attacker]);
      getDB().run('DELETE FROM webhook_subscriptions WHERE user_id = ?', [attacker]);
      getDB().run('DELETE FROM transactions WHERE user_id = ?', [attacker]);
      getDB().run('DELETE FROM transactions WHERE user_id = ?', [owner]);
      getDB().run('DELETE FROM accounts WHERE user_id IN (?,?)', [owner, attacker]);
      getDB().run('DELETE FROM categories WHERE user_id = ?', [owner]);
      cleanupUser(owner);
      cleanupUser(attacker);
    }
  });

  test('稽核鍵納入允許清單（Token／Webhook 管理操作可被記錄）', async () => {
    const { writeOperationAudit } = await import('../../lib/auditHelpers.ts');
    const userId = 'test_audit_' + uid();
    createTestUser(userId);
    try {
      writeOperationAudit({
        userId,
        action: 'api_token_create',
        metadata: {
          api_token_id: 'tok_1',
          api_token_name: 'CI 腳本',
          api_token_scopes: 'transactions:read',
          webhook_subscription_id: 'sub_1',
          webhook_url: 'https://example.com/hooks',
          webhook_delivery_id: 'dl_1',
          webhook_event_type: 'transaction.created',
          webhook_status: 'success',
          // 未列入允許清單的鍵必須被丢弃
          token_plaintext: 'ap_api_should_not_be_stored',
        },
      });
      const row = queryOne(
        "SELECT metadata FROM data_operation_audit_log WHERE user_id = ? AND action = 'api_token_create'",
        [userId],
      );
      const metadata = JSON.parse(String(row?.metadata || '{}'));
      assert.equal(metadata.api_token_id, 'tok_1');
      assert.equal(metadata.webhook_delivery_id, 'dl_1');
      assert.ok(!('token_plaintext' in metadata));
      getDB().run('DELETE FROM data_operation_audit_log WHERE user_id = ?', [userId]);
    } finally {
      cleanupUser(userId);
    }
  });
}
