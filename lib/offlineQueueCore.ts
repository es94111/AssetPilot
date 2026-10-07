/**
 * 純模組：離線記帳佇列的資料結構與同步決策邏輯。
 *
 * 本模組不得 import 任何瀏覽器 API（localStorage／navigator／fetch）或伺服器端相依，
 * 以便在無瀏覽器環境（`npm test` 的 node 測試）直接驗證。實際的持久化與網路送出
 * 由 `lib/clientOfflineQueue.ts`（client-only）負責，本模組只做「資料形狀」與
 * 「該不該重試／怎麼退避」的決策。
 *
 * 同步衝突策略（FR 定義，刻意明確定義而非留白）：
 *   1. 離線新增的交易一律帶一個 client 產生的 `clientRef`（idempotency key）。
 *      伺服器以 `(user_id, client_ref)` 唯一鍵去重，因此重送不會產生重複資料——
 *      這是「伺服器為最後寫入權威」的基礎。
 *   2. 可重試的失敗（連線錯誤、429、5xx）留在佇列中以指數退避重試。
 *   3. 不可重試的失敗（4xx 驗證錯誤，例如帳戶已被刪除或信用卡已停用）標記為
 *      `failed`，不再自動重送，改由使用者介面提示並讓使用者選擇「重試」或「捨棄」。
 *      —— 對應驗收條件「同步衝突處理策略需明確定義（以最後寫入或提示使用者選擇）」。
 */

/** 佇列項目種類。轉帳與一般收支分開，因兩者打不同端點且驗證條件不同。 */
export type OfflineQueueKind = 'transaction' | 'transfer';

/** 佇列項目狀態：待送出、已標記失敗（等待使用者決定）、已同步成功（僅短暫存在）。 */
export type OfflineQueueStatus = 'pending' | 'failed';

export interface OfflineQueueItem {
  /** client 產生的 idempotency key，同時作為本地識別碼。 */
  id: string;
  kind: OfflineQueueKind;
  /** 建立佇列項目時選取的帳本；舊項目省略時安全地送至個人帳本。 */
  ledgerId?: string;
  /** 送出時原樣 POST 的請求本體。 */
  payload: Record<string, unknown>;
  /** 建立時間（epoch ms）。 */
  createdAt: number;
  /** 已嘗試送出次數（第一次送出前為 0）。 */
  attempts: number;
  status: OfflineQueueStatus;
  /** 最後一次失敗訊息，供 UI 顯示。 */
  lastError?: string;
}

/** 自動重試次數上限；超過即轉為 failed，交由使用者決定。 */
export const MAX_AUTO_ATTEMPTS = 5;

/** 指數退避基準與上限（毫秒）。 */
export const RETRY_BASE_DELAY_MS = 5_000;
export const RETRY_MAX_DELAY_MS = 5 * 60 * 1000;

/** 佇列容量上限，避免 localStorage 被單一裝置灌爆。 */
export const MAX_QUEUE_SIZE = 200;

/** 產生 client 端 idempotency key（32 碼十六進位，與伺服器 uid() 形狀一致）。 */
export function newQueueId(random: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < 32; i += 1) {
    out += Math.floor(random() * 16).toString(16);
  }
  return out;
}

export interface CreateQueueItemInput {
  kind: OfflineQueueKind;
  payload: Record<string, unknown>;
  now: number;
  id?: string;
  ledgerId?: string;
}

export function createQueueItem(input: CreateQueueItemInput): OfflineQueueItem {
  return {
    id: input.id ?? newQueueId(),
    kind: input.kind,
    ...(input.ledgerId ? { ledgerId: input.ledgerId } : {}),
    payload: input.payload,
    createdAt: input.now,
    attempts: 0,
    status: 'pending',
  };
}

function isQueueKind(value: unknown): value is OfflineQueueKind {
  return value === 'transaction' || value === 'transfer';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** 解析單一項目；形狀不合法回傳 null（外來資料一律不信任）。 */
export function parseQueueItem(value: unknown): OfflineQueueItem | null {
  if (!isRecord(value)) return null;
  const { id, kind, payload, createdAt, attempts, status, lastError, ledgerId } = value;
  if (typeof id !== 'string' || id.length === 0) return null;
  if (!isQueueKind(kind)) return null;
  if (!isRecord(payload)) return null;
  const created = Number(createdAt);
  if (!Number.isFinite(created) || created <= 0) return null;
  const attemptCount = Number(attempts);
  const normalizedStatus: OfflineQueueStatus = status === 'failed' ? 'failed' : 'pending';
  const item: OfflineQueueItem = {
    id,
    kind,
    ...(typeof ledgerId === 'string' && ledgerId ? { ledgerId } : {}),
    payload,
    createdAt: created,
    attempts: Number.isFinite(attemptCount) && attemptCount > 0 ? Math.floor(attemptCount) : 0,
    status: normalizedStatus,
  };
  if (typeof lastError === 'string' && lastError) item.lastError = lastError;
  return item;
}

/** 解析整個佇列字串；任何破損一律容忍並丟棄，不讓壞資料擋住 App。 */
export function parseQueue(raw: string | null | undefined): OfflineQueueItem[] {
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const items: OfflineQueueItem[] = [];
  const seen = new Set<string>();
  for (const entry of parsed) {
    const item = parseQueueItem(entry);
    if (!item || seen.has(item.id)) continue;
    seen.add(item.id);
    items.push(item);
  }
  return items;
}

export function serializeQueue(items: OfflineQueueItem[]): string {
  return JSON.stringify(items);
}

/**
/** Add an item without ever discarding previously persisted financial entries. */
export function enqueue(items: OfflineQueueItem[], item: OfflineQueueItem): OfflineQueueItem[] {
  if (items.some((existing) => existing.id === item.id)) return items;
  if (items.length >= MAX_QUEUE_SIZE) return items;
  return [...items, item];
}

export function removeItem(items: OfflineQueueItem[], id: string): OfflineQueueItem[] {
  return items.filter((item) => item.id !== id);
}

/** 依狀態篩選。 */
export function pendingItems(items: OfflineQueueItem[]): OfflineQueueItem[] {
  return items.filter((item) => item.status === 'pending');
}

export function failedItems(items: OfflineQueueItem[]): OfflineQueueItem[] {
  return items.filter((item) => item.status === 'failed');
}

/**
 * 記錄一次送出失敗。累積嘗試次數，超過上限或遇到不可重試錯誤時標記為 failed。
 */
export function recordFailure(
  items: OfflineQueueItem[],
  id: string,
  error: { message: string; retryable: boolean },
): OfflineQueueItem[] {
  return items.map((item) => {
    if (item.id !== id) return item;
    const attempts = item.attempts + 1;
    const status: OfflineQueueStatus = error.retryable && attempts < MAX_AUTO_ATTEMPTS ? 'pending' : 'failed';
    return { ...item, attempts, status, lastError: error.message };
  });
}

/** 使用者選擇「重試」時把項目標回 pending，並重置嘗試次數。 */
export function resetForRetry(items: OfflineQueueItem[], id: string): OfflineQueueItem[] {
  return items.map((item) => {
    if (item.id !== id) return item;
    const { lastError: _lastError, ...rest } = item;
    return { ...rest, status: 'pending' as const, attempts: 0 };
  });
}

/** 指數退避延遲：base * 2^(attempts-1)，上限 RETRY_MAX_DELAY_MS。 */
export function retryDelayMs(attempts: number): number {
  const exponent = Math.max(0, Math.floor(attempts) - 1);
  return Math.min(RETRY_BASE_DELAY_MS * 2 ** exponent, RETRY_MAX_DELAY_MS);
}

/**
 * 判斷 HTTP 狀態碼是否值得自動重試。
 * - 0（網路層失敗／離線）與 408／425／429 與 5xx：可重試
 * - 其餘 4xx：請求本身有問題，重送也不會成功 → 交給使用者決定
 */
export function isRetryableStatus(status: number): boolean {
  if (!Number.isFinite(status) || status <= 0) return true;
  if (status === 408 || status === 425 || status === 429) return true;
  return status >= 500;
}

export interface QueueSummary {
  pending: number;
  failed: number;
  total: number;
}

export function summarizeQueue(items: OfflineQueueItem[]): QueueSummary {
  let pending = 0;
  let failed = 0;
  for (const item of items) {
    if (item.status === 'failed') failed += 1;
    else pending += 1;
  }
  return { pending, failed, total: items.length };
}
