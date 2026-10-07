// tests/lib/einvoiceProvider.test.ts — 財政部電子發票用戶端測試（issue #253）
//
// 全數以 stub fetch 覆蓋，**絕不連線真實財政部 API**（issue 硬性要求）。
// 驗證：未設定時的優雅降級、逾時、HTTP 錯誤分類、回應格式異常、
// 回應過大中止、以及成功時逐欄對應（發票號碼／店家／金額／日期）。
//
// 執行：node --experimental-transform-types --import ./tests/setup/register.mjs tests/lib/einvoiceProvider.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchCarrierInvoices, EINVOICE_MAX_RESPONSE_BYTES } from '../../lib/einvoiceProvider.ts';
import { readInvoiceProviderConfig } from '../../lib/einvoiceCore.ts';

const CONFIGURED = readInvoiceProviderConfig({
  EINVOICE_API_ENDPOINT: 'https://einvoice.example.test/query',
  EINVOICE_API_APP_ID: 'test-app-id',
  EINVOICE_API_KEY: 'test-api-key',
});
const UNCONFIGURED = readInvoiceProviderConfig({});

const BASE_INPUT = {
  carrierBarcode: '/ABC1234',
  verifyCode: 'verifycode',
  startDate: '2026-09-08',
  endDate: '2026-10-07',
};

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('未設定供應商時優雅降級（不拋錯、不呼叫網路）', async () => {
  let called = false;
  const result = await fetchCarrierInvoices({
    config: UNCONFIGURED,
    ...BASE_INPUT,
    fetchImpl: (async () => { called = true; return jsonResponse([]); }) as unknown as typeof fetch,
  });
  assert.equal(called, false, '不得在未設定時發出請求');
  assert.equal(result.status, 'skipped');
  assert.equal(result.retryable, false);
  assert.deepEqual(result.invoices, []);
  assert.match(result.errorMessage, /EINVOICE_API_ENDPOINT/);
});

test('成功回應逐欄對應發票號碼／店家／金額／日期', async () => {
  const result = await fetchCarrierInvoices({
    config: CONFIGURED,
    ...BASE_INPUT,
    fetchImpl: (async () => jsonResponse({
      data: [{
        invoiceNumber: 'AB12345678',
        invoiceDate: '2026-10-07',
        invoiceTime: '12:34:56',
        sellerName: '測試超商',
        amount: 350,
      }],
    })) as unknown as typeof fetch,
  });
  assert.equal(result.status, 'success');
  assert.equal(result.invoices.length, 1);
  assert.deepEqual(result.invoices[0], {
    invoiceNumber: 'AB12345678',
    invoiceDate: '2026-10-07',
    invoiceTime: '12:34:56',
    sellerName: '測試超商',
    amount: 350,
  });
  assert.equal(result.skipped, 0);
  assert.equal(result.errorMessage, '');
  assert.equal(result.retryable, false);
});

test('頂層即陣列的回應也能解析', async () => {
  const result = await fetchCarrierInvoices({
    config: CONFIGURED,
    ...BASE_INPUT,
    fetchImpl: (async () => jsonResponse([
      { invoiceNumber: 'CD12345678', invoiceDate: '20261007', amount: 42 },
    ])) as unknown as typeof fetch,
  });
  assert.equal(result.invoices.length, 1);
  assert.equal(result.invoices[0].invoiceNumber, 'CD12345678');
});

test('預設拒絕 HTTP redirect，避免將供應商憑證轉送到其他主機', async () => {
  let redirectMode = '';
  const result = await fetchCarrierInvoices({
    config: CONFIGURED,
    ...BASE_INPUT,
    fetchImpl: (async (_url: string, init: RequestInit) => {
      redirectMode = String(init.redirect || '');
      throw new TypeError('redirect rejected');
    }) as unknown as typeof fetch,
  });
  assert.equal(redirectMode, 'error');
  assert.equal(result.status, 'failed');
});

test('憑證以標頭傳送且不出現在查詢字串或錯誤訊息中', async () => {
  let seenUrl = '';
  let seenHeaders: Headers | undefined;
  await fetchCarrierInvoices({
    config: CONFIGURED,
    ...BASE_INPUT,
    fetchImpl: (async (url: string, init: RequestInit) => {
      seenUrl = String(url);
      seenHeaders = new Headers(init.headers);
      return jsonResponse([]);
    }) as unknown as typeof fetch,
  });
  assert.equal(seenUrl, CONFIGURED.endpoint);
  assert.equal(seenUrl.includes('test-api-key'), false);
  assert.equal(seenUrl.includes('verifycode'), false);
  assert.equal(seenHeaders?.get('X-Api-Key'), 'test-api-key');
  assert.equal(seenHeaders?.get('X-App-Id'), 'test-app-id');
});

test('欄位不完整的發票會被略過並記錄原因（不讓整批失敗）', async () => {
  const result = await fetchCarrierInvoices({
    config: CONFIGURED,
    ...BASE_INPUT,
    fetchImpl: (async () => jsonResponse([
      { invoiceNumber: 'AB12345678', invoiceDate: '2026-10-07', amount: 100 },
      { invoiceNumber: 'not-an-invoice', invoiceDate: '2026-10-07', amount: 100 },
    ])) as unknown as typeof fetch,
  });
  assert.equal(result.status, 'success');
  assert.equal(result.invoices.length, 1);
  assert.equal(result.skipped, 1);
  assert.match(result.errorMessage, /1 筆發票欄位不完整/);
});

test('HTTP 401/403 視為憑證失效且不可重試', async () => {
  for (const status of [401, 403]) {
    const result = await fetchCarrierInvoices({
      config: CONFIGURED,
      ...BASE_INPUT,
      fetchImpl: (async () => jsonResponse({ error: 'unauthorized' }, status)) as unknown as typeof fetch,
    });
    assert.equal(result.status, 'failed');
    assert.equal(result.httpStatus, status);
    assert.equal(result.retryable, false);
    assert.match(result.errorMessage, /重新綁定/);
  }
});

test('HTTP 408／429 與 5xx 標記為可重試但不在用戶端自動重試', async () => {
  for (const status of [408, 429, 500, 503]) {
    const result = await fetchCarrierInvoices({
      config: CONFIGURED,
      ...BASE_INPUT,
      fetchImpl: (async () => jsonResponse({}, status)) as unknown as typeof fetch,
    });
    assert.equal(result.status, 'failed');
    assert.equal(result.retryable, true);
  }
});

test('連線失敗與逾時皆回傳結構化失敗結果（不拋錯）', async () => {
  const networkError = await fetchCarrierInvoices({
    config: CONFIGURED,
    ...BASE_INPUT,
    fetchImpl: (async () => { throw new TypeError('fetch failed'); }) as unknown as typeof fetch,
  });
  assert.equal(networkError.status, 'failed');
  assert.equal(networkError.httpStatus, 0);
  assert.equal(networkError.retryable, true);

  const abortError = await fetchCarrierInvoices({
    config: CONFIGURED,
    ...BASE_INPUT,
    fetchImpl: (async () => {
      const error = new Error('aborted');
      error.name = 'AbortError';
      throw error;
    }) as unknown as typeof fetch,
  });
  assert.equal(abortError.status, 'failed');
  assert.match(abortError.errorMessage, /逾時/);
});

test('回應非 JSON 時視為格式異常且不可重試', async () => {
  const result = await fetchCarrierInvoices({
    config: CONFIGURED,
    ...BASE_INPUT,
    fetchImpl: (async () => new Response('<html>maintenance</html>', { status: 200 })) as unknown as typeof fetch,
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.retryable, false);
  assert.match(result.errorMessage, /無法解析/);
});

test('HTTP 200 的未知 JSON 格式不可誤判為空發票成功', async () => {
  const result = await fetchCarrierInvoices({
    config: CONFIGURED,
    ...BASE_INPUT,
    fetchImpl: (async () => jsonResponse({ error: 'temporarily unavailable' })) as unknown as typeof fetch,
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.httpStatus, 200);
  assert.equal(result.retryable, false);
  assert.match(result.errorMessage, /格式無法解析/);
});

test('串流回應超過大小上限時立即取消讀取', async () => {
  let chunks = 0;
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      chunks += 1;
      controller.enqueue(new Uint8Array(EINVOICE_MAX_RESPONSE_BYTES / 2));
    },
    cancel() {
      cancelled = true;
    },
  });
  const result = await fetchCarrierInvoices({
    config: CONFIGURED,
    ...BASE_INPUT,
    fetchImpl: (async () => new Response(body, { status: 200 })) as unknown as typeof fetch,
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.retryable, false);
  assert.match(result.errorMessage, /過大/);
  assert.equal(cancelled, true);
  assert.ok(chunks > 0);
});

test('逾時以 AbortController 觸發（使用可注入的短逾時）', async () => {
  const result = await fetchCarrierInvoices({
    config: CONFIGURED,
    ...BASE_INPUT,
    timeoutMs: 20,
    fetchImpl: ((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        reject(error);
      });
    })) as unknown as typeof fetch,
  });
  assert.equal(result.status, 'failed');
  assert.match(result.errorMessage, /逾時/);
});

test('回應 body 讀取也受逾時限制', async () => {
  const result = await fetchCarrierInvoices({
    config: CONFIGURED,
    ...BASE_INPUT,
    timeoutMs: 20,
    fetchImpl: ((_url: string, init: RequestInit) => Promise.resolve(new Response(
      new ReadableStream<Uint8Array>({
        start(controller) {
          init.signal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            controller.error(error);
          }, { once: true });
        },
      }),
      { status: 200 },
    ))) as unknown as typeof fetch,
  });
  assert.equal(result.status, 'failed');
  assert.equal(result.retryable, true);
  assert.match(result.errorMessage, /逾時/);
});

test('provider 欄位帶出供應商主機名稱（供稽核辨識來源）', async () => {
  const result = await fetchCarrierInvoices({
    config: CONFIGURED,
    ...BASE_INPUT,
    fetchImpl: (async () => jsonResponse([])) as unknown as typeof fetch,
  });
  assert.equal(result.provider, 'einvoice.example.test');
});
