// tests/lib/clientApiOffline.test.ts — fetch 錯誤分類回歸測試（PWA 離線記帳）
import assert from 'node:assert/strict';
import test from 'node:test';
import { isNetworkError } from '../../lib/clientApi.ts';

test('isNetworkError 僅將 fetch 連線層 TypeError 判為網路錯誤，不信任 navigator.onLine', () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { onLine: false },
  });
  try {
    assert.equal(isNetworkError(new TypeError('Failed to fetch')), true);
    assert.equal(isNetworkError(new Error('帳戶不存在或無權限')), false);
    assert.equal(isNetworkError(new Error('HTTP 409')), false);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, 'navigator', descriptor);
    else delete (globalThis as unknown as Record<string, unknown>).navigator;
  }
});
