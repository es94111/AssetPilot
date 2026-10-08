// tests/lib/clientApiOffline.test.ts — fetch 錯誤分類回歸測試（PWA 離線記帳）
import assert from 'node:assert/strict';
import test from 'node:test';
import { apiGet, apiGetPersonal, isNetworkError } from '../../lib/clientApi.ts';

test('apiGetPersonal 不帶目前的共享帳本標頭', async () => {
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalFetch = globalThis.fetch;
  const seenHeaders: Headers[] = [];
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { localStorage: { getItem: () => 'shared-ledger' } },
  });
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    seenHeaders.push(new Headers(init?.headers));
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
  try {
    await apiGet('/api/accounts');
    await apiGetPersonal('/api/accounts');
    assert.equal(seenHeaders[0].get('x-ledger-id'), 'shared-ledger');
    assert.equal(seenHeaders[1].has('x-ledger-id'), false);
  } finally {
    globalThis.fetch = originalFetch;
    if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor);
    else delete (globalThis as unknown as Record<string, unknown>).window;
  }
});

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
