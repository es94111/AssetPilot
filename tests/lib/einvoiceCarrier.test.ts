// tests/lib/einvoiceCarrier.test.ts — 雲端發票載具整合的 PostgreSQL 整合測試（issue #253）
//
// 需要真實 PostgreSQL（DATABASE_URL/POSTGRES_URL）；未設定時整支略過，
// 保持 `npm test` 在無 DB 環境下仍可通過（比照 tests/lib/transactionWriteCore.test.ts）。
//
// 全程以 stub fetch 模擬財政部 API，**絕不連線真實外部服務**。
// 涵蓋 issue 驗收條件：
//  1. 綁定／解除載具，憑證加密封存（回應與 DB 皆不得出現明文驗證碼）
//  2. 同步轉為交易草稿、使用者確認後才入帳
//  3. 欄位對應與「以發票號碼為唯一鍵」去重
//  4. 同步失敗保留錯誤狀態且不自動重試（退避期間不再發出請求）
//  5. 稽核日誌記錄綁定與同步行為（不含憑證）
//  6. 供應商未設定時優雅降級
//  7. 帳本邊界：不透過共享帳本操作（fail closed）
//
// 執行：node --experimental-transform-types --import ./tests/setup/register.mjs tests/lib/einvoiceCarrier.test.ts
import assert from 'node:assert/strict';
import test, { after } from 'node:test';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  test('einvoiceCarrier（略過：未設定 DATABASE_URL/POSTGRES_URL，需搭配 PostgreSQL 執行完整驗證）', () => {});
} else {
  const { initDB, getDB, queryOne, queryAll } = await import('../../lib/db.ts');
  const { uid } = await import('../../lib/userDefaults.ts');
  const { createLoginSession } = await import('../../lib/sessionHelpers.ts');
  const {
    MAX_ACTIVE_CARRIERS,
    bindCarrier,
    dismissInvoice,
    findInvoice,
    listCarriers,
    listInvoices,
    markInvoiceImported,
    resolveSyncRange,
    revokeCarrier,
    syncCarrier,
  } = await import('../../lib/einvoiceCarrier.ts');
  const { readInvoiceProviderConfig } = await import('../../lib/einvoiceCore.ts');
  const { EINVOICE_SYNC_INTERVAL_MS, runDueInvoiceSyncsForUser } = await import('../../lib/einvoiceSync.ts');
  const { encryptSecret } = await import('../../lib/apiTokenCore.ts');
  const { NextRequest } = await import('next/server');
  const carriersRoute = await import('../../app/api/imports/invoice-carriers/route.ts');
  const carrierItemRoute = await import('../../app/api/imports/invoice-carriers/[id]/route.ts');
  const invoicesRoute = await import('../../app/api/imports/invoices/route.ts');
  const invoiceItemRoute = await import('../../app/api/imports/invoices/[id]/route.ts');

  await initDB();

  const ENV = {
    ...process.env,
    EINVOICE_ENCRYPTION_KEY: process.env.EINVOICE_ENCRYPTION_KEY || 'test-einvoice-encryption-key',
    EINVOICE_API_ENDPOINT: 'https://einvoice.example.test/query',
    EINVOICE_API_APP_ID: 'test-app-id',
    EINVOICE_API_KEY: 'test-api-key',
  } as NodeJS.ProcessEnv;
  const CONFIG = readInvoiceProviderConfig(ENV);
  const UNCONFIGURED = readInvoiceProviderConfig({});

  const BARCODE_A = '/ABC1234';
  const BARCODE_B = '/XYZ9876';
  const VERIFY_CODE = 'secretverify';

  function jsonResponse(payload: unknown, status = 200): Response {
    return new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /** 以固定發票清單回應的 stub（永不連線外部）。 */
  function stubFetch(invoices: unknown[], status = 200, onCall?: () => void) {
    return (async () => {
      onCall?.();
      return jsonResponse({ data: invoices }, status);
    }) as unknown as typeof fetch;
  }

  const SAMPLE_INVOICES = [
    {
      invoiceNumber: 'AB12345678',
      invoiceDate: '2026-10-01',
      invoiceTime: '09:15:00',
      sellerName: '測試超商',
      amount: 350,
    },
    {
      invoiceNumber: 'CD87654321',
      invoiceDate: '2026-10-03',
      invoiceTime: '',
      sellerName: '測試咖啡店',
      amount: 120,
    },
  ];

  function createUser(): string {
    const userId = `test_einvoice_${uid()}`;
    getDB().run(
      'INSERT INTO users (id,email,password_hash,display_name,created_at) VALUES (?,?,?,?,?)',
      [userId, `${userId}@example.com`, 'x', '測試使用者', new Date().toISOString()],
    );
    return userId;
  }

  function cleanupUser(userId: string): void {
    const db = getDB();
    db.run('DELETE FROM invoice_imports WHERE user_id = ?', [userId]);
    db.run('DELETE FROM invoice_carriers WHERE user_id = ?', [userId]);
    // 以 client_ref 去重寫入的交易（入帳測試用）。
    db.run("DELETE FROM transactions WHERE user_id = ? AND client_ref != ''", [userId]);
    db.run('DELETE FROM data_operation_audit_log WHERE user_id = ?', [userId]);
    db.run('DELETE FROM ledger_members WHERE user_id = ?', [userId]);
    db.run('DELETE FROM financial_ledgers WHERE owner_user_id = ?', [userId]);
    db.run('DELETE FROM users WHERE id = ?', [userId]);
  }

  await test('綁定載具：憑證加密存放，對外摘要與 DB 皆無明文驗證碼', async () => {
    const userId = createUser();
    try {
      const carrier = bindCarrier(userId, { barcode: BARCODE_A, verifyCode: VERIFY_CODE });
      assert.equal(carrier.carrierBarcode, '/ABC••••');
      assert.equal(carrier.carrierBarcode.includes('1234'), false, '遮罩不得洩漏尾碼');
      assert.equal(carrier.verifyCodeSet, true);
      assert.equal(carrier.status, 'active');
      assert.equal(carrier.autoSync, true, '排程同步預設開啟');

      const row = queryOne('SELECT * FROM invoice_carriers WHERE user_id = ?', [userId]);
      const stored = String(row?.verify_code_encrypted || '');
      assert.notEqual(stored, VERIFY_CODE, 'DB 不得存放明文驗證碼');
      assert.equal(stored.includes(VERIFY_CODE), false, '密文不得包含明文片段');
      assert.match(stored, /^[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+\.[A-Za-z0-9+/=]+$/, '應為 iv.tag.ciphertext 格式');
      // 條碼本身是查詢鍵（非機密），但遮蔽欄位亦應存在。
      assert.equal(String(row?.carrier_barcode_masked), '/ABC••••');
      // JSON 摘要不得帶出任何憑證欄位
      assert.equal(JSON.stringify(carrier).includes(VERIFY_CODE), false);
      assert.equal(JSON.stringify(carrier).includes('verify_code'), false);
    } finally {
      cleanupUser(userId);
    }
  });

  await test('重複綁定同一載具會更新憑證並清空退避狀態（不新增第二列）', async () => {
    const userId = createUser();
    try {
      const first = bindCarrier(userId, { barcode: BARCODE_A, verifyCode: VERIFY_CODE });
      getDB().run(
        "UPDATE invoice_carriers SET last_sync_status = 'failed', consecutive_failures = 3, next_retry_at = ? WHERE id = ?",
        [Date.now() + 60_000, first.id],
      );
      const again = bindCarrier(userId, { barcode: BARCODE_A, verifyCode: 'newverify' });
      assert.equal(again.id, first.id, '同一載具應重用既有列');
      assert.equal(again.consecutiveFailures, 0);
      assert.equal(again.retryAfterSeconds, 0);
      assert.equal(Number(queryOne('SELECT COUNT(*) AS cnt FROM invoice_carriers WHERE user_id = ?', [userId])?.cnt), 1);
    } finally {
      cleanupUser(userId);
    }
  });

  await test('載具數量上限與格式驗證（fail closed）', async () => {
    const userId = createUser();
    try {
      assert.throws(
        () => bindCarrier(userId, { barcode: 'NOT-A-BARCODE', verifyCode: VERIFY_CODE }),
        /手機條碼載具格式無效/,
      );
      assert.throws(
        () => bindCarrier(userId, { barcode: BARCODE_A, verifyCode: 'short' }),
        /驗證碼格式無效/,
      );
      const barcodes = ['/AAAA111', '/BBBB222', '/CCCC333', '/DDDD444', '/EEEE555'];
      for (const barcode of barcodes) bindCarrier(userId, { barcode, verifyCode: VERIFY_CODE });
      assert.equal(listCarriers(userId).length, MAX_ACTIVE_CARRIERS);
      assert.throws(
        () => bindCarrier(userId, { barcode: '/FFFF666', verifyCode: VERIFY_CODE }),
        /已綁定的手機條碼載具達上限/,
      );
    } finally {
      cleanupUser(userId);
    }
  });

  await test('解除綁定清除憑證密文但保留既有發票紀錄', async () => {
    const userId = createUser();
    try {
      const carrier = bindCarrier(userId, { barcode: BARCODE_A, verifyCode: VERIFY_CODE });
      await syncCarrier({ userId }, carrier.id, { fetchImpl: stubFetch(SAMPLE_INVOICES), config: CONFIG, env: ENV, rangeDays: 30 });
      assert.equal(listInvoices(userId).length, 2);

      assert.equal(revokeCarrier(userId, carrier.id), true);
      const row = queryOne('SELECT * FROM invoice_carriers WHERE id = ?', [carrier.id]);
      assert.equal(String(row?.status), 'revoked');
      assert.equal(String(row?.verify_code_encrypted), '', '解除綁定須清除憑證密文');
      assert.equal(Number(queryOne('SELECT COUNT(*) AS cnt FROM invoice_imports WHERE user_id = ?', [userId])?.cnt), 2, '發票紀錄應保留');
      assert.equal(listCarriers(userId).length, 0, '解除後不再列於啟用清單');

      // 已解除的載具不可再同步
      await assert.rejects(
        () => syncCarrier({ userId }, carrier.id, { fetchImpl: stubFetch([]), config: CONFIG, env: ENV }),
        /已解除綁定/,
      );
    } finally {
      cleanupUser(userId);
    }
  });

  await test('同一載具的並行同步只呼叫供應商一次', async () => {
    const userId = createUser();
    try {
      const carrier = bindCarrier(userId, { barcode: BARCODE_A, verifyCode: VERIFY_CODE });
      let fetchCalls = 0;
      const fetchImpl = (async () => {
        fetchCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 30));
        return jsonResponse({ data: [SAMPLE_INVOICES[0]] });
      }) as unknown as typeof fetch;
      const results = await Promise.all([
        syncCarrier({ userId }, carrier.id, { fetchImpl, config: CONFIG, env: ENV }),
        syncCarrier({ userId }, carrier.id, { fetchImpl, config: CONFIG, env: ENV }),
      ]);
      assert.equal(fetchCalls, 1);
      assert.equal(results.filter((result) => result.status === 'success').length, 1);
      assert.equal(results.filter((result) => result.status === 'skipped').length, 1);
      assert.equal(Number(queryOne('SELECT COUNT(*) AS cnt FROM invoice_imports WHERE user_id = ?', [userId])?.cnt), 1);
      assert.equal(Number(queryOne('SELECT sync_lock_until FROM invoice_carriers WHERE id = ?', [carrier.id])?.sync_lock_until), 0);
    } finally {
      cleanupUser(userId);
    }
  });

  await test('同步轉為交易草稿：欄位正確對應且未確認前不產生交易', async () => {
    const userId = createUser();
    try {
      const carrier = bindCarrier(userId, { barcode: BARCODE_A, verifyCode: VERIFY_CODE });
      const result = await syncCarrier({ userId }, carrier.id, {
        fetchImpl: stubFetch(SAMPLE_INVOICES), config: CONFIG, env: ENV, rangeDays: 30,
      });
      assert.equal(result.status, 'success');
      assert.equal(result.created, 2);
      assert.equal(result.duplicates, 0);
      assert.equal(result.skipped, 0);

      const drafts = listInvoices(userId, { status: 'draft' });
      assert.equal(drafts.length, 2);
      const first = drafts.find((d) => d.invoiceNumber === 'AB12345678');
      assert.ok(first, '應有第一張發票草稿');
      assert.equal(first.invoiceDate, '2026-10-01');
      assert.equal(first.invoiceTime, '09:15:00');
      assert.equal(first.sellerName, '測試超商');
      assert.equal(first.amount, 350);
      assert.equal(first.status, 'draft');
      assert.equal(first.transactionId, '');

      // 草稿階段不得建立任何交易
      assert.equal(
        Number(queryOne('SELECT COUNT(*) AS cnt FROM transactions WHERE user_id = ?', [userId])?.cnt),
        0,
        '未確認的草稿不應產生交易',
      );
    } finally {
      cleanupUser(userId);
    }
  });

  await test('以發票號碼為唯一鍵去重：重複匯入不產生第二列', async () => {
    const userId = createUser();
    try {
      const carrier = bindCarrier(userId, { barcode: BARCODE_A, verifyCode: VERIFY_CODE });
      await syncCarrier({ userId }, carrier.id, { fetchImpl: stubFetch(SAMPLE_INVOICES), config: CONFIG, env: ENV, rangeDays: 30 });
      // 第二次同步（供應商再次回傳同樣發票）
      const second = await syncCarrier({ userId }, carrier.id, {
        fetchImpl: stubFetch(SAMPLE_INVOICES), config: CONFIG, env: ENV, rangeDays: 30,
      });
      assert.equal(second.created, 0);
      assert.equal(second.duplicates, 2);
      assert.equal(
        Number(queryOne('SELECT COUNT(*) AS cnt FROM invoice_imports WHERE user_id = ?', [userId])?.cnt),
        2,
        '去重後仍只有兩列',
      );
      // 唯一鍵由 DB 保證
      assert.throws(() => {
        getDB().run(
          `INSERT INTO invoice_imports
           (id,user_id,carrier_id,invoice_number,invoice_date,invoice_time,seller_name,amount,status,transaction_id,created_at,updated_at,imported_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [uid(), userId, carrier.id, 'AB12345678', '2026-10-01', '', '', 350, 'draft', '', Date.now(), Date.now(), 0],
        );
      }, '同一使用者同一發票號碼應被唯一鍵拒絕');
    } finally {
      cleanupUser(userId);
    }
  });

  await test('已入帳的草稿不會被後續同步覆蓋回 draft', async () => {
    const userId = createUser();
    try {
      const carrier = bindCarrier(userId, { barcode: BARCODE_A, verifyCode: VERIFY_CODE });
      await syncCarrier({ userId }, carrier.id, { fetchImpl: stubFetch(SAMPLE_INVOICES), config: CONFIG, env: ENV, rangeDays: 30 });
      const draft = listInvoices(userId, { status: 'draft' })[0];
      markInvoiceImported(userId, draft.id, 'tx-placeholder');
      assert.equal(String(findInvoice(userId, draft.id)?.status), 'imported');

      await syncCarrier({ userId }, carrier.id, { fetchImpl: stubFetch(SAMPLE_INVOICES), config: CONFIG, env: ENV, rangeDays: 30 });
      assert.equal(String(findInvoice(userId, draft.id)?.status), 'imported', '已入帳狀態不應被覆蓋');
      assert.equal(String(findInvoice(userId, draft.id)?.transaction_id), 'tx-placeholder');
    } finally {
      cleanupUser(userId);
    }
  });

  await test('供應商未設定時優雅降級（不呼叫網路、不計入失敗、不設退避）', async () => {
    const userId = createUser();
    try {
      const carrier = bindCarrier(userId, { barcode: BARCODE_A, verifyCode: VERIFY_CODE });
      let called = false;
      const result = await syncCarrier({ userId }, carrier.id, {
        fetchImpl: stubFetch([], 200, () => { called = true; }),
        config: UNCONFIGURED,
        env: ENV,
      });
      assert.equal(called, false, '未設定時不得發出外部請求');
      assert.equal(result.status, 'skipped');
      assert.equal(result.degraded, true);
      assert.equal(result.created, 0);

      const summary = listCarriers(userId)[0];
      assert.equal(summary.lastSyncStatus, 'skipped');
      assert.equal(summary.consecutiveFailures, 0, '未設定不應計入失敗');
      assert.equal(summary.retryAfterSeconds, 0, '未設定不應設定退避');
      assert.match(summary.lastError, /EINVOICE_API_ENDPOINT/);
    } finally {
      cleanupUser(userId);
    }
  });

  await test('同步失敗保留錯誤狀態並設定退避；退避期間不再發出任何請求', async () => {
    const userId = createUser();
    try {
      const carrier = bindCarrier(userId, { barcode: BARCODE_A, verifyCode: VERIFY_CODE });
      let calls = 0;
      const failing = stubFetch([], 503, () => { calls += 1; });

      const first = await syncCarrier({ userId }, carrier.id, { fetchImpl: failing, config: CONFIG, env: ENV });
      assert.equal(first.status, 'failed');
      assert.equal(calls, 1);
      assert.match(first.errorMessage, /暫時無法使用/);

      const state = listCarriers(userId)[0];
      assert.equal(state.lastSyncStatus, 'failed');
      assert.equal(state.consecutiveFailures, 1);
      assert.ok(state.retryAfterSeconds > 0, '失敗後應進入退避');
      assert.notEqual(state.lastSyncAt, null, '仍應記錄嘗試時間');

      // 立即重試：必須被退避擋下且「不」呼叫供應商（不自動重試風暴）
      const blocked = await syncCarrier({ userId }, carrier.id, { fetchImpl: failing, config: CONFIG, env: ENV });
      assert.equal(blocked.status, 'skipped');
      assert.equal(calls, 1, '退避期間不得再發出請求');
      assert.match(blocked.errorMessage, /暫時停止重試/);

      // 錯誤狀態保留、退避不因使用者連點而被延後
      const after2 = listCarriers(userId)[0];
      assert.equal(after2.consecutiveFailures, 1);
      assert.ok(after2.retryAfterSeconds > 0);

      // 退避到期後可再次嘗試，且失敗次數累加（指數退避）
      getDB().run('UPDATE invoice_carriers SET next_retry_at = 0 WHERE user_id = ?', [userId]);
      const third = await syncCarrier({ userId }, carrier.id, { fetchImpl: failing, config: CONFIG, env: ENV });
      assert.equal(third.status, 'failed');
      assert.equal(calls, 2);
      assert.equal(listCarriers(userId)[0].consecutiveFailures, 2);
    } finally {
      cleanupUser(userId);
    }
  });

  await test('憑證失效（401）保留錯誤狀態並停用自動重試', async () => {
    const userId = createUser();
    try {
      const carrier = bindCarrier(userId, { barcode: BARCODE_A, verifyCode: VERIFY_CODE });
      const result = await syncCarrier({ userId }, carrier.id, {
        fetchImpl: stubFetch([], 401), config: CONFIG, env: ENV,
      });
      assert.equal(result.status, 'failed');
      assert.match(result.errorMessage, /重新綁定/);
      const state = listCarriers(userId)[0];
      assert.equal(state.lastSyncRetryable, false);
      assert.ok(state.retryAfterSeconds > 0, '不可重試錯誤仍使用短退避，阻擋手動連點');
    } finally {
      cleanupUser(userId);
    }
  });

  await test('成功與部分成功都會重置退避（使用者修正後可立即同步）', async () => {
    const userId = createUser();
    try {
      const carrier = bindCarrier(userId, { barcode: BARCODE_A, verifyCode: VERIFY_CODE });
      await syncCarrier({ userId }, carrier.id, { fetchImpl: stubFetch([], 500), config: CONFIG, env: ENV });
      assert.equal(listCarriers(userId)[0].consecutiveFailures, 1);

      getDB().run('UPDATE invoice_carriers SET next_retry_at = 0 WHERE user_id = ?', [userId]);
      const mixed = await syncCarrier({ userId }, carrier.id, {
        fetchImpl: stubFetch([SAMPLE_INVOICES[0], { invoiceNumber: 'bad', invoiceDate: '2026-10-01', amount: 5 }]),
        config: CONFIG,
        env: ENV,
        rangeDays: 30,
      });
      assert.equal(mixed.status, 'partial');
      assert.equal(mixed.created, 1);
      assert.equal(mixed.skipped, 1);
      assert.match(mixed.errorMessage, /1 筆發票欄位不完整/);
      const state = listCarriers(userId)[0];
      assert.equal(state.consecutiveFailures, 0, 'partial 應重置退避');
      assert.equal(state.retryAfterSeconds, 0);
    } finally {
      cleanupUser(userId);
    }
  });

  await test('憑證無法解密時回報明確錯誤並停用自動重試（不洩漏細節）', async () => {
    const userId = createUser();
    try {
      const carrier = bindCarrier(userId, { barcode: BARCODE_A, verifyCode: VERIFY_CODE });
      // 以另一把金鑰重新加密，模擬主金鑰被更換
      const wrongKeyEnv = { ...ENV, EINVOICE_ENCRYPTION_KEY: 'a-completely-different-key' } as NodeJS.ProcessEnv;
      getDB().run('UPDATE invoice_carriers SET verify_code_encrypted = ? WHERE id = ?', [
        encryptSecret(VERIFY_CODE, wrongKeyEnv.EINVOICE_ENCRYPTION_KEY as string),
        carrier.id,
      ]);
      let called = false;
      const result = await syncCarrier({ userId }, carrier.id, {
        fetchImpl: stubFetch([], 200, () => { called = true; }), config: CONFIG, env: ENV,
      });
      assert.equal(called, false, '無法解密時不得呼叫供應商');
      assert.equal(result.status, 'failed');
      assert.match(result.errorMessage, /重新綁定/);
      assert.equal(listCarriers(userId)[0].lastSyncRetryable, false);
      assert.ok(listCarriers(userId)[0].retryAfterSeconds > 0);
    } finally {
      cleanupUser(userId);
    }
  });

  await test('略過與入帳狀態轉換：已入帳不可略過、已略過不可入帳', async () => {
    const userId = createUser();
    try {
      const carrier = bindCarrier(userId, { barcode: BARCODE_A, verifyCode: VERIFY_CODE });
      await syncCarrier({ userId }, carrier.id, { fetchImpl: stubFetch(SAMPLE_INVOICES), config: CONFIG, env: ENV, rangeDays: 30 });
      const drafts = listInvoices(userId, { status: 'draft' });

      const dismissed = dismissInvoice(userId, drafts[0].id);
      assert.equal(dismissed.status, 'dismissed');
      // 重複略過為冪等（不拋錯、狀態不變）
      assert.equal(dismissInvoice(userId, drafts[0].id).status, 'dismissed');

      markInvoiceImported(userId, drafts[1].id, 'tx-1');
      assert.throws(
        () => dismissInvoice(userId, drafts[1].id),
        (error: unknown) => (error as { code?: string })?.code === 'InvoiceAlreadyImported',
        '已入帳的發票不可略過',
      );
    } finally {
      cleanupUser(userId);
    }
  });

  await test('查詢區間：預設近 30 天、最多 90 天，且會從上次最新發票日續拉', () => {
    assert.deepEqual(resolveSyncRange('', '2026-10-07'), { startDate: '2026-09-08', endDate: '2026-10-07' });
    // 上次最新發票日較新時，從該日續拉（不重掃整個區間）
    assert.deepEqual(resolveSyncRange('2026-10-05', '2026-10-07'), { startDate: '2026-10-05', endDate: '2026-10-07' });
    // 上次發票日早於預設區間時，仍用預設區間
    assert.deepEqual(resolveSyncRange('2020-01-01', '2026-10-07'), { startDate: '2026-09-08', endDate: '2026-10-07' });
    // 超過上限會被夾住
    assert.deepEqual(resolveSyncRange('', '2026-10-07', 500), { startDate: '2026-07-10', endDate: '2026-10-07' });
    assert.throws(() => resolveSyncRange('', 'not-a-date'), /日期格式無效/);
  });

  await test('共享帳本情境 fail closed：不以他人憑證寫入帳本資料', async () => {
    const userId = createUser();
    try {
      const carrier = bindCarrier(userId, { barcode: BARCODE_A, verifyCode: VERIFY_CODE });
      await assert.rejects(
        () => syncCarrier({ userId, isSharedLedger: true }, carrier.id, {
          fetchImpl: stubFetch(SAMPLE_INVOICES), config: CONFIG, env: ENV,
        }),
        /不支援共享帳本/,
      );
    } finally {
      cleanupUser(userId);
    }
  });

  await test('稽核日誌記錄綁定／同步／解除，且不含憑證明文', async () => {
    const userId = createUser();
    let token = '';
    try {
      ({ token } = createLoginSession(userId, 0, {}));
      const request = (path: string, method = 'GET', body?: unknown) => new NextRequest(
        `http://localhost${path}`,
        {
          method,
          headers: {
            Cookie: `authToken=${token}`,
            Origin: 'http://localhost',
            'Content-Type': 'application/json',
          },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
      );

      // 綁定（走真實 route handler，含稽核與 CSRF/origin 檢查）
      const bound = await carriersRoute.POST(request('/api/imports/invoice-carriers', 'POST', {
        carrierBarcode: BARCODE_A,
        verifyCode: VERIFY_CODE,
      }));
      assert.equal(bound.status, 201, await bound.clone().text());
      const carrierId = (await bound.json()).carrier.id;

      // 同步（route 內使用真實環境變數與全域 fetch；此處以未設定的環境降級，
      // 驗證稽核仍會寫入且不因供應商未設定而失敗）
      const synced = await carrierItemRoute.POST(
        request(`/api/imports/invoice-carriers/${carrierId}`, 'POST'),
        { params: Promise.resolve({ id: carrierId }) },
      );
      assert.equal(synced.status, 200, await synced.clone().text());

      const revoked = await carrierItemRoute.DELETE(
        request(`/api/imports/invoice-carriers/${carrierId}`, 'DELETE'),
        { params: Promise.resolve({ id: carrierId }) },
      );
      assert.equal(revoked.status, 200, await revoked.clone().text());

      const logs = queryAll(
        "SELECT action, result, metadata FROM data_operation_audit_log WHERE user_id = ? AND action LIKE 'invoice_%' ORDER BY timestamp",
        [userId],
      );
      const actions = logs.map((row) => String(row.action));
      assert.ok(actions.includes('invoice_carrier_bind'), `缺少綁定稽核：${actions.join(',')}`);
      assert.ok(actions.includes('invoice_sync'), `缺少同步稽核：${actions.join(',')}`);
      assert.ok(actions.includes('invoice_carrier_revoke'), `缺少解除稽核：${actions.join(',')}`);

      const bindLog = logs.find((row) => String(row.action) === 'invoice_carrier_bind');
      const metadata = String(bindLog?.metadata || '');
      assert.equal(metadata.includes(VERIFY_CODE), false, '稽核不得含明文驗證碼');
      assert.match(metadata, /\/ABC••••/, '稽核應記錄遮罩後條碼');
      assert.equal(metadata.includes('/ABC1234'), false, '稽核不得含完整條碼');
    } finally {
      cleanupUser(userId);
    }
  });

  await test('排程冷卻跨請求按載具隔離，且無載具不占用時段', async () => {
    const userA = createUser();
    const userB = createUser();
    const emptyUser = createUser();
    try {
      bindCarrier(userA, { barcode: BARCODE_A, verifyCode: VERIFY_CODE });
      bindCarrier(userB, { barcode: BARCODE_B, verifyCode: VERIFY_CODE });
      let fetchCalls = 0;
      const fetchImpl = stubFetch([], 200, () => { fetchCalls += 1; });
      const now = Date.now();

      assert.equal(await runDueInvoiceSyncsForUser(userA, 'Asia/Taipei', { now, env: ENV, fetchImpl }), 1);
      assert.equal(await runDueInvoiceSyncsForUser(userA, 'Asia/Taipei', { now, env: ENV, fetchImpl }), 0);
      assert.equal(await runDueInvoiceSyncsForUser(userB, 'Asia/Taipei', { now, env: ENV, fetchImpl }), 1);
      assert.equal(fetchCalls, 2, '每個使用者的載具上次同步時間獨立儲存於資料庫');

      assert.equal(await runDueInvoiceSyncsForUser(emptyUser, 'Asia/Taipei', { now, env: ENV, fetchImpl }), 0);
      bindCarrier(emptyUser, { barcode: BARCODE_A, verifyCode: VERIFY_CODE });
      assert.equal(await runDueInvoiceSyncsForUser(emptyUser, 'Asia/Taipei', { now, env: ENV, fetchImpl }), 1);
      assert.equal(fetchCalls, 3, '空載具清單不應占用使用者的排程檢查時段');
    } finally {
      cleanupUser(userA);
      cleanupUser(userB);
      cleanupUser(emptyUser);
    }
  });

  await test('401 等永久失敗不再由排程自動重試，但可手動重試', async () => {
    const userId = createUser();
    try {
      const carrier = bindCarrier(userId, { barcode: BARCODE_A, verifyCode: VERIFY_CODE });
      let fetchCalls = 0;
      const now = Date.now();
      assert.equal(await runDueInvoiceSyncsForUser(userId, 'Asia/Taipei', {
        now,
        env: ENV,
        fetchImpl: stubFetch([], 401, () => { fetchCalls += 1; }),
      }), 1);
      const failed = queryOne(
        'SELECT last_sync_retryable, next_retry_at FROM invoice_carriers WHERE id = ?',
        [carrier.id],
      );
      assert.equal(Number(failed?.last_sync_retryable), 0);
      assert.ok(Number(failed?.next_retry_at) > now, '永久失敗仍以短退避阻擋手動連點');

      assert.equal(await runDueInvoiceSyncsForUser(userId, 'Asia/Taipei', {
        now: now + EINVOICE_SYNC_INTERVAL_MS + 60_000,
        env: ENV,
        fetchImpl: stubFetch([], 200, () => { fetchCalls += 1; }),
      }), 0);
      assert.equal(fetchCalls, 1, '401 不應再由排程自動呼叫供應商');
      getDB().run('UPDATE invoice_carriers SET next_retry_at = 0 WHERE id = ?', [carrier.id]);

      const manual = await syncCarrier({ userId }, carrier.id, {
        config: CONFIG,
        env: ENV,
        fetchImpl: stubFetch([], 200, () => { fetchCalls += 1; }),
      });
      assert.equal(manual.status, 'success', '使用者仍可手動同步以確認憑證已修正');
      assert.equal(fetchCalls, 2);
    } finally {
      cleanupUser(userId);
    }
  });

  await test('route 層：列表不回傳憑證、未登入回 401、憑證屬個人（不隨帳本共享）', async () => {
    const userId = createUser();
    const viewerId = createUser();
    try {
      const { token } = createLoginSession(userId, 0, {});
      bindCarrier(userId, { barcode: BARCODE_A, verifyCode: VERIFY_CODE });

      const listRequest = new NextRequest('http://localhost/api/imports/invoice-carriers', {
        headers: { Cookie: `authToken=${token}` },
      });
      const listed = await carriersRoute.GET(listRequest);
      assert.equal(listed.status, 200);
      const payload = JSON.stringify(await listed.json());
      assert.equal(payload.includes(VERIFY_CODE), false);
      assert.equal(payload.includes('verify_code'), false);
      assert.match(payload, /\/ABC••••/);

      const anonymous = await carriersRoute.GET(new NextRequest('http://localhost/api/imports/invoice-carriers'));
      assert.equal(anonymous.status, 401);

      // 共享帳本情境：載具憑證屬個人整合（依 lib/ledgerPolicy.ts 與
      // asset_openapi.yaml 的既有慣例），因此即使帶了帳本標頭，寫入仍只落在
      // 「登入者本人」身上，不會被改寫成帳本資料擁有者。
      const { token: viewerToken } = createLoginSession(viewerId, 0, {});
      const ledgerId = `shared:${uid()}`;
      const dataOwnerId = `owner_${uid()}`;
      getDB().run(
        `INSERT INTO financial_ledgers (id, name, owner_user_id, data_owner_id, is_shared, created_at, updated_at)
         VALUES (?,?,?,?,1,?,?)`,
        [ledgerId, 'Shared', viewerId, dataOwnerId, Date.now(), Date.now()],
      );
      getDB().run(
        'INSERT INTO ledger_members (ledger_id, user_id, role, joined_at) VALUES (?,?,?,?)',
        [ledgerId, viewerId, 'viewer', Date.now()],
      );
      const viewerWrite = await carriersRoute.POST(new NextRequest(
        'http://localhost/api/imports/invoice-carriers',
        {
          method: 'POST',
          headers: {
            Cookie: `authToken=${viewerToken}`,
            Origin: 'http://localhost',
            'Content-Type': 'application/json',
            'x-ledger-id': ledgerId,
          },
          body: JSON.stringify({ carrierBarcode: BARCODE_B, verifyCode: VERIFY_CODE }),
        },
      ));
      assert.equal(viewerWrite.status, 201, await viewerWrite.clone().text());
      assert.equal(
        String(queryOne('SELECT user_id FROM invoice_carriers WHERE carrier_barcode = ?', [BARCODE_B])?.user_id),
        viewerId,
        '載具必須落在登入者本人，不得寫入帳本資料擁有者',
      );
      assert.equal(
        Number(queryOne('SELECT COUNT(*) AS cnt FROM invoice_carriers WHERE user_id = ?', [dataOwnerId])?.cnt),
        0,
        '不得以帳本資料擁有者身分建立載具',
      );

      // viewer 帶帳本標頭讀取時，載具清單仍是自己的（憑證不隨帳本共享）
      const viewerList = await carriersRoute.GET(new NextRequest(
        'http://localhost/api/imports/invoice-carriers',
        { headers: { Cookie: `authToken=${viewerToken}`, 'x-ledger-id': ledgerId } },
      ));
      assert.equal(viewerList.status, 200);
      const viewerCarriers = (await viewerList.json()).carriers;
      assert.equal(viewerCarriers.length, 1, 'viewer 只看到自己綁定的載具');
      assert.equal(viewerCarriers[0].carrierBarcode, '/XYZ••••');
      // 擁有者（userId）的載具清單不受 viewer 影響
      const ownerList = await carriersRoute.GET(listRequest);
      assert.equal((await ownerList.json()).carriers.length, 1);
    } finally {
      cleanupUser(userId);
      cleanupUser(viewerId);
    }
  });

  await test('route 層：發票草稿列表狀態篩選與確認入帳建立交易', async () => {
    const userId = createUser();
    try {
      const { token } = createLoginSession(userId, 0, {});
      const carrier = bindCarrier(userId, { barcode: BARCODE_A, verifyCode: VERIFY_CODE });
      await syncCarrier({ userId }, carrier.id, { fetchImpl: stubFetch(SAMPLE_INVOICES), config: CONFIG, env: ENV, rangeDays: 30 });

      const request = (path: string, method = 'GET', body?: unknown) => new NextRequest(
        `http://localhost${path}`,
        {
          method,
          headers: { Cookie: `authToken=${token}`, Origin: 'http://localhost', 'Content-Type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body),
        },
      );

      const listed = await invoicesRoute.GET(request('/api/imports/invoices?status=draft'));
      assert.equal(listed.status, 200);
      const draftList = (await listed.json()).invoices;
      assert.equal(draftList.length, 2);

      const badStatus = await invoicesRoute.GET(request('/api/imports/invoices?status=bogus'));
      assert.equal(badStatus.status, 400);

      // 建立帳戶與子分類以入帳
      const accountId = uid();
      getDB().run(
        'INSERT INTO accounts (id,user_id,name,category,account_type,currency,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',
        [accountId, userId, '現金', 'cash', '現金', 'TWD', Date.now(), Date.now()],
      );
      const parentId = uid();
      const childId = uid();
      getDB().run(
        'INSERT INTO categories (id,user_id,name,type,parent_id) VALUES (?,?,?,?,?)',
        [parentId, userId, '餐飲', 'expense', ''],
      );
      getDB().run(
        'INSERT INTO categories (id,user_id,name,type,parent_id) VALUES (?,?,?,?,?)',
        [childId, userId, '午餐', 'expense', parentId],
      );

      const target = draftList.find((d: { invoiceNumber: string }) => d.invoiceNumber === 'AB12345678');
      const confirmed = await invoiceItemRoute.POST(
        request(`/api/imports/invoices/${target.id}`, 'POST', {
          accountId, categoryId: childId, note: '使用者備註',
        }),
        { params: Promise.resolve({ id: target.id }) },
      );
      assert.equal(confirmed.status, 201, await confirmed.clone().text());
      const confirmedBody = await confirmed.json();
      assert.equal(confirmedBody.invoice.status, 'imported');
      assert.ok(confirmedBody.transactionId);

      const tx = queryOne('SELECT * FROM transactions WHERE id = ?', [confirmedBody.transactionId]);
      assert.equal(Number(tx?.amount), 350, '發票金額應正確帶入交易');
      assert.equal(String(tx?.date), '2026-10-01', '發票日期應正確帶入交易');
      assert.equal(String(tx?.type), 'expense');
      assert.match(String(tx?.note), /測試超商/);
      assert.match(String(tx?.note), /AB12345678/);
      assert.match(String(tx?.note), /使用者備註/);
      assert.equal(String(tx?.user_id), userId);

      // 重複確認：冪等（不產生第二筆交易）
      const again = await invoiceItemRoute.POST(
        request(`/api/imports/invoices/${target.id}`, 'POST', { accountId, categoryId: childId }),
        { params: Promise.resolve({ id: target.id }) },
      );
      assert.equal(again.status, 409, '已入帳的發票再次確認應回 409');
      assert.equal(
        Number(queryOne("SELECT COUNT(*) AS cnt FROM transactions WHERE user_id = ? AND client_ref != ''", [userId])?.cnt),
        1,
        '同一發票不得產生第二筆交易',
      );

      // 略過另一張草稿
      const other = draftList.find((d: { invoiceNumber: string }) => d.invoiceNumber === 'CD87654321');
      const dismissed = await invoiceItemRoute.DELETE(
        request(`/api/imports/invoices/${other.id}`, 'DELETE'),
        { params: Promise.resolve({ id: other.id }) },
      );
      assert.equal(dismissed.status, 200);
      assert.equal((await dismissed.json()).invoice.status, 'dismissed');

      // 略過後不可入帳
      const importDismissed = await invoiceItemRoute.POST(
        request(`/api/imports/invoices/${other.id}`, 'POST', { accountId, categoryId: childId }),
        { params: Promise.resolve({ id: other.id }) },
      );
      assert.equal(importDismissed.status, 409);

      // 不屬於本人的帳戶／分類被拒
      const foreignAccount = uid();
      getDB().run(
        'INSERT INTO accounts (id,user_id,name,category,account_type,currency,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)',
        [foreignAccount, `other_${uid()}`, '他人帳戶', 'cash', '現金', 'TWD', Date.now(), Date.now()],
      );
      const thirdUserId = createUser();
      try {
        const { token: thirdToken } = createLoginSession(thirdUserId, 0, {});
        const carrier3 = bindCarrier(thirdUserId, { barcode: BARCODE_B, verifyCode: VERIFY_CODE });
        await syncCarrier({ userId: thirdUserId }, carrier3.id, {
          fetchImpl: stubFetch([SAMPLE_INVOICES[0]]), config: CONFIG, env: ENV, rangeDays: 30,
        });
        const thirdDraft = listInvoices(thirdUserId, { status: 'draft' })[0];
        const crossAccount = await invoiceItemRoute.POST(
          new NextRequest(`http://localhost/api/imports/invoices/${thirdDraft.id}`, {
            method: 'POST',
            headers: { Cookie: `authToken=${thirdToken}`, Origin: 'http://localhost', 'Content-Type': 'application/json' },
            body: JSON.stringify({ accountId: accountId, categoryId: childId }),
          }),
          { params: Promise.resolve({ id: thirdDraft.id }) },
        );
        assert.equal(crossAccount.status, 400, '不得使用他人帳戶／分類');
      } finally {
        cleanupUser(thirdUserId);
      }
    } finally {
      cleanupUser(userId);
    }
  });

  after(async () => { await getDB().close(); });
}
