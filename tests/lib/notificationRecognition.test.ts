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
