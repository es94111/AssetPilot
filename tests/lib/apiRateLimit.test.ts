// tests/lib/apiRateLimit.test.ts — 公開 API 速率限制核心的純函式測試（不需 PostgreSQL）。
//
// 執行方式：node --experimental-transform-types --import ./tests/setup/register.mjs tests/lib/apiRateLimit.test.ts
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const {
  SlidingWindowRateLimiter,
  DEFAULT_API_RATE_LIMITS,
  isWriteScope,
  checkIpRateLimit,
  checkTokenRateLimit,
  apiRateLimitHeaders,
  getApiRateLimitRules,
  _resetApiRateLimitsForTests,
} = await import('../../lib/apiRateLimit.ts');

beforeEach(() => {
  _resetApiRateLimitsForTests();
});

test('滑動窗口：額度內放行並遞減 remaining，滿額時拒絕並給 Retry-After', () => {
  const limiter = new SlidingWindowRateLimiter(() => ({ limit: 3, windowMs: 60_000 }));
  const t0 = 1_000_000;

  for (let i = 0; i < 3; i++) {
    const d = limiter.check('k', t0 + i);
    assert.equal(d.allowed, true, `第 ${i + 1} 次應放行`);
    assert.equal(d.remaining, 2 - i);
    assert.equal(d.retryAfterSeconds, 0);
  }

  const denied = limiter.check('k', t0 + 3);
  assert.equal(denied.allowed, false);
  assert.equal(denied.remaining, 0);
  assert.ok(denied.retryAfterSeconds >= 1, 'Retry-After 至少 1 秒');
  assert.ok(denied.retryAfterSeconds <= 60);
});

test('窗口滑出後恢復：拒絕不記入窗口，額度隨時間回復', () => {
  const limiter = new SlidingWindowRateLimiter(() => ({ limit: 2, windowMs: 1000 }));
  const t0 = 5_000_000;

  assert.equal(limiter.check('k', t0).allowed, true);
  assert.equal(limiter.check('k', t0 + 1).allowed, true);
  assert.equal(limiter.check('k', t0 + 2).allowed, false);
  // 拒絕不記入：t0 與 t0+1 滑出後應可再用
  assert.equal(limiter.check('k', t0 + 1002).allowed, true);
});

test('不同 key 互不影響（per-token 額度不互相牽連）', () => {
  const limiter = new SlidingWindowRateLimiter(() => ({ limit: 1, windowMs: 60_000 }));
  assert.equal(limiter.check('token:a', 1).allowed, true);
  assert.equal(limiter.check('token:a', 2).allowed, false);
  assert.equal(limiter.check('token:b', 2).allowed, true);
});

test('peek 不計入窗口', () => {
  const limiter = new SlidingWindowRateLimiter(() => ({ limit: 1, windowMs: 60_000 }));
  assert.equal(limiter.peek('k', 1).allowed, true);
  assert.equal(limiter.peek('k', 2).allowed, true, 'peek 不應消耗額度');
  assert.equal(limiter.check('k', 3).allowed, true);
  assert.equal(limiter.peek('k', 4).allowed, false);
});

test('key 數量上限：超限時逐出最舊 key，記憶體有界', () => {
  const limiter = new SlidingWindowRateLimiter(() => ({ limit: 5, windowMs: 60_000 }), 10);
  for (let i = 0; i < 50; i++) limiter.check(`key:${i}`, 1000 + i);
  assert.ok(limiter.trackedKeyCount <= 10, `追蹤 key 數 ${limiter.trackedKeyCount} 應 ≤ 上限 10`);
});

test('isWriteScope 分類：寫入與 Webhook 管理走寫入額度，讀取代碼走讀取額度', () => {
  assert.equal(isWriteScope('transactions:write'), true);
  assert.equal(isWriteScope('accounts:write'), true);
  assert.equal(isWriteScope('webhooks:manage'), true);
  assert.equal(isWriteScope('transactions:read'), false);
  assert.equal(isWriteScope('accounts:read'), false);
  assert.equal(isWriteScope('categories:read'), false);
});

test('per-IP 與 per-Token 雙層：寫入額度獨立且較嚴', () => {
  _resetApiRateLimitsForTests({
    tokenRead: { limit: 100, windowMs: 60_000 },
    tokenWrite: { limit: 2, windowMs: 60_000 },
    ip: { limit: 3, windowMs: 60_000 },
  });

  const t0 = 10_000;
  assert.equal(checkTokenRateLimit('tok-1', 'accounts:write', t0).allowed, true);
  assert.equal(checkTokenRateLimit('tok-1', 'accounts:write', t0 + 1).allowed, true);
  assert.equal(checkTokenRateLimit('tok-1', 'accounts:write', t0 + 2).allowed, false, '寫入額度滿');
  assert.equal(checkTokenRateLimit('tok-1', 'accounts:read', t0 + 3).allowed, true, '讀取額度獨立');
  assert.equal(checkTokenRateLimit('tok-2', 'accounts:write', t0 + 3).allowed, true, '不同 Token 獨立');

  // per-IP 額度涵蓋所有請求（含無效權杖）
  assert.equal(checkIpRateLimit('203.0.113.9', t0).allowed, true);
  assert.equal(checkIpRateLimit('203.0.113.9', t0 + 1).allowed, true);
  assert.equal(checkIpRateLimit('203.0.113.9', t0 + 2).allowed, true);
  assert.equal(checkIpRateLimit('203.0.113.9', t0 + 3).allowed, false, 'IP 額度滿');
  assert.equal(checkIpRateLimit('203.0.113.10', t0 + 3).allowed, true, '不同 IP 獨立');
});

test('apiRateLimitHeaders：放行含額度資訊，拒絕含 Retry-After', () => {
  const limiter = new SlidingWindowRateLimiter(() => ({ limit: 1, windowMs: 60_000 }));
  const ok = apiRateLimitHeaders(limiter.check('k', 1000));
  assert.equal(ok['RateLimit-Limit'], '1');
  assert.equal(ok['RateLimit-Remaining'], '0');
  assert.equal(ok['Retry-After'], undefined);

  const denied = apiRateLimitHeaders(limiter.check('k', 1001));
  assert.equal(denied['RateLimit-Remaining'], '0');
  assert.ok(Number(denied['Retry-After']) >= 1);
});

test('測試重設：還原預設規則並清空窗口', () => {
  _resetApiRateLimitsForTests({ ip: { limit: 1, windowMs: 1000 } });
  assert.equal(checkIpRateLimit('1.2.3.4', 1).allowed, true);
  assert.equal(checkIpRateLimit('1.2.3.4', 2).allowed, false);

  _resetApiRateLimitsForTests();
  assert.deepEqual(getApiRateLimitRules(), DEFAULT_API_RATE_LIMITS);
  assert.equal(checkIpRateLimit('1.2.3.4', 2).allowed, true, '窗口已清空');
});
