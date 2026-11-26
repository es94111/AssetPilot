import assert from 'node:assert/strict';
import test from 'node:test';
import dns from 'node:dns';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { notificationSources } from '../../lib/notificationSources';
import { notificationMessages, parseNotificationCompletion, prepareNotificationInput } from '../../lib/notificationRecognitionCore';
import { GEMINI_NOTIFICATION_ENDPOINT, normalizeNotificationEndpoint, requestNotificationCompletion } from '../../lib/notificationRecognitionProvider';

const notice = {
  sourceId: 'ctbc', title: '刷卡消費通知', subtitle: '',
  body: '卡號末四碼 5678 於 2026/11/26 12:18 在範例超市消費 ＮＴ＄１,２５５.５０。',
  receivedAt: '2026-11-26T04:20:00.000Z',
};
const now = Date.parse(notice.receivedAt);
const parsed = prepareNotificationInput(notice, now);
if (parsed.status !== 'ok') throw new Error('Fixture failed');
const accepted = parsed.notice;
const purchase = {
  kind: 'purchase', amount: '1255.50', currency: 'TWD', merchant: '範例超市',
  occurredAt: '2026-11-26T12:18:00+08:00', timeEvidence: '2026/11/26 12:18',
};
const completion = (value: object) => ({ choices: [{ message: { content: JSON.stringify(value) } }] });

test('includes the 34 requested sources and keeps unavailable or unverified states explicit', () => {
  assert.equal(notificationSources.filter(({ group }) => group === 'bank').length, 22);
  assert.equal(notificationSources.filter(({ group }) => group === 'payment').length, 12);
  assert.deepEqual(notificationSources.filter(({ availability }) => availability === 'unavailable').map(({ id }) => id), ['google-wallet', 'samsung-pay']);
  const aliases = new Map<string, string>();
  for (const entry of notificationSources.filter(({ availability }) => availability !== 'unavailable')) {
    assert.ok(entry.appNames[0]);
    assert.equal(prepareNotificationInput({ ...notice, sourceId: entry.id }, now).status, 'ok');
    for (const name of entry.appNames) {
      const alias = name.normalize('NFKC').toLowerCase();
      assert.ok(!aliases.has(alias) || aliases.get(alias) === entry.id, `${name} should map to a single source`);
      aliases.set(alias, entry.id);
    }
  }
  assert.equal(prepareNotificationInput({ ...notice, sourceId: 'samsung-pay' }, now).status, 'invalid');
  assert.equal(prepareNotificationInput({ ...notice, sourceId: 'unknown' }, now).status, 'invalid');
});

test('blocks non-purchases, redacts identifiers and validates notification age', () => {
  for (const body of ['刷卡驗證碼 612546', '您的帳號登入成功', '刷卡失敗 NT$75', '刷卡退款成功 TWD500', '轉帳成功 TWD1000', '帳單提醒', '全支付限時優惠']) {
    assert.equal(prepareNotificationInput({ ...notice, body }, now).status, 'ignored', body);
  }
  assert.equal(prepareNotificationInput({ ...notice, receivedAt: '2026-11-15T12:18:00.000Z' }, now).status, 'invalid');
  assert.equal(prepareNotificationInput({ ...notice, receivedAt: '2026-11-31T12:18:00.000Z' }, now).status, 'invalid');
  const outgoing = notificationMessages(accepted, 'Asia/Taipei').at(-1)!.content;
  assert.doesNotMatch(outgoing, /5678/);
  assert.match(outgoing, /NT\$1,255\.50/);
});

test('drops authentication alerts and masks partial payment-card identifiers before egress', () => {
  for (const body of [
    '請輸入驗證碼為 625-810 以完成信用卡交易。',
    '安全碼是 1258，請完成付款驗證。',
    'Card security code: 291. Complete your payment.',
  ]) {
    assert.equal(prepareNotificationInput({ ...notice, body }, now).status, 'ignored', body);
  }
  const card = prepareNotificationInput({ ...notice, body: '卡片 4312-****-****-5678 及信用卡(9876) 在範例超市消費 NT$75。' }, now);
  assert.equal(card.status, 'ok');
  assert.ok('notice' in card);
  assert.doesNotMatch(card.notice.body, /4312|5678|9876/);
  assert.match(card.notice.body, /NT\$75/);
});

test('extracts TWD and preserves original foreign currency with evidenced fields', () => {
  assert.deepEqual(parseNotificationCompletion(completion(purchase), accepted, 'Asia/Taipei'), {
    outcome: 'draft',
    draft: { amount: '1255.5', currency: 'TWD', merchant: '範例超市', occurredAt: '2026-11-26T04:18:00.000Z', date: '2026-11-26' },
  });
  const foreign = { ...accepted, body: '2026/11/26 12:18 Cedar Shop 刷卡消費 USD12.34，折合 TWD395。' };
  const result = parseNotificationCompletion(completion({ ...purchase, amount: '12.34', currency: 'USD', merchant: 'Cedar Shop' }), foreign, 'Asia/Taipei');
  assert.equal(result.outcome, 'draft');
  assert.ok('draft' in result);
  assert.equal(result.draft.amount, '12.34');
  assert.equal(result.draft.currency, 'USD');
});

test('keeps a converted amount or a reference number out of the original money fields', () => {
  const foreign = { ...accepted, body: '2026/11/26 12:18 Cedar Shop 刷卡消費 USD12.34，折合 TWD395。' };
  const converted = parseNotificationCompletion(completion({ ...purchase, amount: '395', currency: 'TWD' }), foreign, 'Asia/Taipei');
  assert.ok('draft' in converted);
  assert.equal(converted.draft.amount, null);
  assert.equal(converted.draft.currency, null);
  const reference = { ...accepted, body: '範例超市刷卡消費，交易編號 REF 935。' };
  const guessed = parseNotificationCompletion(completion({ ...purchase, amount: '935', currency: null }), reference, 'Asia/Taipei');
  assert.ok('draft' in guessed);
  assert.equal(guessed.draft.amount, null);
});

test('does not confuse a displayed balance or a fee with the purchase amount', () => {
  const spend = { ...accepted, body: '於範例超市刷卡消費 NT$75，餘額 NT$4,500，手續費 NT$15。' };
  for (const amount of ['4500', '15']) {
    const result = parseNotificationCompletion(completion({ ...purchase, amount }), spend, 'Asia/Taipei');
    assert.ok('draft' in result);
    assert.equal(result.draft.amount, null);
  }
  const result = parseNotificationCompletion(completion({ ...purchase, amount: '75' }), spend, 'Asia/Taipei');
  assert.ok('draft' in result);
  assert.equal(result.draft.amount, '75');
});

test('keeps missing fields empty, rejects fabricated values and classifies non-purchases', () => {
  const result = parseNotificationCompletion(completion({ ...purchase, amount: '5678', currency: 'JPY', merchant: 'False shop',
    occurredAt: '2026-11-26T12:13:00+08:00' }), accepted, 'Asia/Taipei');
  assert.deepEqual(result, { outcome: 'needs_review', draft: { amount: null, currency: null, merchant: null, occurredAt: null, date: null } });
  assert.deepEqual(parseNotificationCompletion(completion({ kind: 'non_purchase' }), accepted, 'Asia/Taipei'), { outcome: 'ignored' });
  assert.throws(() => parseNotificationCompletion(completion({}), accepted, 'Asia/Taipei'), /invalid_completion/);
});

test('canonicalizes compatible URLs and uses a pinned HTTPS request with minimal OpenAI fields', async (t) => {
  assert.equal(normalizeNotificationEndpoint('https://generativelanguage.googleapis.com/v1beta/openai/'), GEMINI_NOTIFICATION_ENDPOINT);
  assert.equal(normalizeNotificationEndpoint('https://adapter.example.com/api/v1/chat/completions/'), 'https://adapter.example.com/api/v1/chat/completions');
  for (const target of ['http://example.com', 'https://127.0.0.1', 'https://user:pass@example.com', 'https://example.com/v1?key=x']) {
    assert.throws(() => normalizeNotificationEndpoint(target));
  }

  let ip = '203.0.114.21';
  let status = 200;
  let requests = 0;
  t.mock.method(dns.promises, 'lookup', async () => [{ address: ip, family: 4 }]);
  t.mock.method(https, 'request', (options: https.RequestOptions, finished: (response: PassThrough) => void) => {
    requests += 1;
    assert.equal(options.host, ip);
    assert.equal(options.servername, 'adapter.example.com');
    assert.equal(options.path, '/v1/chat/completions');
    assert.equal((options.headers as Record<string, string>).Authorization, 'Bearer test-api-key');
    return Object.assign(new EventEmitter(), { end(body: string) {
      const payload = JSON.parse(body);
      assert.equal(payload.model, 'gemini-on-a-gateway');
      assert.equal(payload.stream, false);
      assert.doesNotMatch(body, /5678/);
      queueMicrotask(() => {
        const response = Object.assign(new PassThrough(), { statusCode: status, complete: status === 200 });
        finished(response);
        response.end(JSON.stringify(completion(purchase)));
      });
    } });
  });
  const config = { endpoint: 'https://adapter.example.com/v1/', model: 'gemini-on-a-gateway', apiKey: 'test-api-key' };
  assert.deepEqual(await requestNotificationCompletion(config, accepted, 'Asia/Taipei', () => true), completion(purchase));
  assert.equal(await requestNotificationCompletion(config, accepted, 'Asia/Taipei', () => false), null);
  status = 307;
  await assert.rejects(requestNotificationCompletion(config, accepted, 'Asia/Taipei', () => true), /redirect/);
  ip = '192.168.1.10';
  await assert.rejects(requestNotificationCompletion(config, accepted, 'Asia/Taipei', () => true), /address/);
  assert.equal(requests, 2);
});
