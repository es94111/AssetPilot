import assert from 'node:assert/strict';
import test from 'node:test';
import { createBoundedCooldownCache } from '../../lib/ttlCooldown.ts';

test('cooldown cache suppresses a repeated key until TTL expires', () => {
  const cache = createBoundedCooldownCache(1_000, 10);
  assert.equal(cache.tryAcquire('user-a', 100), true);
  assert.equal(cache.tryAcquire('user-a', 500), false);
  assert.equal(cache.tryAcquire('user-a', 1_100), true);
  assert.equal(cache.size(1_100), 1);
});

test('cooldown cache prunes expired users and never grows beyond its configured cap', () => {
  const cache = createBoundedCooldownCache(1_000, 3);
  assert.equal(cache.tryAcquire('a', 0), true);
  assert.equal(cache.tryAcquire('b', 10), true);
  assert.equal(cache.tryAcquire('c', 20), true);
  assert.equal(cache.size(20), 3);

  // The oldest unexpired entry is evicted when a burst exceeds the hard cap.
  assert.equal(cache.tryAcquire('d', 30), true);
  assert.equal(cache.size(30), 3);
  assert.equal(cache.tryAcquire('a', 31), true);
  assert.equal(cache.size(31), 3);

  // TTL pruning runs even when the requested key is unrelated.
  assert.equal(cache.size(1_031), 0);
  assert.equal(cache.tryAcquire('fresh', 1_032), true);
  assert.equal(cache.size(1_032), 1);
});
