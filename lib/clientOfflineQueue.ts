'use client';

// lib/clientOfflineQueue.ts — 離線記帳佇列（client-only）
//
// 職責：把「離線時新增的交易」暫存在 localStorage，並在恢復連線後依序送出。
// 決策邏輯（形狀、重試、退避）全在純模組 lib/offlineQueueCore.ts；本檔只負責
// 瀏覽器 I/O（localStorage、fetch、online/offline 事件）與訂閱通知。
//
// 為什麼用 localStorage 而非 IndexedDB／Cache Storage：
//   佇列最多數十筆輕量 JSON，localStorage 的同步讀寫足夠且可在下一次載入時
//   立即還原；IndexedDB 的非同步封裝只增加複雜度而無實質效益。

import {
  createQueueItem,
  enqueue,
  failedItems,
  isRetryableStatus,
  parseQueue,
  pendingItems,
  recordFailure,
  removeItem,
  resetForRetry,
  retryDelayMs,
  serializeQueue,
  summarizeQueue,
  type OfflineQueueItem,
  type OfflineQueueKind,
  type QueueSummary,
} from './offlineQueueCore';
import { notifyDataChanged } from './clientApi';

const STORAGE_KEY = 'assetpilot.offlineQueue.v1';

/** 佇列變更事件（同頁多個元件共用一份狀態）。 */
export const OFFLINE_QUEUE_EVENT = 'assetpilot:offline-queue-changed';

/** 每個端點對應的送出 URL 與成功時的資料變更 scope。 */
const ENDPOINTS: Record<OfflineQueueKind, { url: string; scope: string }> = {
  transaction: { url: '/api/transactions', scope: 'transactions' },
  transfer: { url: '/api/transactions/transfer', scope: 'transactions' },
};

function readQueue(): OfflineQueueItem[] {
  if (typeof window === 'undefined') return [];
  try {
    return parseQueue(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return [];
  }
}

function writeQueue(items: OfflineQueueItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, serializeQueue(items));
  } catch {
    // 配額用盡（例如隱私模式）時放棄持久化，仍讓本回合的記憶體佇列可用。
  }
  window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT));
}

export function getQueue(): OfflineQueueItem[] {
  return readQueue();
}

export function getQueueSummary(): QueueSummary {
  return summarizeQueue(readQueue());
}

/**
 * 把一筆交易／轉帳排入離線佇列。
 * 回傳產生的項目（含 idempotency key），供呼叫端在送出時原樣附上。
 */
export function enqueueOffline(
  kind: OfflineQueueKind,
  payload: Record<string, unknown>
): OfflineQueueItem {
  const item = createQueueItem({ kind, payload, now: Date.now() });
  writeQueue(enqueue(readQueue(), item));
  return item;
}

export function discardItem(id: string): void {
  writeQueue(removeItem(readQueue(), id));
}

export function retryItem(id: string): void {
  writeQueue(resetForRetry(readQueue(), id));
  void flushOfflineQueue();
}

/** 是否處於離線（或瀏覽器不支援時視為在線，交由實際 fetch 決定）。 */
export function isOffline(): boolean {
  if (typeof navigator === 'undefined') return false;
  return navigator.onLine === false;
}

interface SendOutcome {
  ok: boolean;
  status: number;
  retryable: boolean;
  message?: string;
  scope?: string;
}

async function sendItem(item: OfflineQueueItem): Promise<SendOutcome> {
  const endpoint = ENDPOINTS[item.kind];
  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      // clientRef 同時作為伺服器端 (user_id, client_ref) 唯一鍵。
      body: JSON.stringify({ ...item.payload, clientRef: item.id }),
    });
    if (res.ok) return { ok: true, status: res.status, retryable: false, scope: endpoint.scope };
    // 401 代表登入階段已失效，留在佇列等使用者重新登入（不標記為失敗）。
    const retryable = res.status === 401 || isRetryableStatus(res.status);
    let message = `HTTP ${res.status}`;
    try {
      const body = await res.json();
      if (body && typeof body.error === 'string') message = body.error;
    } catch {
      /* 回應非 JSON 時保留狀態碼訊息 */
    }
    return { ok: false, status: res.status, retryable, message };
  } catch (error) {
    // 網路層失敗（離線、DNS、逾時）：可重試。
    return {
      ok: false,
      status: 0,
      retryable: true,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

let flushInFlight: Promise<QueueSummary> | null = null;

/**
 * 嘗試送出佇列中所有待處理項目（依建立順序，避免轉帳腳與其收支交錯）。
 * 併發呼叫共用同一個 in-flight promise，避免重複送出。
 */
export async function flushOfflineQueue(): Promise<QueueSummary> {
  if (flushInFlight) return flushInFlight;
  flushInFlight = (async () => {
    const changedScopes = new Set<string>();
    const successfulIds: string[] = [];

    for (const item of pendingItems(readQueue())) {
      const outcome = await sendItem(item);
      if (outcome.ok) {
        successfulIds.push(item.id);
        if (outcome.scope) changedScopes.add(outcome.scope);
        continue;
      }
      const failure = { message: outcome.message || '送出失敗', retryable: outcome.retryable };
      const updated = recordFailure(readQueue(), item.id, failure);
      writeQueue(updated);
      if (!outcome.retryable) {
        // 不可重試（4xx 驗證錯誤）：停止本輪，其餘項目之後再試，讓使用者先處理這筆。
        break;
      }
    }

    if (successfulIds.length > 0) {
      let remaining = readQueue();
      for (const id of successfulIds) remaining = removeItem(remaining, id);
      writeQueue(remaining);
      for (const scope of changedScopes) notifyDataChanged(scope);
    }

    return summarizeQueue(readQueue());
  })();

  try {
    return await flushInFlight;
  } finally {
    flushInFlight = null;
  }
}

/** 已標記失敗、等待使用者決定的項目。 */
export function getFailedItems(): OfflineQueueItem[] {
  return failedItems(readQueue());
}

export function getPendingItems(): OfflineQueueItem[] {
  return pendingItems(readQueue());
}

/**
 * 註冊自動同步：恢復連線時、以及週期性（指數退避）重試。
 * 回傳取消函式。此函式只應在瀏覽器呼叫一次（由 OfflineSyncStatus 元件負責）。
 */
export function startOfflineSync(onSummary: (summary: QueueSummary) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  let timer: ReturnType<typeof setTimeout> | null = null;
  let disposed = false;

  const scheduleNext = () => {
    if (disposed) return;
    if (timer) clearTimeout(timer);
    const pending = pendingItems(readQueue());
    if (pending.length === 0) return;
    const maxAttempts = Math.max(...pending.map((item) => item.attempts));
    timer = setTimeout(() => void run(), retryDelayMs(maxAttempts + 1));
  };

  const run = async () => {
    if (disposed) return;
    if (isOffline()) {
      onSummary(getQueueSummary());
      return;
    }
    const summary = await flushOfflineQueue();
    onSummary(summary);
    scheduleNext();
  };

  const handleOnline = () => void run();
  const handleQueueChange = () => onSummary(getQueueSummary());

  window.addEventListener('online', handleOnline);
  window.addEventListener(OFFLINE_QUEUE_EVENT, handleQueueChange);
  onSummary(getQueueSummary());
  void run();

  return () => {
    disposed = true;
    if (timer) clearTimeout(timer);
    window.removeEventListener('online', handleOnline);
    window.removeEventListener(OFFLINE_QUEUE_EVENT, handleQueueChange);
  };
}
