// tests/lib/offlineClientQueue.test.ts — 離線佇列「送出／同步」流程整合測試（007-pwa-offline-entry）
//
// 純函式邏輯由 tests/lib/offlineQueue.test.ts 覆蓋；本檔補上 lib/clientOfflineQueue.ts 中
// 實際會打網路的 sendItem／flushOfflineQueue 流程 —— 這是 Issue 驗收條件
// 「離線新增的交易存入本機佇列，恢復連線後自動送出」的直接對象。
//
// 以最小瀏覽器 shim（window／localStorage／navigator／fetch）在 Node 中執行，不需要真瀏覽器：
//   - 成功送出：項目自佇列移除，並派送 data-changed 事件
//   - 可重試失敗：留在佇列、累積嘗試次數
//   - 不可重試失敗：標記 failed，且不繼續送出後續項目
//   - 重送時帶上 clientRef（伺服器冪等的關鍵）
// 執行方式：node --experimental-transform-types --import tests/setup/register.mjs tests/lib/offlineClientQueue.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';

/** 安裝最小瀏覽器環境；回傳可觀察的 fetch 呼叫紀錄。 */
function installBrowserShim() {
  const store = new Map<string, string>();
  const listeners = new Map<string, Set<(event: unknown) => void>>();
  const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
  let responder: (url: string, body: Record<string, unknown>) => { status: number; json?: unknown; throws?: boolean } =
    () => ({ status: 201, json: { id: 'server-id' } });

  const windowShim = {
    localStorage: {
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); },
    },
    addEventListener: (type: string, handler: (event: unknown) => void) => {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(handler);
    },
    removeEventListener: (type: string, handler: (event: unknown) => void) => {
      listeners.get(type)?.delete(handler);
    },
    dispatchEvent: (event: { type?: string }) => {
      for (const handler of listeners.get(String(event?.type ?? '')) ?? []) handler(event);
      return true;
    },
  };

  class ShimCustomEvent {
    type: string;
    detail: unknown;
    constructor(type: string, init?: { detail?: unknown }) {
      this.type = type;
      this.detail = init?.detail;
    }
  }

  // Node 24 的 globalThis.navigator／window 是唯讀 getter，需以 defineProperty 覆寫並可還原。
  const defineGlobal = (name: string, value: unknown) => {
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
  };

  const names = ['window', 'navigator', 'fetch', 'CustomEvent'] as const;
  const restoreValues = names.map((name) => ({
    name,
    descriptor: Object.getOwnPropertyDescriptor(globalThis, name),
  }));

  defineGlobal('CustomEvent', ShimCustomEvent);
  defineGlobal('window', windowShim);
  defineGlobal('navigator', { onLine: true });
  defineGlobal('fetch', async (url: string, init?: { body?: string }) => {
    const body = init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    calls.push({ url, body });
    const outcome = responder(url, body);
    if (outcome.throws) throw new TypeError('Failed to fetch');
    return {
      ok: outcome.status >= 200 && outcome.status < 300,
      status: outcome.status,
      json: async () => outcome.json ?? {},
    };
  });

  return {
    calls,
    store,
    setResponder: (next: typeof responder) => { responder = next; },
    setOnline: (value: boolean) => { (globalThis.navigator as { onLine: boolean }).onLine = value; },
    restore: () => {
      for (const { name, descriptor } of restoreValues) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete (globalThis as unknown as Record<string, unknown>)[name];
      }
    },
  };
}

const STORAGE_KEY = 'assetpilot.offlineQueue.v1';

test('離線排入 → 恢復連線後自動送出：成功項目自佇列移除並派送 data-changed', async () => {
  const shim = installBrowserShim();
  try {
    const mod = await import('../../lib/clientOfflineQueue.ts');

    const received: string[] = [];
    window.addEventListener('assetpilot:data-changed', (event) => {
      received.push(String((event as { detail?: { scope?: string } }).detail?.scope ?? ''));
    });

    // 離線時排入兩筆（一收支、一轉帳）。
    shim.setOnline(false);
    const tx = mod.enqueueOffline('transaction', { date: '2026-10-05', type: 'expense', amount: 100 });
    const tr = mod.enqueueOffline('transfer', { date: '2026-10-05', amount: 50, fromAccountId: 'a', toAccountId: 'b' });
    assert.equal(mod.getQueueSummary().pending, 2);
    assert.equal(shim.calls.length, 0, '離線時不應送出任何請求');

    // 恢復連線後送出。
    shim.setOnline(true);
    const summary = await mod.flushOfflineQueue();

    assert.equal(shim.calls.length, 2, '兩筆項目都應送出');
    assert.equal(shim.calls[0].url, '/api/transactions');
    assert.equal(shim.calls[1].url, '/api/transactions/transfer');
    // clientRef 必須等於佇列項目的 id（伺服器冪等的關鍵）。
    assert.equal(shim.calls[0].body.clientRef, tx.id);
    assert.equal(shim.calls[1].body.clientRef, tr.id);
    assert.match(String(shim.calls[0].body.clientRef), /^[a-f0-9]{32}$/);

    assert.deepEqual(summary, { pending: 0, failed: 0, total: 0 });
    assert.equal(mod.getQueue().length, 0, '成功項目應自佇列移除');
    assert.deepEqual(received, ['transactions'], '成功送出後應派送一次 data-changed');
  } finally {
    shim.restore();
  }
});

test('可重試失敗（網路層）：留在佇列並累積嘗試次數', async () => {
  const shim = installBrowserShim();
  try {
    const mod = await import('../../lib/clientOfflineQueue.ts');
    shim.setOnline(true);
    shim.setResponder(() => ({ status: 0, throws: true }));
    const item = mod.enqueueOffline('transaction', { amount: 1 });

    const summary = await mod.flushOfflineQueue();

    assert.equal(summary.pending, 1, '網路失敗應留在佇列待重試');
    assert.equal(summary.failed, 0, '不應標記為不可重試失敗');
    const queued = mod.getQueue();
    assert.equal(queued.length, 1);
    assert.equal(queued[0].id, item.id);
    assert.equal(queued[0].attempts, 1, '嘗試次數應累加');
    assert.equal(queued[0].status, 'pending');
  } finally {
    shim.restore();
  }
});

test('5xx 視為可重試；4xx 視為不可重試並停止本輪送出', async () => {
  const shim = installBrowserShim();
  try {
    const mod = await import('../../lib/clientOfflineQueue.ts');
    shim.setOnline(true);

    shim.setResponder(() => ({ status: 503 }));
    mod.enqueueOffline('transaction', { amount: 1 });
    let summary = await mod.flushOfflineQueue();
    assert.equal(summary.pending, 1, '503 應保留為可重試');
    assert.equal(mod.getQueue()[0].status, 'pending');
    mod.discardItem(mod.getQueue()[0].id);

    // 4xx：標記 failed，且不再嘗試後續項目。
    shim.setResponder(() => ({ status: 422, json: { error: '帳戶不存在或無權限' } }));
    const bad = mod.enqueueOffline('transaction', { amount: 2 });
    mod.enqueueOffline('transaction', { amount: 3 });
    const before = shim.calls.length;
    summary = await mod.flushOfflineQueue();

    assert.equal(shim.calls.length - before, 1, '遇不可重試錯誤應停止本輪，不送出後續項目');
    assert.equal(summary.failed, 1);
    assert.equal(summary.pending, 1);
    const failed = mod.getFailedItems();
    assert.equal(failed.length, 1);
    assert.equal(failed[0].id, bad.id);
    assert.equal(failed[0].lastError, '帳戶不存在或無權限');
  } finally {
    shim.restore();
  }
});

test('retryItem 讓使用者重試失敗項目並在成功後清空', async () => {
  const shim = installBrowserShim();
  try {
    const mod = await import('../../lib/clientOfflineQueue.ts');
    shim.setOnline(true);
    shim.setResponder(() => ({ status: 400, json: { error: '資料錯誤' } }));
    mod.enqueueOffline('transaction', { amount: 1 });
    await mod.flushOfflineQueue();
    assert.equal(mod.getFailedItems().length, 1);

    // 伺服器端問題排除後使用者按重試。
    shim.setResponder(() => ({ status: 201, json: { id: 'ok' } }));
    mod.retryItem(mod.getQueue()[0].id);
    // retryItem 會觸發 flush；等待其完成。
    await mod.flushOfflineQueue();

    assert.equal(mod.getQueue().length, 0, '重試成功後佇列應清空');
  } finally {
    shim.restore();
  }
});

test('discardItem 由使用者放棄項目', async () => {
  const shim = installBrowserShim();
  try {
    const mod = await import('../../lib/clientOfflineQueue.ts');
    const item = mod.enqueueOffline('transaction', { amount: 1 });
    assert.equal(mod.getQueue().length, 1);
    mod.discardItem(item.id);
    assert.equal(mod.getQueue().length, 0);
    // 持久化層也應同步（重新解析仍是空的）。
    assert.deepEqual(JSON.parse(shim.store.get(STORAGE_KEY) ?? '[]'), []);
  } finally {
    shim.restore();
  }
});
