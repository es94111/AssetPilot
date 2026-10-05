// tests/lib/offlineQueue.test.ts — 離線記帳佇列純函式測試（007-pwa-offline-entry）
//
// 純函式測試，不需要資料庫或瀏覽器 —— 這正是它能在無 DB 的 CI 環境也跑得動的價值。
// 釘住 Issue 驗收條件「離線新增的交易存入本機佇列，恢復連線後自動送出」與
// 「同步衝突處理策略需明確定義」對應的重試／退避／失敗分流邏輯。
// 執行方式：node --import tests/setup/register.mjs tests/lib/offlineQueue.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_AUTO_ATTEMPTS,
  MAX_QUEUE_SIZE,
  RETRY_BASE_DELAY_MS,
  RETRY_MAX_DELAY_MS,
  createQueueItem,
  enqueue,
  failedItems,
  isRetryableStatus,
  newQueueId,
  parseQueue,
  parseQueueItem,
  pendingItems,
  recordFailure,
  removeItem,
  resetForRetry,
  retryDelayMs,
  serializeQueue,
  summarizeQueue,
} from '../../lib/offlineQueueCore.ts';

test('newQueueId 產生 32 碼十六進位，符合伺服器 clientRef 格式', () => {
  const ids = new Set<string>();
  for (let i = 0; i < 50; i += 1) ids.add(newQueueId());
  for (const id of ids) assert.match(id, /^[a-f0-9]{32}$/);
  // 以可預測的亂數驗證確切輸出，確保不是空字串或固定值。
  let calls = 0;
  assert.equal(newQueueId(() => (calls++ % 16) / 16), '0123456789abcdef0123456789abcdef');
});

test('createQueueItem 建立 pending 項目且 attempts 為 0', () => {
  const item = createQueueItem({ kind: 'transaction', payload: { amount: 100 }, now: 1_700_000_000_000, id: 'a'.repeat(32) });
  assert.equal(item.kind, 'transaction');
  assert.equal(item.status, 'pending');
  assert.equal(item.attempts, 0);
  assert.equal(item.createdAt, 1_700_000_000_000);
  assert.deepEqual(item.payload, { amount: 100 });
});

test('parseQueue 容忍破損與惡意輸入，只保留合法項目', () => {
  assert.deepEqual(parseQueue(null), []);
  assert.deepEqual(parseQueue(''), []);
  assert.deepEqual(parseQueue('{not json'), []);
  assert.deepEqual(parseQueue('{"a":1}'), []);
  assert.equal(parseQueueItem(null), null);
  assert.equal(parseQueueItem({ id: 'x', kind: 'nope', payload: {}, createdAt: 1 }), null);
  assert.equal(parseQueueItem({ id: 'x', kind: 'transaction', payload: 'not-object', createdAt: 1 }), null);
  assert.equal(parseQueueItem({ id: '', kind: 'transaction', payload: {}, createdAt: 1 }), null);
  assert.equal(parseQueueItem({ id: 'x', kind: 'transaction', payload: {}, createdAt: 0 }), null);

  const good = createQueueItem({ kind: 'transfer', payload: { amount: 5 }, now: 10, id: 'b'.repeat(32) });
  const raw = JSON.stringify([good, { id: 'bad' }, null, 42]);
  const parsed = parseQueue(raw);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].id, good.id);
});

test('parseQueue 去除重複 id（序列化格式可被外部竄改）', () => {
  const item = createQueueItem({ kind: 'transaction', payload: {}, now: 10, id: 'c'.repeat(32) });
  const parsed = parseQueue(JSON.stringify([item, item, item]));
  assert.equal(parsed.length, 1);
});

test('serializeQueue 與 parseQueue 往返一致', () => {
  const items = [
    createQueueItem({ kind: 'transaction', payload: { a: 1 }, now: 100, id: 'd'.repeat(32) }),
    createQueueItem({ kind: 'transfer', payload: { b: 2 }, now: 200, id: 'e'.repeat(32) }),
  ];
  const roundTrip = parseQueue(serializeQueue(items));
  assert.deepEqual(roundTrip, items);
});

test('enqueue 不重複加入同 id，且容量上限丟棄最舊項目', () => {
  const first = createQueueItem({ kind: 'transaction', payload: {}, now: 1, id: '1'.repeat(32) });
  let queue = enqueue([], first);
  queue = enqueue(queue, first);
  assert.equal(queue.length, 1, '同 id 不應重複加入');

  for (let i = 0; i < MAX_QUEUE_SIZE + 10; i += 1) {
    queue = enqueue(queue, createQueueItem({ kind: 'transaction', payload: { i }, now: 1000 + i }));
  }
  assert.equal(queue.length, MAX_QUEUE_SIZE);
  // 最舊的 first 應已被丟棄，最新加入的仍在。
  assert.ok(!queue.some((item) => item.id === first.id));
});

test('removeItem / pendingItems / failedItems 正確分流', () => {
  const a = createQueueItem({ kind: 'transaction', payload: {}, now: 1, id: 'f'.repeat(32) });
  const b = createQueueItem({ kind: 'transaction', payload: {}, now: 2, id: 'g'.repeat(32) });
  const failed = recordFailure([a, b], b.id, { message: 'boom', retryable: false });
  assert.equal(pendingItems(failed).length, 1);
  assert.equal(failedItems(failed).length, 1);
  assert.equal(failedItems(failed)[0].lastError, 'boom');
  assert.equal(removeItem(failed, a.id).length, 1);
});

test('recordFailure：可重試錯誤在達到上限前維持 pending，之後轉 failed', () => {
  const item = createQueueItem({ kind: 'transaction', payload: {}, now: 1, id: 'h'.repeat(32) });
  let queue = [item];
  for (let i = 1; i < MAX_AUTO_ATTEMPTS; i += 1) {
    queue = recordFailure(queue, item.id, { message: 'timeout', retryable: true });
    assert.equal(queue[0].status, 'pending', `第 ${i} 次重試後仍應 pending`);
    assert.equal(queue[0].attempts, i);
  }
  queue = recordFailure(queue, item.id, { message: 'timeout', retryable: true });
  assert.equal(queue[0].attempts, MAX_AUTO_ATTEMPTS);
  assert.equal(queue[0].status, 'failed', '超過自動重試上限應轉為 failed');
});

test('recordFailure：不可重試錯誤立即轉 failed（交由使用者選擇）', () => {
  const item = createQueueItem({ kind: 'transaction', payload: {}, now: 1, id: 'i'.repeat(32) });
  const queue = recordFailure([item], item.id, { message: '帳戶不存在', retryable: false });
  assert.equal(queue[0].status, 'failed');
  assert.equal(queue[0].attempts, 1);
});

test('resetForRetry 讓使用者重試時回到 pending 並重置嘗試次數', () => {
  const item = createQueueItem({ kind: 'transaction', payload: {}, now: 1, id: 'j'.repeat(32) });
  const failed = recordFailure([item], item.id, { message: 'x', retryable: false });
  const retried = resetForRetry(failed, item.id);
  assert.equal(retried[0].status, 'pending');
  assert.equal(retried[0].attempts, 0);
  assert.equal(retried[0].lastError, undefined);
});

test('retryDelayMs 指數退避且不超過上限', () => {
  assert.equal(retryDelayMs(0), RETRY_BASE_DELAY_MS);
  assert.equal(retryDelayMs(1), RETRY_BASE_DELAY_MS);
  assert.equal(retryDelayMs(2), RETRY_BASE_DELAY_MS * 2);
  assert.equal(retryDelayMs(3), RETRY_BASE_DELAY_MS * 4);
  assert.equal(retryDelayMs(50), RETRY_MAX_DELAY_MS);
});

test('isRetryableStatus：網路錯誤與 5xx／429 可重試，其他 4xx 不可', () => {
  assert.equal(isRetryableStatus(0), true, '網路層失敗應可重試');
  assert.equal(isRetryableStatus(NaN), true);
  assert.equal(isRetryableStatus(408), true);
  assert.equal(isRetryableStatus(425), true);
  assert.equal(isRetryableStatus(429), true);
  assert.equal(isRetryableStatus(500), true);
  assert.equal(isRetryableStatus(503), true);
  assert.equal(isRetryableStatus(400), false);
  assert.equal(isRetryableStatus(404), false);
  assert.equal(isRetryableStatus(409), false);
  assert.equal(isRetryableStatus(422), false);
});

test('summarizeQueue 統計 pending / failed / total', () => {
  const a = createQueueItem({ kind: 'transaction', payload: {}, now: 1, id: 'k'.repeat(32) });
  const b = createQueueItem({ kind: 'transaction', payload: {}, now: 2, id: 'l'.repeat(32) });
  const c = createQueueItem({ kind: 'transfer', payload: {}, now: 3, id: 'm'.repeat(32) });
  const queue = recordFailure([a, b, c], c.id, { message: 'x', retryable: false });
  assert.deepEqual(summarizeQueue(queue), { pending: 2, failed: 1, total: 3 });
  assert.deepEqual(summarizeQueue([]), { pending: 0, failed: 0, total: 0 });
});
