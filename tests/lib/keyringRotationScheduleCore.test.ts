import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isKeyringPurpose,
  isRotationReadinessSatisfied,
  isTransientRotationError,
  isValidExpectedInstanceCount,
  isValidRotationInterval,
  retryDelayMs,
} from '../../lib/keyringRotationScheduleCore.ts';

test('rotation intervals and expected replica counts enforce supported bounds', () => {
  assert.equal(isValidRotationInterval(1), true);
  assert.equal(isValidRotationInterval(3650), true);
  assert.equal(isValidRotationInterval(0), false);
  assert.equal(isValidRotationInterval(3651), false);
  assert.equal(isValidRotationInterval(1.5), false);
  assert.equal(isValidExpectedInstanceCount(1), true);
  assert.equal(isValidExpectedInstanceCount(100), true);
  assert.equal(isValidExpectedInstanceCount(0), false);
  assert.equal(isValidExpectedInstanceCount(101), false);
  assert.equal(isValidExpectedInstanceCount('2'), false);
});

test('rotation readiness requires every observed replica to pass and the expected count to be present', () => {
  assert.equal(isRotationReadinessSatisfied({
    expectedCount: 2,
    observedCount: 2,
    readyCount: 2,
    pendingCount: 0,
    failedCount: 0,
  }), true);
  assert.equal(isRotationReadinessSatisfied({
    expectedCount: 3,
    observedCount: 2,
    readyCount: 2,
    pendingCount: 0,
    failedCount: 0,
  }), false);
  assert.equal(isRotationReadinessSatisfied({
    expectedCount: 2,
    observedCount: 2,
    readyCount: 1,
    pendingCount: 0,
    failedCount: 1,
  }), false);
  assert.equal(isRotationReadinessSatisfied({
    expectedCount: 2,
    observedCount: 2,
    readyCount: 1,
    pendingCount: 1,
    failedCount: 0,
  }), false);
});

test('transient retries use the configured bounded delays', () => {
  assert.deepEqual([retryDelayMs(1), retryDelayMs(2), retryDelayMs(3)], [60_000, 300_000, 900_000]);
  assert.equal(retryDelayMs(0), 0);
  assert.equal(retryDelayMs(4), 0);
  assert.equal(isTransientRotationError({ code: 'ECONNRESET' }), true);
  assert.equal(isTransientRotationError({ code: 'ROTATION_BATCH_FAILED', cause: { code: 'ETIMEDOUT' } }), true);
  assert.equal(isTransientRotationError({ code: 'ROTATION_BUSY' }), false);
  assert.equal(isTransientRotationError({ code: 'INVALID_ROTATION_SETTINGS' }), false);
});

test('only supported keyring purposes are accepted', () => {
  for (const purpose of ['jwt', 'api-token', 'einvoice', 'photo']) {
    assert.equal(isKeyringPurpose(purpose), true);
  }
  assert.equal(isKeyringPurpose('unknown'), false);
  assert.equal(isKeyringPurpose(null), false);
});
