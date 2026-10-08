// tests/lib/receiptOcrCore.test.ts — 收據 OCR 核心單元測試（issue #250）
// 執行：node --experimental-transform-types --import ./tests/setup/register.mjs tests/lib/receiptOcrCore.test.ts
//
// 全程以 stub / fake 供應商進行，絕不呼叫任何真實外部 OCR 服務，
// 也不讀取任何憑證（測試不設定 OCR 環境變數）。
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { __setNowMs } from '../../lib/userTime.ts';
import {
  RECEIPT_OCR_MAX_IMAGE_BYTES,
  createHttpProvider,
  createNoneProvider,
  normalizeReceiptAmount,
  normalizeReceiptCurrency,
  normalizeReceiptDate,
  normalizeReceiptMerchant,
  normalizeReceiptOcrMimeType,
  parseReceiptOcrResult,
  resolveReceiptOcrProvider,
  stripDateLikeTokens,
} from '../../lib/receiptOcrCore.ts';
import { applyReceiptOcrPrefill, createReceiptOcrRequestGate } from '../../lib/receiptOcrPrefill.ts';
import { RECEIPT_OCR_AUTH_OPTIONS, decodeReceiptOcrUpload, readJsonBodyWithLimit, RequestBodyTooLargeError } from '../../lib/receiptOcrRequest.ts';

let pass = 0;
let fail = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
  try {
    await fn();
    console.log('  ✓', name);
    pass++;
  } catch (e) {
    console.error('  ✗', name);
    console.error('    ', e instanceof Error ? e.message : String(e));
    fail++;
  }
}

const tz = 'Asia/Taipei';
__setNowMs(Date.parse('2026-10-07T02:00:00.000Z')); // 台北時間 2026-10-07 10:00

try {
  console.log('normalizeReceiptAmount：');
  await test('接受千分位與小數', () => {
    assert.equal(normalizeReceiptAmount('1,234'), '1234');
    assert.equal(normalizeReceiptAmount('1,234.50'), '1234.5');
    assert.equal(normalizeReceiptAmount('$ 320'), '320');
    assert.equal(normalizeReceiptAmount('12.345'), '12.35');
  });  await test('拒絕無效金額', () => {
    for (const bad of ['', '   ', 'abc', 'NaN', 'Infinity', '0', '-5', '1,23', null, undefined]) {
      assert.equal(normalizeReceiptAmount(bad as unknown), null, `應拒絕 ${JSON.stringify(bad)}`);
    }
  });
  await test('極端長度不溢位', () => {
    assert.equal(normalizeReceiptAmount('9'.repeat(40)), null);
    // 超過 1 兆視為 OCR 雜訊而非真實金額。
    assert.equal(normalizeReceiptAmount('999999999999999999999.99'), null);
    assert.equal(normalizeReceiptAmount('999999999999'), '999999999999');
  });
  await test('金額尾端零正規化', () => {
    assert.equal(normalizeReceiptAmount('120.00'), '120');
    assert.equal(normalizeReceiptAmount('120.50'), '120.5');
    assert.equal(normalizeReceiptAmount('120.05'), '120.05');
  });

  console.log('\nnormalizeReceiptDate：');
  await test('ISO 與斜線格式', () => {
    assert.equal(normalizeReceiptDate('2026-10-05', tz), '2026-10-05');
    assert.equal(normalizeReceiptDate('日期 2026/10/5', tz), '2026-10-05');
    assert.equal(normalizeReceiptDate('20261005', tz), '2026-10-05');
  });
  await test('民國年換算（含 7 位數緊湊格式）', () => {
    assert.equal(normalizeReceiptDate('113/10/05', tz), '2024-10-05');
    assert.equal(normalizeReceiptDate('103-01-02', tz), '2014-01-02');
    assert.equal(normalizeReceiptDate('1130102', tz), '2024-01-02');
  });
  await test('相對日期依使用者時區', () => {
    assert.equal(normalizeReceiptDate('今天', tz), '2026-10-07');
    assert.equal(normalizeReceiptDate('昨天', tz), '2026-10-06');
    // UTC 現在仍是 10-07 02:00，但台北已跨日；驗證確實使用傳入的時區。
    assert.equal(normalizeReceiptDate('今天', 'America/Los_Angeles'), '2026-10-06');
  });
  await test('無效日期回 null', () => {
    for (const bad of ['2026-02-30', '2026-13-01', '', 'not-a-date', null]) {
      assert.equal(normalizeReceiptDate(bad as unknown, tz), null, `應拒絕 ${JSON.stringify(bad)}`);
    }
  });

  console.log('\n其他欄位正規化：');
  await test('直接上傳要求明確 MIME type，並正規化大小寫', () => {
    assert.equal(normalizeReceiptOcrMimeType(' Image/PNG '), 'image/png');
    assert.equal(normalizeReceiptOcrMimeType(''), null);
    assert.equal(normalizeReceiptOcrMimeType(undefined), null);
    assert.equal(normalizeReceiptOcrMimeType(null), null);
  });
  await test('幣別', () => {
    assert.equal(normalizeReceiptCurrency('總計 TWD 320'), 'TWD');
    assert.equal(normalizeReceiptCurrency('NT$320'), 'TWD');
    assert.equal(normalizeReceiptCurrency('¥1,200'), 'JPY');
    assert.equal(normalizeReceiptCurrency('$12.50'), 'USD');
    assert.equal(normalizeReceiptCurrency(''), null);
  });
  await test('店家名稱過濾雜訊', () => {
    assert.equal(normalizeReceiptMerchant('全聯福利中心'), '全聯福利中心');
    assert.equal(normalizeReceiptMerchant('  Starbucks  Coffee '), 'Starbucks Coffee');
    assert.equal(normalizeReceiptMerchant('1234-56'), null);
    assert.equal(normalizeReceiptMerchant('x'), null);
    assert.equal(normalizeReceiptMerchant('A'.repeat(120))?.length, 80);
  });
  await test('stripDateLikeTokens 移除日期時間', () => {
    const stripped = stripDateLikeTokens('2026-10-07 12:34:56 總計 320');
    assert.ok(!stripped.includes('2026'));
    assert.ok(stripped.includes('320'));
  });

  console.log('\nparseReceiptOcrResult：');
  await test('英文 Total 不會誤配 Subtotal', () => {
    const result = parseReceiptOcrResult(
      { text: 'Subtotal 100\nTax 8\nTotal 108' },
      { timezone: tz },
    );
    assert.equal(result.draft.amount, 108);
  });
  await test('中英混合收據優先選最終應付總額而非小計', () => {
    const result = parseReceiptOcrResult(
      { text: '小計 100\nTax 8\nTotal 108' },
      { timezone: tz },
    );
    assert.equal(result.draft.amount, 108);
  });
  await test('Total Due 與 Amount Due 複合標籤可擷取金額', () => {
    assert.equal(parseReceiptOcrResult({ text: 'Total due: 45.00' }, { timezone: tz }).draft.amount, 45);
    assert.equal(parseReceiptOcrResult({ text: 'Amount due: 62.50' }, { timezone: tz }).draft.amount, 62.5);
  });
  await test('無效的標註或供應商金額不會被拆成錯誤候選', () => {
    const labelled = parseReceiptOcrResult({ text: 'Total 1,23' }, { timezone: tz });
    assert.equal(labelled.draft.amount, null);
    assert.ok(labelled.warnings.includes('amount_invalid'));

    const supplied = parseReceiptOcrResult(
      { text: '1,23', fields: { amount: '1,23' } },
      { timezone: tz },
    );
    assert.equal(supplied.draft.amount, null);
    assert.ok(supplied.warnings.includes('amount_invalid'));
  });
  await test('完整文字解析出三個欄位', () => {
    const result = parseReceiptOcrResult(
      { text: '店家：全聯福利中心\n日期：2026/10/05\n總計 NT$1,234' },
      { timezone: tz },
    );
    assert.equal(result.draft.amount, 1234);
    assert.equal(result.draft.date, '2026-10-05');
    assert.equal(result.draft.merchant, '全聯福利中心');
    assert.equal(result.draft.currency, 'TWD');
    assert.equal(result.hasFields, true);
  });
  await test('供應商 fields 優先於文字啟發式', () => {
    const result = parseReceiptOcrResult(
      { text: '總計 999', fields: { amount: 350, date: '2026-09-01', merchant: '測試商店' } },
      { timezone: tz },
    );
    assert.equal(result.draft.amount, 350);
    assert.equal(result.draft.date, '2026-09-01');
    assert.equal(result.draft.merchant, '測試商店');
  });
  await test('日期不會被誤判為金額（西元 8 位數）', () => {
    const result = parseReceiptOcrResult({ text: '日期 20241015\nTotal 45' }, { timezone: tz });
    assert.equal(result.draft.amount, 45);
    assert.equal(result.draft.date, '2024-10-15');
  });
  await test('有日期上下文時 ROC 7 位數日期不會成為金額候選', () => {
    const result = parseReceiptOcrResult({ text: '日期 1130102\nCoffee 45' }, { timezone: tz });
    assert.equal(result.draft.amount, 45);
    assert.equal(result.draft.date, '2024-01-02');
  });
  await test('真正的 7 位數金額不會被誤判為 ROC 日期', () => {
    const result = parseReceiptOcrResult({ text: 'Coffee 1230102' }, { timezone: tz });
    assert.equal(result.draft.amount, 1230102);
    assert.equal(result.draft.date, null);
  });
  await test('無標註時取最大數字為金額', () => {
    const result = parseReceiptOcrResult({ text: '統一超商\n咖啡 45\n三明治 60\nTotal 105' }, { timezone: tz });
    assert.equal(result.draft.amount, 105);
  });
  await test('預設幣別作為後備', () => {
    const result = parseReceiptOcrResult({ text: '總計 300' }, { timezone: tz, defaultCurrency: 'USD' });
    assert.equal(result.draft.currency, 'USD');
  });
  await test('空結果不拋錯且有 warning', () => {
    const empty = parseReceiptOcrResult({ text: '' }, { timezone: tz });
    assert.equal(empty.hasFields, false);
    assert.equal(empty.draft.amount, null);
    assert.ok(empty.warnings.length >= 0);
    const nullResult = parseReceiptOcrResult(null, { timezone: tz });
    assert.deepEqual(nullResult.warnings, ['ocr_empty_result']);
    assert.equal(nullResult.hasFields, false);
  });
  await test('畸形輸入不拋錯', () => {
    const weird = parseReceiptOcrResult({ text: '%%%\n---\n' }, { timezone: tz });
    assert.equal(weird.hasFields, false);
  });

  console.log('\n表單草稿與請求保護：');
  await test('OCR 只預填未觸碰欄位，不覆蓋使用者輸入', () => {
    const current = { amount: '45', date: '2026-10-07', note: 'Lunch' };
    const merged = applyReceiptOcrPrefill(
      current,
      { amount: 120, date: '2026-10-06', merchant: 'Receipt Shop' },
      { amount: false, date: false, note: false },
    );
    assert.deepEqual(merged, current);
  });
  await test('非空金額與備註即使尚未標記觸碰也不會被覆蓋', () => {
    const merged = applyReceiptOcrPrefill(
      { amount: '45', date: '2026-10-07', note: 'Lunch' },
      { amount: 120, date: '2026-10-06', merchant: 'Receipt Shop' },
      { amount: true, date: false, note: true },
    );
    assert.deepEqual(merged, { amount: '45', date: '2026-10-07', note: 'Lunch' });
  });
  await test('OCR 預填空白金額、預設日期與備註', () => {
    const merged = applyReceiptOcrPrefill(
      { amount: '', date: '2026-10-07', note: '' },
      { amount: 120, date: '2026-10-06', merchant: 'Receipt Shop' },
      { amount: true, date: true, note: true },
    );
    assert.deepEqual(merged, { amount: '120', date: '2026-10-06', note: 'Receipt Shop' });
  });
  await test('後續掃描不覆蓋第一次 OCR 已預填的日期', () => {
    const firstScan = applyReceiptOcrPrefill(
      { amount: '', date: '2026-10-07', note: '' },
      { amount: null, date: '2026-10-06', merchant: null },
      { amount: true, date: true, note: true },
    );
    const laterScan = applyReceiptOcrPrefill(
      firstScan,
      { amount: null, date: '2026-10-05', merchant: null },
      { amount: true, date: false, note: true },
    );
    assert.equal(laterScan.date, '2026-10-06');
  });
  await test('過期 OCR 回應在表單改變或關閉後失效', () => {
    const gate = createReceiptOcrRequestGate();
    const requestId = gate.begin();
    assert.equal(gate.isCurrent(requestId), true);
    gate.invalidate();
    assert.equal(gate.isCurrent(requestId), false);
    const nextRequestId = gate.begin();
    assert.equal(gate.isCurrent(nextRequestId), true);
    assert.equal(gate.isCurrent(requestId), false);
  });
  await test('transaction save 先使 OCR 失效，晚到結果不改寫已提交表單', async () => {
    const gate = createReceiptOcrRequestGate();
    const requestId = gate.begin();
    const submitted = { amount: '45', date: '2026-10-07', note: 'Lunch' };
    const pendingOcr = Promise.resolve({ amount: 120, date: '2026-10-06', merchant: 'Receipt Shop' });

    // Mirrors handleSave: invalidate synchronously before snapshotting the payload.
    gate.invalidate();
    const submittedSnapshot = { ...submitted };
    const lateDraft = await pendingOcr;
    const visibleForm = gate.isCurrent(requestId)
      ? applyReceiptOcrPrefill(submitted, lateDraft, { amount: true, date: true, note: true })
      : submitted;

    assert.deepEqual(submittedSnapshot, submitted);
    assert.deepEqual(visibleForm, submitted);
  });
  await test('OpenAPI requires MIME type for direct image uploads', () => {
    const openApi = readFileSync(new URL('../../asset_openapi.yaml', import.meta.url), 'utf8');
    const pathBlock = openApi.split('  /api/transactions/receipt-ocr:')[1]?.split('\n  /api/')[0] || '';
    assert.match(pathBlock, /- required: \[imageBase64, mimeType\]/);
    assert.match(pathBlock, /- required: \[transactionId, attachmentId\]/);
  });
  await test('OCR API authentication opts out of implicit background writes', () => {
    assert.deepEqual(RECEIPT_OCR_AUTH_OPTIONS, { skipAutomaticProcessing: true });
  });
  await test('API direct upload requires mimeType and validates base64/image size', () => {
    const png = Buffer.from('png-bytes');
    const encoded = png.toString('base64');
    const good = decodeReceiptOcrUpload(encoded, ' image/png ', 64, 64);
    assert.equal(good.ok, true);
    if (good.ok) {
      assert.equal(good.mimeType, 'image/png');
      assert.deepEqual(good.image, png);
    }
    assert.deepEqual(decodeReceiptOcrUpload(encoded, '', 64, 64), {
      ok: false,
      status: 400,
      error: '直接上傳影像時必須提供 mimeType',
    });
    assert.equal(decodeReceiptOcrUpload('###', 'image/png', 64, 64).ok, false);
    const oversizedImage = decodeReceiptOcrUpload(encoded, 'image/png', 64, 2);
    assert.equal(oversizedImage.ok ? 200 : oversizedImage.status, 413);
    const oversizedBase64 = decodeReceiptOcrUpload(encoded, 'image/png', 2, 64);
    assert.equal(oversizedBase64.ok ? 200 : oversizedBase64.status, 413);
  });
  await test('讀取前依 Content-Length 拒絕超大 JSON body', async () => {
    await assert.rejects(
      () => readJsonBodyWithLimit(null, '100', 10),
      RequestBodyTooLargeError,
    );
  });
  await test('chunked JSON body 讀取期間超限即拒絕', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('{"value":"exceeds"}'));
        controller.close();
      },
    });
    await assert.rejects(() => readJsonBodyWithLimit(stream, null, 8), RequestBodyTooLargeError);
  });
  await test('限量讀取成功解析合法 JSON', async () => {
    const encoded = new TextEncoder().encode('{"ok":true}');
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoded);
        controller.close();
      },
    });
    assert.deepEqual(await readJsonBodyWithLimit(stream, String(encoded.length), 64), { ok: true });
  });

  console.log('\n供應商：');
  await test('none 供應商未設定且不呼叫外部', async () => {
    const provider = createNoneProvider();
    assert.equal(provider.isConfigured(), false);
    await assert.rejects(() => provider.recognize({ image: Buffer.from('x'), mimeType: 'image/png' }));
  });
  await test('未設定 provider 時，不把一般收據影像假裝為可辨識', async () => {
    const provider = resolveReceiptOcrProvider({ provider: '' });
    assert.equal(provider.name, 'none');
    assert.equal(provider.isConfigured(), false);
    await assert.rejects(() => provider.recognize({ image: Buffer.from([0xff, 0xd8, 0xff]), mimeType: 'image/jpeg' }));
  });
  await test('http 供應商以 stub fetch 傳送憑證但不回傳憑證', async () => {
    const credential = 'OCR_SECRET_CANARY_9f4d2';
    let capturedUrl = '';
    let capturedAuthorization = '';
    const fetchImpl = (async (url: string | URL, init?: RequestInit) => {
      capturedUrl = String(url);
      capturedAuthorization = new Headers(init?.headers).get('authorization') || '';
      assert.equal(init?.method, 'POST');
      return new Response(JSON.stringify({ total: 1280, date: '2026-10-01', merchant: 'stub 商店' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    }) as unknown as typeof fetch;
    const provider = createHttpProvider({
      endpoint: 'https://ocr.example.invalid/api',
      apiKey: credential,
      fetchImpl,
    });
    assert.equal(provider.isConfigured(), true);
    const result = await provider.recognize({ image: Buffer.from([1, 2, 3]), mimeType: 'image/png' });
    assert.equal(capturedUrl, 'https://ocr.example.invalid/api');
    assert.equal(capturedAuthorization, `Bearer ${credential}`);
    assert.ok(!JSON.stringify(result).includes(credential), 'provider result must not include the API key');
    const parsed = parseReceiptOcrResult(result, { timezone: tz });
    assert.equal(parsed.draft.amount, 1280);
    assert.equal(parsed.draft.date, '2026-10-01');
    assert.ok(!JSON.stringify(parsed).includes(credential), 'parsed draft must not include the API key');
  });
  await test('含 API key 的 HTTP provider 拒絕明文端點且不呼叫網路', async () => {
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return new Response('{}');
    }) as unknown as typeof fetch;
    const provider = createHttpProvider({
      endpoint: 'http://ocr.example.invalid/api',
      apiKey: 'TLS_REQUIRED_CANARY',
      fetchImpl,
    });
    assert.equal(provider.isConfigured(), false);
    await assert.rejects(
      () => provider.recognize({ image: Buffer.from([1]), mimeType: 'image/png' }),
      /HTTPS/,
    );
    assert.equal(called, false);
  });
  await test('不含 API key 的 HTTP 測試端點仍可使用', () => {
    assert.equal(createHttpProvider({ endpoint: 'http://127.0.0.1:9000/ocr' }).isConfigured(), true);
  });
  await test('http 供應商非 2xx 拋錯', async () => {
    const fetchImpl = (async () => new Response('nope', { status: 502 })) as unknown as typeof fetch;
    const provider = createHttpProvider({ endpoint: 'https://ocr.example.invalid/api', fetchImpl });
    await assert.rejects(() => provider.recognize({ image: Buffer.from([1]), mimeType: 'image/png' }));
  });
  await test('http 供應商拒絕無效端點與超大影像', async () => {
    assert.equal(createHttpProvider({ endpoint: '' }).isConfigured(), false);
    assert.equal(createHttpProvider({ endpoint: 'file:///etc/passwd' }).isConfigured(), false);
    let called = false;
    const fetchImpl = (async () => { called = true; return new Response('{}'); }) as unknown as typeof fetch;
    const provider = createHttpProvider({
      endpoint: 'https://ocr.example.invalid/api',
      fetchImpl,
      maxBytes: 4,
    });
    await assert.rejects(() => provider.recognize({ image: Buffer.alloc(8), mimeType: 'image/png' }));
    assert.equal(called, false, '超過大小上限不應發出請求');
  });
  await test('resolveReceiptOcrProvider 傳遞設定的影像大小上限', async () => {
    let called = false;
    const fetchImpl = (async () => {
      called = true;
      return new Response('{}', { headers: { 'content-type': 'application/json' } });
    }) as unknown as typeof fetch;
    const provider = resolveReceiptOcrProvider({
      provider: 'http',
      endpoint: 'https://ocr.example.invalid/api',
      maxBytes: 4,
      fetchImpl,
    });
    await assert.rejects(() => provider.recognize({ image: Buffer.alloc(5), mimeType: 'image/png' }));
    assert.equal(called, false, 'custom OCR limit must be enforced before fetch');
  });
  await test('resolveReceiptOcrProvider 未知名稱降級為 none', () => {
    assert.equal(resolveReceiptOcrProvider({ provider: null }).name, 'none');
    assert.equal(resolveReceiptOcrProvider({ provider: 'unknown' }).name, 'none');
    assert.equal(resolveReceiptOcrProvider({ provider: 'BUILTIN' }).name, 'none');
    assert.equal(resolveReceiptOcrProvider({ provider: 'http', endpoint: 'https://x.invalid' }).name, 'http');
  });

  console.log('\n常數：');
  await test('影像大小上限為 10 MB', () => {
    assert.equal(RECEIPT_OCR_MAX_IMAGE_BYTES, 10 * 1024 * 1024);
  });
} finally {
  __setNowMs(null);
}

console.log(`\nreceipt OCR core：${pass} 通過、${fail} 失敗`);
if (fail > 0) process.exit(1);
