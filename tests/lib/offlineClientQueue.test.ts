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
  const calls: Array<{ url: string; body: Record<string, unknown>; headers?: Record<string, string> }> = [];
  let responder: (url: string, body: Record<string, unknown>) => { status: number; json?: unknown; throws?: boolean } =
    () => ({ status: 201, json: { id: 'server-id' } });

  const windowShim = {
    localStorage: {
      broken: false,
      get length() { return store.size; },
      key(index: number) { return [...store.keys()][index] ?? null; },
      getItem(key: string) {
        return store.has(key) ? store.get(key)! : null;
      },
      setItem(this: { broken: boolean }, key: string, value: string) {
        // 模擬隱私模式／配額用盡：呼叫不拋錯，但寫入不生效（回讀仍為舊值）。
        if (this.broken) return;
        store.set(key, value);
      },
      removeItem(key: string) {
        store.delete(key);
      },
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
  defineGlobal('fetch', async (url: string, init?: { body?: string; headers?: Record<string, string> }) => {
    const body = init?.body ? (JSON.parse(init.body) as Record<string, unknown>) : {};
    calls.push({ url, body, headers: init?.headers });
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
    /** 模擬隱私模式／配額用盡：寫入不生效，但 setItem 不拋錯。 */
    breakStorage: () => { (windowShim.localStorage as unknown as { broken: boolean }).broken = true; },
    restore: () => {
      for (const { name, descriptor } of restoreValues) {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else delete (globalThis as unknown as Record<string, unknown>)[name];
      }
    },
  };
}

const STORAGE_KEY = 'assetpilot.offlineQueue';

test('離線排入 → 恢復連線後自動送出：成功項目自佇列移除並派送 data-changed', async () => {
  const shim = installBrowserShim();
  try {
    const mod = await import('../../lib/clientOfflineQueue.ts');
    mod.setOfflineQueueUser('sync-user');

    const received: string[] = [];
    window.addEventListener('assetpilot:data-changed', (event) => {
      received.push(String((event as { detail?: { scope?: string } }).detail?.scope ?? ''));
    });

    // 離線時排入兩筆（一收支、一轉帳）。
    shim.setOnline(false);
    const { item: tx, persisted: txPersisted } = mod.enqueueOffline('transaction', { date: '2026-10-05', type: 'expense', amount: 100 });
    const { item: tr } = mod.enqueueOffline('transfer', { date: '2026-10-05', amount: 50, fromAccountId: 'a', toAccountId: 'b' });
    assert.equal(txPersisted, true, '項目應確實寫入本機儲存');
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
    assert.deepEqual(received, ['transactions:offline-sync'], '成功送出後應派送 offline-sync data-changed');
  } finally {
    shim.restore();
  }
});

test('離線交易固定使用建立時的帳本，不隨後續帳本切換而轉移', async () => {
  const shim = installBrowserShim();
  try {
    const mod = await import('../../lib/clientOfflineQueue.ts');
    mod.setOfflineQueueUser('ledger-user');
    shim.setOnline(false);
    shim.store.set('assetpilot.active-ledger-id', 'shared-ledger-a');
    const { item } = mod.enqueueOffline('transaction', { amount: 10 });
    assert.equal(item.ledgerId, 'shared-ledger-a');
    assert.equal(mod.getQueue()[0].ledgerId, 'shared-ledger-a');
    shim.store.set('assetpilot.active-ledger-id', 'shared-ledger-b');
    shim.setOnline(true);
    await mod.flushOfflineQueue();
    assert.equal(shim.calls[0].headers?.['x-ledger-id'], 'shared-ledger-a');
  } finally {
    shim.restore();
  }
});

test('在線請求重試佇列沿用第一次 POST 的 idempotency key', async () => {
  const shim = installBrowserShim();
  try {
    const mod = await import('../../lib/clientOfflineQueue.ts');
    mod.setOfflineQueueUser('ambiguous-write-user');
    const clientRef = 'a'.repeat(32);
    shim.setOnline(false);
    const { item, persisted } = mod.enqueueOffline('transaction', { amount: 25, clientRef }, clientRef);
    assert.equal(persisted, true);
    assert.equal(item.id, clientRef);
    shim.setOnline(true);
    await mod.flushOfflineQueue();
    assert.equal(shim.calls[0].body.clientRef, clientRef);
  } finally {
    shim.restore();
  }
});

test('離線佇列容量已滿時拒絕新項目並保留所有未同步資料', async () => {
  const shim = installBrowserShim();
  try {
    const mod = await import('../../lib/clientOfflineQueue.ts');
    const { createQueueItem, MAX_QUEUE_SIZE } = await import('../../lib/offlineQueueCore.ts');
    mod.setOfflineQueueUser('full-queue-user');
    const items = Array.from({ length: MAX_QUEUE_SIZE }, (_, index) => createQueueItem({
      kind: 'transaction', payload: { index }, now: index + 1, id: index.toString(16).padStart(32, '0'),
    }));
    const key = 'assetpilot.offlineQueue.full-queue-user';
    shim.store.set(key, JSON.stringify(items));
    const result = mod.enqueueOffline('transaction', { amount: 999 });
    assert.equal(result.persisted, false);
    assert.deepEqual(mod.getQueue(), items);
    assert.ok(mod.getQueue().some((item) => item.id === items[0].id));
  } finally {
    shim.restore();
  }
});

test('可重試失敗（網路層）：留在佇列並累積嘗試次數', async () => {
  const shim = installBrowserShim();
  try {
    const mod = await import('../../lib/clientOfflineQueue.ts');
    mod.setOfflineQueueUser('network-failure-user');
    shim.setOnline(true);
    shim.setResponder(() => ({ status: 0, throws: true }));
    const { item } = mod.enqueueOffline('transaction', { amount: 1 });

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
    mod.setOfflineQueueUser('status-failure-user');
    shim.setOnline(true);

    shim.setResponder(() => ({ status: 503 }));
    mod.enqueueOffline('transaction', { amount: 1 });
    let summary = await mod.flushOfflineQueue();
    assert.equal(summary.pending, 1, '503 應保留為可重試');
    assert.equal(mod.getQueue()[0].status, 'pending');
    mod.discardItem(mod.getQueue()[0].id);

    // 4xx：標記 failed，且不再嘗試後續項目。
    shim.setResponder(() => ({ status: 422, json: { error: '帳戶不存在或無權限' } }));
    const { item: bad } = mod.enqueueOffline('transaction', { amount: 2 });
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
    mod.setOfflineQueueUser('retry-user');
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
    mod.setOfflineQueueUser('discard-user');
    const { item } = mod.enqueueOffline('transaction', { amount: 1 });
    assert.equal(mod.getQueue().length, 1);
    mod.discardItem(item.id);
    assert.equal(mod.getQueue().length, 0);
    // 持久化層也應同步（重新解析仍是空的）。
    assert.deepEqual(JSON.parse(shim.store.get(STORAGE_KEY) ?? '[]'), []);
  } finally {
    shim.restore();
  }
});

test('在線連線錯誤後入列會立即重試，不必等待下一個 online 事件', async () => {
  const shim = installBrowserShim();
  try {
    const mod = await import('../../lib/clientOfflineQueue.ts');
    mod.setOfflineQueueUser('auto-flush-user');
    shim.setOnline(true);
    const stop = mod.startOfflineSync(() => {});
    try {
      const { persisted } = mod.enqueueOffline('transaction', { amount: 42 });
      assert.equal(persisted, true);
      // queue-change 應立即觸發 flush；等待背景 Promise 微任務完成。
      for (let i = 0; i < 20 && mod.getQueue().length > 0; i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      assert.equal(shim.calls.length, 1, '入列後應立即送出一次');
      assert.equal(mod.getQueue().length, 0, '成功送出後佇列應清空');
    } finally {
      stop();
      mod.setOfflineQueueUser(null);
    }
  } finally {
    shim.restore();
  }
});

test('切換使用者會清除前一位使用者尚未同步的佇列（避免跨使用者外洩）', async () => {
  const shim = installBrowserShim();
  try {
    const mod = await import('../../lib/clientOfflineQueue.ts');

    mod.setOfflineQueueUser('user-a');
    mod.enqueueOffline('transaction', { amount: 999, note: 'A 的離線交易' });
    assert.equal(mod.getQueue().length, 1);
    assert.ok(shim.store.has('assetpilot.offlineQueue.user-a'));
    assert.equal(JSON.parse(shim.store.get('assetpilot.offlineQueue.auth') ?? '{}').userId, 'user-a');

    // 登出後停用自動同步但保留本人未同步資料，重新登入同一帳號可恢復。
    mod.notifyOfflineQueueLogout();
    assert.equal(mod.getQueue().length, 0, '登出時不應再向網路送出佇列');
    assert.equal(JSON.parse(shim.store.get('assetpilot.offlineQueue.auth') ?? '{}').userId, null);
    assert.ok(shim.store.has('assetpilot.offlineQueue.user-a'), '同一使用者重新登入仍可恢復佇列');
    mod.setOfflineQueueUser('user-a');
    assert.equal(mod.getQueue().length, 1);

    // 同一裝置換使用者登入：前一位的資料必須消失，且不會殘留在自己的鍵之下。
    mod.setOfflineQueueUser('user-b');
    assert.equal(JSON.parse(shim.store.get('assetpilot.offlineQueue.auth') ?? '{}').userId, 'user-b');
    assert.equal(mod.getQueue().length, 0, '切換使用者後不得看到前一位的項目');

    const { persisted } = mod.enqueueOffline('transaction', { amount: 1 });
    assert.equal(persisted, true);
    assert.equal(mod.getQueue().length, 1);
    assert.ok(shim.store.has('assetpilot.offlineQueue.user-b'));
    assert.ok(!shim.store.has('assetpilot.offlineQueue.user-a'), 'A 的鍵應被清除');
  } finally {
    shim.restore();
  }
});

test('setOfflineQueueUser 亦清除舊版未區分使用者的殘留鍵', async () => {
  const shim = installBrowserShim();
  try {
    const mod = await import('../../lib/clientOfflineQueue.ts');
    shim.store.set('assetpilot.offlineQueue.v1', JSON.stringify([{ id: 'x'.repeat(32), kind: 'transaction', payload: {}, createdAt: 1, attempts: 0, status: 'pending' }]));
    mod.setOfflineQueueUser('user-a');
    assert.ok(!shim.store.has('assetpilot.offlineQueue.v1'), '舊版固定鍵應被移除');
  } finally {
    shim.restore();
  }
});

test('本機儲存不可用時 enqueueOffline 回報未持久化（不可謊稱已儲存）', async () => {
  const shim = installBrowserShim();
  try {
    const mod = await import('../../lib/clientOfflineQueue.ts');
    // 模擬登出後未綁定使用者：不可寫入共用 base key 或謊稱成功。
    mod.notifyOfflineQueueLogout();
    const { persisted } = mod.enqueueOffline('transaction', { amount: 1 });
    assert.equal(persisted, false);
    assert.equal(mod.getQueue().length, 0);
    mod.setOfflineQueueUser('storage-failure-user');
    // 模擬隱私模式／配額用盡：寫入不生效（setItem 靜默失敗）。
    shim.breakStorage();
    const result = mod.enqueueOffline('transaction', { amount: 1 });
    assert.equal(result.persisted, false, '無法寫入時應回報 persisted=false');
    assert.equal(mod.getQueue().length, 0, '未持久化即代表資料不在佇列中');
  } finally {
    shim.restore();
  }
});
