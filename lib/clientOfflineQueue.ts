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
import { getActiveLedgerId, notifyDataChanged } from './clientApi';

const STORAGE_PREFIX = 'assetpilot.offlineQueue';
/** 舊版未區分使用者的固定鍵；登入時一次性清除，避免跨使用者殘留財務資料。 */
const LEGACY_STORAGE_KEY = 'assetpilot.offlineQueue.v1';
/** 跨分頁共享 auth cookie 的身份變更通知（值只含 user id／nonce，不含財務資料）。 */
export const OFFLINE_QUEUE_AUTH_SIGNAL = 'assetpilot.offlineQueue.auth';

// 目前登入使用者。佇列以使用者區分，避免共用裝置上把前一位使用者的財務資料
// 在下一位使用者登入後送出（見 setOfflineQueueUser）。
let activeUserId: string | null = null;

function storageKey(): string {
  return activeUserId ? `${STORAGE_PREFIX}.${activeUserId}` : STORAGE_PREFIX;
}

function publishAuthSignal(userId: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      OFFLINE_QUEUE_AUTH_SIGNAL,
      JSON.stringify({ userId, nonce: `${Date.now()}-${Math.random()}` }),
    );
  } catch {
    /* 無法跨分頁通知時，本分頁仍依 activeUserId 停止同步 */
  }
}

/**
 * 綁定（或解除）目前登入使用者，並在切換使用者時清除前一位使用者尚未同步的資料。
 *
 * 佇列含金額、日期、備註與帳戶／分類 id 等財務內容；共享 cookie 的其他分頁若登入不同
 * 使用者，也必須停用舊分頁同步，避免舊佇列被新 session 送出。
 */
export function setOfflineQueueUser(
  userId: string | null,
  options: { broadcast?: boolean } = {},
): void {
  const next = userId ? String(userId) : null;
  const broadcast = options.broadcast !== false;
  if (next === activeUserId) {
    if (broadcast) publishAuthSignal(next);
    return;
  }
  if (typeof window !== 'undefined') {
    try {
      // 移除未綁定使用者的 base key 與舊版固定 key，避免登出後在匿名狀態下再次入列。
      window.localStorage.removeItem(STORAGE_PREFIX);
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      // 直接切換登入者時清除舊使用者佇列；登出（next=null）則先保留本人 key，讓同一
      // 使用者重新登入可恢復未同步項目。下一位使用者登入時會清除所有其他 user keys。
      if (activeUserId && next && next !== activeUserId) {
        window.localStorage.removeItem(`${STORAGE_PREFIX}.${activeUserId}`);
      }
      if (next) {
        const keepKey = `${STORAGE_PREFIX}.${next}`;
        const staleKeys: string[] = [];
        for (let i = 0; i < window.localStorage.length; i += 1) {
          const key = window.localStorage.key(i);
          if (
            key?.startsWith(`${STORAGE_PREFIX}.`) &&
            key !== LEGACY_STORAGE_KEY &&
            key !== OFFLINE_QUEUE_AUTH_SIGNAL &&
            key !== keepKey
          ) {
            staleKeys.push(key);
          }
        }
        for (const key of staleKeys) window.localStorage.removeItem(key);
      }
    } catch {
      /* 儲存空間不可用時仍切換記憶體身分；未綁定 user id 時同步會 fail closed */
    }
    activeUserId = next;
    window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT));
  } else {
    activeUserId = next;
  }
  if (broadcast) publishAuthSignal(next);
}

/** 登出時先停用本頁佇列並通知其他分頁，防止共用 cookie 切換身分後仍送出舊資料。 */
export function notifyOfflineQueueLogout(): void {
  setOfflineQueueUser(null);
}

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
    return parseQueue(window.localStorage.getItem(storageKey()));
  } catch {
    return [];
  }
}

/** 寫入並回讀驗證；回傳是否確實持久化（供呼叫端決定能否顯示「已儲存」）。 */
function writeQueue(items: OfflineQueueItem[], syncItemId?: string): boolean {
  if (typeof window === 'undefined') return false;
  let persisted = false;
  try {
    const key = storageKey();
    const serialized = serializeQueue(items);
    window.localStorage.setItem(key, serialized);
    // 回讀驗證：儲存空間不可用（SecurityError）或配額不足時 setItem 可能靜默失敗，
    // 若不驗證就會對使用者謊稱「已離線儲存」而實際遺失資料。
    persisted = window.localStorage.getItem(key) === serialized;
  } catch {
    persisted = false;
  }
  window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT, { detail: { syncItemId } }));
  return persisted;
}

export function getQueue(): OfflineQueueItem[] {
  return readQueue();
}

export function getQueueSummary(): QueueSummary {
  return summarizeQueue(readQueue());
}

/**
 * 把一筆交易／轉帳排入離線佇列。
 * 回傳產生的項目與是否確實寫入本機儲存；`persisted` 為 false 時呼叫端必須改以
 * 錯誤提示（而非「已離線儲存」），否則使用者會誤以為交易已保存而實際遺失。
 */
export function enqueueOffline(
  kind: OfflineQueueKind,
  payload: Record<string, unknown>,
  id?: string,
): { item: OfflineQueueItem; persisted: boolean } {
  const item = createQueueItem({
    kind,
    payload,
    now: Date.now(),
    id,
    ledgerId: getActiveLedgerId() || undefined,
  });
  // 未綁定已驗證使用者（登出／跨分頁身分切換期間）一律 fail closed，不能寫入
  // 共用 base key，否則下一位使用者可能在不知情下收到這筆離線交易。
  if (!activeUserId) return { item, persisted: false };
  const current = readQueue();
  if (current.some((existing) => existing.id === item.id)) return { item, persisted: true };
  const next = enqueue(current, item);
  if (next === current) return { item, persisted: false };
  const persisted = writeQueue(next, item.id);
  return { item, persisted };
}

export function discardItem(id: string): void {
  writeQueue(removeItem(readQueue(), id));
}

export function retryItem(id: string): void {
  writeQueue(resetForRetry(readQueue(), id));
  void flushOfflineQueue(new Set([id]));
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
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (item.ledgerId) headers['x-ledger-id'] = item.ledgerId;
    const res = await fetch(endpoint.url, {
      method: 'POST',
      credentials: 'include',
      headers,
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
export async function flushOfflineQueue(onlyIds?: Set<string>): Promise<QueueSummary> {
  if (flushInFlight) return flushInFlight;
  flushInFlight = (async () => {
    const ownerId = activeUserId;
    const changedScopes = new Set<string>();
    const successfulIds: string[] = [];
    const candidates = ownerId
      ? pendingItems(readQueue()).filter((item) => !onlyIds || onlyIds.has(item.id))
      : [];

    for (const item of candidates) {
      // 登出／另一個分頁切換帳號時，不可把舊使用者佇列的後續項目帶到新 session。
      if (!ownerId || activeUserId !== ownerId) break;
      const outcome = await sendItem(item);
      if (activeUserId !== ownerId) break;
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

    if (successfulIds.length > 0 && activeUserId === ownerId) {
      let remaining = readQueue();
      for (const id of successfulIds) remaining = removeItem(remaining, id);
      writeQueue(remaining);
      // 僅在離線同步成功時派送專用 scope：TransactionsClient 會刷新交易清單；
      // 一般線上儲存路徑已自行 reload，不能共用同一個 scope 以免重複請求／舊頁覆寫。
      for (const scope of changedScopes) notifyDataChanged(`${scope}:offline-sync`);
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
    timer = setTimeout(() => void run(), retryDelayMs(maxAttempts));
  };

  const run = async () => {
    if (disposed) return;
    // Fail closed while logged out or before the authenticated user is bound.
    if (!activeUserId) {
      onSummary({ pending: 0, failed: 0, total: 0 });
      return;
    }
    if (isOffline()) {
      onSummary(getQueueSummary());
      return;
    }
    const summary = await flushOfflineQueue();
    onSummary(summary);
    scheduleNext();
  };

  const handleOnline = () => void run();
  const handleQueueChange = (event: Event) => {
    const summary = getQueueSummary();
    onSummary(summary);
    const syncItemId = (event as CustomEvent<{ syncItemId?: string }>).detail?.syncItemId;
    if (!syncItemId || isOffline()) return;

    if (!flushInFlight) {
      void run();
      return;
    }

    // If an enqueue happened while an unrelated flush was already in-flight, that flush's
    // candidate snapshot cannot contain the new id. Wait for it, then send this item alone
    // so transient network failures do not leave it pending until a future `online` event.
    void (async () => {
      const currentFlush = flushInFlight;
      if (currentFlush) await currentFlush.catch(() => undefined);
      await Promise.resolve();
      if (disposed || isOffline() || !pendingItems(readQueue()).some((item) => item.id === syncItemId)) return;
      const next = await flushOfflineQueue(new Set([syncItemId]));
      onSummary(next);
      scheduleNext();
    })();
  };

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
