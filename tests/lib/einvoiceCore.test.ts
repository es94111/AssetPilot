// tests/lib/einvoiceCore.test.ts — 雲端發票載具整合的純邏輯測試（issue #253）
//
// 零相依（無 DB、無 Next.js、無外部 API），可直接以 Node 執行：
//   node tests/lib/einvoiceCore.test.ts
// 任一斷言失敗即 process.exit(1)。
//
// 涵蓋：載具條碼驗證與遮罩、驗證碼規則、發票欄位正規化（含髒資料丟棄）、
// 發票號碼去重鍵、同步退避決策、供應商設定解析（含優雅降級）。

const assert = require('node:assert/strict');
const core = require('../../lib/einvoiceCore.ts') as typeof import('../../lib/einvoiceCore');

let pass = 0;
let fail = 0;
function test(name: string, fn: () => void): void {
  try { fn(); console.log('  ✓', name); pass++; }
  catch (e) { console.error('  ✗', name); console.error('    ', e instanceof Error ? e.message : String(e)); fail++; }
}

console.log('手機條碼載具驗證：');
test('合法條碼（斜線 + 7 碼大寫英數字）通過', () => {
  assert.equal(core.isValidCarrierBarcode('/ABC1234'), true);
  assert.equal(core.isValidCarrierBarcode('/1234567'), true);
  assert.equal(core.isValidCarrierBarcode('/ABCDEFG'), true);
});

test('小寫自動轉大寫後仍視為合法（使用者常直接複製）', () => {
  assert.equal(core.normalizeCarrierBarcode(' /abc1234 '), '/ABC1234');
  assert.equal(core.isValidCarrierBarcode('/abc1234'), true);
});

test('全形空白與零寬字元會被去除', () => {
  assert.equal(core.normalizeCarrierBarcode('/ABC\u30001234'), '/ABC1234');
});

test('不合法條碼一律拒絕', () => {
  for (const bad of ['', 'ABC1234', '/ABC123', '/ABC12345', '/ABC-123', '/ABC 123', null, undefined, 42]) {
    assert.equal(core.isValidCarrierBarcode(bad), false, `應拒絕：${String(bad)}`);
  }
});

test('未綁定時遮罩回傳空字串', () => {
  assert.equal(core.maskCarrierBarcode(''), '');
  assert.equal(core.maskCarrierBarcode(null), '');
});

test('遮罩只保留前 4 碼，其餘以 • 取代', () => {
  assert.equal(core.maskCarrierBarcode('/ABC1234'), '/ABC••••');
  assert.equal(core.maskCarrierBarcode('/12'), '•••');
});

test('遮罩後的字串不含原始尾碼（避免由 API 或日誌還原完整條碼）', () => {
  const masked = core.maskCarrierBarcode('/ABC1234');
  assert.equal(masked.includes('1234'), false);
});

console.log('驗證碼規則：');
test('6~20 碼英數字通過', () => {
  assert.equal(core.isValidVerifyCode('abc123'), true);
  assert.equal(core.isValidVerifyCode('A1B2C3D4E5F6G7H8I9J0'), true);
});

test('過短／過長／含符號一律拒絕', () => {
  for (const bad of ['', 'abc12', 'a'.repeat(21), 'abc 123', 'abc-123', null]) {
    assert.equal(core.isValidVerifyCode(bad), false, `應拒絕：${String(bad)}`);
  }
});

test('驗證碼正規化只去除前後空白（中間空白不合法）', () => {
  assert.equal(core.normalizeVerifyCode('  abc123  '), 'abc123');
  assert.equal(core.isValidVerifyCode('abc 123'), false);
});

console.log('發票日期與時間正規化：');
test('YYYY-MM-DD 與 YYYYMMDD 皆可解析', () => {
  assert.equal(core.normalizeInvoiceDate('2026-10-07'), '2026-10-07');
  assert.equal(core.normalizeInvoiceDate('20261007'), '2026-10-07');
});

test('不存在的日曆日期被拒絕（含閏年）', () => {
  assert.equal(core.normalizeInvoiceDate('2026-02-30'), '');
  assert.equal(core.normalizeInvoiceDate('2026-13-01'), '');
  assert.equal(core.normalizeInvoiceDate('2025-02-29'), '');
  // 2024 是閏年
  assert.equal(core.normalizeInvoiceDate('2024-02-29'), '2024-02-29');
});

test('無法解析的日期回空字串', () => {
  assert.equal(core.normalizeInvoiceDate(''), '');
  assert.equal(core.normalizeInvoiceDate('26/10/07'), '');
});

test('時間支援 HH:MM 與 HH:MM:SS，越界回空字串', () => {
  assert.equal(core.normalizeInvoiceTime('12:34:56'), '12:34:56');
  assert.equal(core.normalizeInvoiceTime('12:34'), '12:34:00');
  assert.equal(core.normalizeInvoiceTime('1234'), '12:34:00');
  assert.equal(core.normalizeInvoiceTime('25:00:00'), '');
  assert.equal(core.normalizeInvoiceTime('12:60:00'), '');
  assert.equal(core.normalizeInvoiceTime(''), '');
});

console.log('發票號碼：');
test('2 碼英文 + 8 碼數字視為合法', () => {
  assert.equal(core.isValidInvoiceNumber('AB12345678'), true);
  assert.equal(core.normalizeInvoiceNumber(' ab12345678 '), 'AB12345678');
});

test('格式不符一律拒絕', () => {
  for (const bad of ['A12345678', 'ABC12345678', 'AB1234567', 'AB123456789', 'AB-2345678', '']) {
    assert.equal(core.isValidInvoiceNumber(bad), false, `應拒絕：${bad}`);
  }
});

console.log('發票欄位對應（normalizeInvoice）：');
test('完整欄位正確對應到發票號碼／店家／金額／日期', () => {
  const { invoice, reason } = core.normalizeInvoice({
    invoiceNumber: 'AB12345678',
    invoiceDate: '2026-10-07',
    invoiceTime: '12:34:56',
    sellerName: '測試超商',
    amount: 350,
  });
  assert.equal(reason, '');
  assert.deepEqual(invoice, {
    invoiceNumber: 'AB12345678',
    invoiceDate: '2026-10-07',
    invoiceTime: '12:34:56',
    sellerName: '測試超商',
    amount: 350,
  });
});

test('支援財政部常見的 snake_case 欄位名', () => {
  const { invoice } = core.normalizeInvoice({
    invoice_number: 'AB12345678',
    invoice_date: '20261007',
    invoice_time: '1234',
    seller_name: '店家',
    total_amount: 100,
  });
  assert.equal(invoice?.invoiceDate, '2026-10-07');
  assert.equal(invoice?.invoiceTime, '12:34:00');
  assert.equal(invoice?.sellerName, '店家');
  assert.equal(invoice?.amount, 100);
});

test('缺少店家時仍可匯入（店家常為空）', () => {
  const { invoice } = core.normalizeInvoice({
    invoiceNumber: 'AB12345678', invoiceDate: '2026-10-07', amount: 10,
  });
  assert.equal(invoice?.sellerName, '');
});

test('發票號碼／日期／金額任一無效即丟棄並附原因', () => {
  assert.equal(core.normalizeInvoice({ invoiceDate: '2026-10-07', amount: 10 }).reason, '發票號碼格式無效');
  assert.equal(core.normalizeInvoice({ invoiceNumber: 'AB12345678', date: 'bad', amount: 10 }).reason, '發票日期格式無效');
  assert.equal(core.normalizeInvoice({ invoiceNumber: 'AB12345678', invoiceDate: '2026-10-07', amount: 0 }).reason, '發票金額無效');
  assert.equal(core.normalizeInvoice({ invoiceNumber: 'AB12345678', invoiceDate: '2026-10-07', amount: 'NaN' }).reason, '發票金額無效');
  assert.equal(core.normalizeInvoice({ invoiceNumber: 'AB12345678', invoiceDate: '2026-10-07' }).reason, '發票金額無效');
});

test('金額取整數元（發票為整數）', () => {
  const { invoice } = core.normalizeInvoice({
    invoiceNumber: 'AB12345678', invoiceDate: '2026-10-07', amount: 99.6,
  });
  assert.equal(invoice?.amount, 100);
});

test('店家名稱過長會截斷（避免超長字串落地）', () => {
  const { invoice } = core.normalizeInvoice({
    invoiceNumber: 'AB12345678', invoiceDate: '2026-10-07', amount: 10, sellerName: 'x'.repeat(500),
  });
  assert.equal(invoice?.sellerName.length, 100);
});

console.log('批次正規化：');
test('混合有效／無效資料時只保留有效筆數並統計略過', () => {
  const batch = core.normalizeInvoiceBatch([
    { invoiceNumber: 'AB12345678', invoiceDate: '2026-10-07', amount: 100 },
    { invoiceNumber: 'bad', invoiceDate: '2026-10-07', amount: 100 },
    { invoiceNumber: 'CD12345678', invoiceDate: '2026-10-08', amount: 200 },
  ]);
  assert.equal(batch.invoices.length, 2);
  assert.equal(batch.skipped, 1);
  assert.equal(batch.skipReasons.length, 1);
});

test('非陣列輸入回傳空結果（不拋錯）', () => {
  for (const bad of [null, undefined, {}, 'x', 42]) {
    const batch = core.normalizeInvoiceBatch(bad);
    assert.equal(batch.invoices.length, 0);
    assert.equal(batch.skipped, 0);
  }
});

console.log('去重鍵：');
test('同一使用者同一發票號碼產生相同鍵', () => {
  assert.equal(
    core.invoiceDedupeKey('u1', 'AB12345678'),
    core.invoiceDedupeKey('u1', 'ab12345678'),
  );
});

test('不同使用者或不同發票號碼產生不同鍵', () => {
  assert.notEqual(
    core.invoiceDedupeKey('u1', 'AB12345678'),
    core.invoiceDedupeKey('u2', 'AB12345678'),
  );
  assert.notEqual(
    core.invoiceDedupeKey('u1', 'AB12345678'),
    core.invoiceDedupeKey('u1', 'CD12345678'),
  );
});

console.log('同步退避（不自動重試風暴）：');
test('無失敗時不退避', () => {
  assert.equal(core.syncBackoffMs(0), 0);
  assert.equal(core.isSyncBackedOff({ status: 'success', consecutiveFailures: 0, nextRetryAt: 0 }), false);
});

test('指數退避：30 秒起、上限 1 小時', () => {
  assert.equal(core.syncBackoffMs(1), 30_000);
  assert.equal(core.syncBackoffMs(2), 60_000);
  assert.equal(core.syncBackoffMs(3), 120_000);
  assert.equal(core.syncBackoffMs(20), core.SYNC_BACKOFF_MAX_MS);
  assert.equal(core.SYNC_BACKOFF_MAX_MS, 60 * 60 * 1000);
});

test('退避期間 isSyncBackedOff 為真，逾時後為假', () => {
  const now = 1_000_000;
  assert.equal(core.isSyncBackedOff({ status: 'failed', consecutiveFailures: 1, nextRetryAt: now + 1, now }), true);
  assert.equal(core.isSyncBackedOff({ status: 'failed', consecutiveFailures: 1, nextRetryAt: now, now }), false);
  assert.equal(core.isSyncBackedOff({ status: 'failed', consecutiveFailures: 1, nextRetryAt: now - 1, now }), false);
});

test('retryAfterSeconds 取整並不小於 0', () => {
  const now = 1_000_000;
  assert.equal(core.syncRetryAfterSeconds({ status: 'failed', consecutiveFailures: 1, nextRetryAt: now + 1_500, now }), 2);
  assert.equal(core.syncRetryAfterSeconds({ status: 'failed', consecutiveFailures: 1, nextRetryAt: 0, now }), 0);
  assert.equal(core.syncRetryAfterSeconds({ status: 'failed', consecutiveFailures: 1, nextRetryAt: now - 10_000, now }), 0);
});

test('字串型別的 DB 值也能正確判斷（PostgreSQL 回傳字串）', () => {
  const now = 1_000_000;
  assert.equal(core.isSyncBackedOff({ status: 'failed', consecutiveFailures: '2', nextRetryAt: String(now + 5), now }), true);
});

test('失敗累加 consecutive_failures 並設定退避', () => {
  const now = 1_000_000;
  assert.deepEqual(core.nextSyncState(0, 'failed', now), { consecutiveFailures: 1, nextRetryAt: now + 30_000 });
  assert.deepEqual(core.nextSyncState(2, 'failed', now), { consecutiveFailures: 3, nextRetryAt: now + 120_000 });
});

test('成功與部分成功都重置退避（partial 不再阻擋使用者）', () => {
  for (const status of ['success', 'partial'] as const) {
    assert.deepEqual(core.nextSyncState(5, status), { consecutiveFailures: 0, nextRetryAt: 0 });
  }
});

console.log('供應商設定與錯誤分類：');
test('三個環境變數缺一即視為未設定（功能停用）', () => {
  assert.equal(core.readInvoiceProviderConfig({}).configured, false);
  assert.equal(core.readInvoiceProviderConfig({ EINVOICE_API_ENDPOINT: 'https://example.test/api' }).configured, false);
  assert.equal(core.readInvoiceProviderConfig({
    EINVOICE_API_ENDPOINT: 'https://example.test/api',
    EINVOICE_API_APP_ID: 'id',
  }).configured, false);
  assert.equal(core.readInvoiceProviderConfig({
    EINVOICE_API_ENDPOINT: 'https://example.test/api',
    EINVOICE_API_APP_ID: 'id',
    EINVOICE_API_KEY: '',
  }).configured, false);
});

test('非 HTTPS 端點視為未設定（憑證不得經明文傳輸）', () => {
  assert.equal(core.readInvoiceProviderConfig({
    EINVOICE_API_ENDPOINT: 'http://example.test/api',
    EINVOICE_API_APP_ID: 'id',
    EINVOICE_API_KEY: 'key',
  }).configured, false);
});

test('完整設定時 configured 為真並原樣帶出', () => {
  const config = core.readInvoiceProviderConfig({
    EINVOICE_API_ENDPOINT: 'https://example.test/api',
    EINVOICE_API_APP_ID: 'id',
    EINVOICE_API_KEY: 'key',
  });
  assert.equal(config.configured, true);
  assert.equal(config.endpoint, 'https://example.test/api');
  assert.equal(config.appId, 'id');
  assert.equal(config.apiKey, 'key');
});

test('408／429 與 5xx 視為可重試，其餘 4xx 為永久失敗', () => {
  assert.equal(core.isRetryableProviderStatus(408), true);
  assert.equal(core.isRetryableProviderStatus(429), true);
  assert.equal(core.isRetryableProviderStatus(500), true);
  assert.equal(core.isRetryableProviderStatus(503), true);
  assert.equal(core.isRetryableProviderStatus(400), false);
  assert.equal(core.isRetryableProviderStatus(401), false);
  assert.equal(core.isRetryableProviderStatus(403), false);
  assert.equal(core.isRetryableProviderStatus(404), false);
  assert.equal(core.isRetryableProviderStatus(0), false);
});

test('錯誤訊息不含憑證且針對狀態碼給出可行動說明', () => {
  assert.match(core.providerErrorMessage(401), /重新綁定/);
  assert.match(core.providerErrorMessage(403), /重新綁定/);
  assert.match(core.providerErrorMessage(408), /逾時/);
  assert.match(core.providerErrorMessage(429), /稍後再試/);
  assert.match(core.providerErrorMessage(503), /暫時無法使用/);
  assert.match(core.providerErrorMessage(418), /HTTP 418/);
  assert.match(core.providerErrorMessage(0), /無法連線/);
});

console.log(`\n結果：${pass} pass / ${fail} fail`);
if (fail > 0) process.exit(1);
