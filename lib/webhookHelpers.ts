// lib/webhookHelpers.ts — Webhook 訂閱管理、事件投遞、重試與投遞紀錄（issue #258）
//
// 流程：交易異動 → emitTransactionEvent() 產生 delivery 列（status=pending）
//      → runDueWebhookDeliveries() 以 HMAC 簽章 POST 至訂閱網址
//      → 失敗依指數退避重試；達上限或遇永久性錯誤則標記 failed。
// 觸發時機沿用 lib/requestMaintenance.ts 的慣例：只在已驗證的使用者請求中順帶執行，
// 不建立常駐 timer（讓閒置服務不因背景工作而無法休眠）。
import { getDB, queryOne, queryAll, saveDB } from './db';
import { uid } from './userDefaults';
import { toIsoUtc } from './userTime';
import {
  ApiTokenError,
  MAX_WEBHOOK_SUBSCRIPTIONS,
  WEBHOOK_EVENTS,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_DELIVERY_HEADER,
  DELIVERY_TIMEOUT_MS,
  MAX_DELIVERY_ATTEMPTS,
  decryptSecret,
  encryptSecret,
  generateWebhookSecret,
  isRetryableStatus,
  nextRetryAt,
  parseWebhookEvents,
  validateWebhookUrl,
  type WebhookEvent,
} from './apiTokenCore';
import { sendWebhookPayload } from './webhookDelivery';

export {
  WEBHOOK_EVENTS,
  MAX_WEBHOOK_SUBSCRIPTIONS,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_DELIVERY_HEADER,
  ApiTokenError,
  type WebhookEvent,
};

export type WebhookDeliveryStatus = 'pending' | 'success' | 'failed';

const ERROR_MAX = 300;
const DELIVERY_BATCH_SIZE = 20;

export interface WebhookSubscriptionSummary {
  id: string;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  secretPrefix: string;
  createdAt: number;
  updatedAt: number;
  lastSuccessAt: number | null;
  lastFailureAt: number | null;
}

export interface CreateWebhookResult {
  subscription: WebhookSubscriptionSummary;
  /** 簽章密鑰僅在建立時回傳一次，之後不可再查詢。 */
  secret: string;
}

export interface WebhookDeliverySummary {
  id: string;
  subscriptionId: string;
  eventType: string;
  status: WebhookDeliveryStatus;
  attempts: number;
  lastStatusCode: number | null;
  lastError: string;
  createdAt: number;
  updatedAt: number;
  deliveredAt: number | null;
}

interface SubscriptionRow {
  id: string | number;
  user_id?: string | number;
  url: string;
  secret_encrypted: string;
  secret_prefix?: string | number | null;
  events: string | number | null;
  active: string | number;
  created_at: string | number;
  updated_at: string | number;
  last_success_at: string | number | null;
  last_failure_at: string | number | null;
}

interface DeliveryRow {
  id: string | number;
  subscription_id: string | number;
  user_id?: string | number;
  event_type: string;
  payload: string;
  status: string;
  attempts: string | number;
  last_status_code: string | number | null;
  last_error: string | number | null;
  created_at: string | number;
  updated_at: string | number;
  next_retry_at: string | number | null;
  delivered_at: string | number | null;
}

// ── 加密主密鑰 ──

function masterSecret(): string {
  const secret = String(process.env.API_TOKEN_ENCRYPTION_KEY || '').trim();
  if (!secret) {
    throw new ApiTokenError('尚未設定 Webhook 簽章密鑰的加密主密鑰', 500, 'EncryptionKeyMissing');
  }
  return secret;
}

// ── 訂閱管理 ──

function summarize(row: SubscriptionRow): WebhookSubscriptionSummary {
  return {
    id: String(row.id),
    url: String(row.url),
    events: String(row.events || '').split(/\s+/).filter(Boolean) as WebhookEvent[],
    active: Number(row.active) === 1,
    secretPrefix: String(row.secret_prefix || ''),
    createdAt: Number(row.created_at) || 0,
    updatedAt: Number(row.updated_at) || 0,
    lastSuccessAt: Number(row.last_success_at) || null,
    lastFailureAt: Number(row.last_failure_at) || null,
  };
}

export function createWebhookSubscription(
  userId: string,
  url: unknown,
  events: unknown,
): CreateWebhookResult {
  const safeUrl = validateWebhookUrl(url);
  const parsedEvents = parseWebhookEvents(events);

  const countRow = queryOne(
    'SELECT COUNT(*) AS cnt FROM webhook_subscriptions WHERE user_id = ?',
    [userId],
  );
  if ((Number(countRow?.cnt) || 0) >= MAX_WEBHOOK_SUBSCRIPTIONS) {
    throw new ApiTokenError(
      `Webhook 訂閱已達上限（${MAX_WEBHOOK_SUBSCRIPTIONS} 組），請先刪除既有訂閱`,
      400,
      'SubscriptionLimitReached',
    );
  }

  const now = Date.now();
  const id = uid();
  const secret = generateWebhookSecret();
  getDB().run(
    'INSERT INTO webhook_subscriptions (id, user_id, url, secret_encrypted, secret_prefix, events, active, created_at, updated_at, last_success_at, last_failure_at) VALUES (?,?,?,?,?,?,1,?,?,0,0)',
    [id, userId, safeUrl, encryptSecret(secret, masterSecret()), secret.slice(0, 14), parsedEvents.join(' '), now, now],
  );
  saveDB();

  const created = getWebhookSubscription(userId, id);
  if (!created) throw new ApiTokenError('建立 Webhook 訂閱失敗', 500, 'ServerError');
  return { subscription: created, secret };
}

export function getWebhookSubscription(userId: string, id: string): WebhookSubscriptionSummary | null {
  const row = queryOne(
    'SELECT * FROM webhook_subscriptions WHERE id = ? AND user_id = ?',
    [id, userId],
  ) as SubscriptionRow | null;
  return row ? summarize(row) : null;
}

export function listWebhookSubscriptions(userId: string): WebhookSubscriptionSummary[] {
  const rows = queryAll(
    'SELECT * FROM webhook_subscriptions WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
  ) as unknown as SubscriptionRow[];
  return rows.map(summarize);
}

export function updateWebhookSubscription(
  userId: string,
  id: string,
  patch: { url?: unknown; events?: unknown; active?: unknown },
): WebhookSubscriptionSummary | null {
  const fields: string[] = [];
  const params: Array<string | number> = [];

  if ('url' in patch) {
    fields.push('url = ?');
    params.push(validateWebhookUrl(patch.url));
  }
  if ('events' in patch) {
    fields.push('events = ?');
    params.push(parseWebhookEvents(patch.events).join(' '));
  }
  if ('active' in patch) {
    if (typeof patch.active !== 'boolean') {
      throw new ApiTokenError('active 必須為布林值');
    }
    fields.push('active = ?');
    params.push(patch.active ? 1 : 0);
  }
  if (fields.length === 0) {
    throw new ApiTokenError('必須提供 url、events 或 active 其中之一');
  }

  fields.push('updated_at = ?');
  params.push(Date.now(), id, userId);
  const db = getDB();
  db.run(`UPDATE webhook_subscriptions SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`, params);
  if (db.getRowsModified() === 0) return null;
  saveDB();
  return getWebhookSubscription(userId, id);
}

export function deleteWebhookSubscription(userId: string, id: string): boolean {
  const db = getDB();
  db.run('DELETE FROM webhook_deliveries WHERE subscription_id = ? AND user_id = ?', [id, userId]);
  db.run('DELETE FROM webhook_subscriptions WHERE id = ? AND user_id = ?', [id, userId]);
  const hit = db.getRowsModified() > 0;
  saveDB();
  return hit;
}

// ── 投遞紀錄查詢 ──

export function listWebhookDeliveries(
  userId: string,
  options: { subscriptionId?: string; limit?: number } = {},
): WebhookDeliverySummary[] {
  const limit = Math.min(Math.max(Number(options.limit) || 50, 1), 200);
  const rows = options.subscriptionId
    ? (queryAll(
        'SELECT * FROM webhook_deliveries WHERE user_id = ? AND subscription_id = ? ORDER BY created_at DESC LIMIT ?',
        [userId, options.subscriptionId, limit],
      ) as unknown as DeliveryRow[])
    : (queryAll(
        'SELECT * FROM webhook_deliveries WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
        [userId, limit],
      ) as unknown as DeliveryRow[]);
  return rows.map((row) => ({
    id: String(row.id),
    subscriptionId: String(row.subscription_id),
    eventType: String(row.event_type),
    status: String(row.status) as WebhookDeliveryStatus,
    attempts: Number(row.attempts) || 0,
    lastStatusCode: Number(row.last_status_code) || null,
    lastError: String(row.last_error || ''),
    createdAt: Number(row.created_at) || 0,
    updatedAt: Number(row.updated_at) || 0,
    deliveredAt: Number(row.delivered_at) || null,
  }));
}

// ── 事件排出（enqueue）──

export interface TransactionEventPayload {
  id: string;
  type: string;
  amount: number;
  date: string;
  accountId: string | null;
  categoryId: string | null;
  note: string;
}

export interface WebhookEventEnvelope {
  id: string;
  type: WebhookEvent;
  createdAt: string;
  data: Record<string, unknown>;
}

/**
 * 針對某事件建立投遞列；只排給訂閱該事件且啟用中的訂閱。
 * 回傳建立的 delivery 數量，方便呼叫端與測試驗證。
 */
export function enqueueWebhookEvent(
  userId: string,
  eventType: WebhookEvent,
  data: Record<string, unknown>,
  now: number = Date.now(),
): number {
  const subs = queryAll(
    'SELECT id, events FROM webhook_subscriptions WHERE user_id = ? AND active = 1',
    [userId],
  ) as unknown as Array<{ id: string | number; events: string | number | null }>;

  let enqueued = 0;
  for (const sub of subs) {
    const events = String(sub.events || '').split(/\s+/).filter(Boolean);
    if (!events.includes(eventType)) continue;

    const envelope: WebhookEventEnvelope = {
      id: uid(),
      type: eventType,
      createdAt: toIsoUtc(now),
      data,
    };
    getDB().run(
      'INSERT INTO webhook_deliveries (id, subscription_id, user_id, event_type, payload, status, attempts, last_status_code, last_error, response_body, created_at, updated_at, next_retry_at, delivered_at) VALUES (?,?,?,?,?,?,0,0,?,?,?,?,0,0)',
      [envelope.id, String(sub.id), userId, eventType, JSON.stringify(envelope), 'pending', '', '', now, now],
    );
    enqueued += 1;
  }
  if (enqueued > 0) saveDB();
  return enqueued;
}

// ── 投遞執行與重試 ──

interface DeliveryAttemptOutcome {
  ok: boolean;
  statusCode: number;
  responseBody: string;
  error: string;
  /** false 表示失敗具永久性（被安全政策阻擋），呼叫端不得排程重試。 */
  retryable: boolean;
}

async function postDelivery(
  url: string,
  secret: string,
  deliveryId: string,
  eventType: string,
  rawBody: string,
): Promise<DeliveryAttemptOutcome> {
  // 實際傳送交由 lib/webhookDelivery.ts：送出前重新驗證目標與 DNS 解析結果、
  // 以解析出的位址直接連線（防 DNS rebinding），並拒絕任何重新導向（issue #285）。
  const result = await sendWebhookPayload({ url, secret, deliveryId, eventType, rawBody });
  return {
    ok: result.ok,
    statusCode: result.statusCode,
    responseBody: result.responseBody,
    error: result.error.slice(0, ERROR_MAX),
    // 被安全政策阻擋者屬於永久性失敗：重試只會再次被同一規則擋下，因此不排程重試。
    retryable: !result.blocked,
  };
}

/**
 * 嘗試投遞單筆紀錄。成功 → success；失敗 → 依退避排程重試或標記 failed。
 * 回傳最終狀態，供測試與呼叫端使用。
 */
export async function attemptWebhookDelivery(
  deliveryId: string,
  now: number = Date.now(),
): Promise<WebhookDeliveryStatus> {
  const delivery = queryOne(
    'SELECT * FROM webhook_deliveries WHERE id = ?',
    [deliveryId],
  ) as DeliveryRow | null;
  if (!delivery) return 'failed';

  const sub = queryOne(
    'SELECT * FROM webhook_subscriptions WHERE id = ?',
    [String(delivery.subscription_id)],
  ) as SubscriptionRow | null;
  if (!sub) {
    getDB().run(
      'UPDATE webhook_deliveries SET status = ?, last_error = ?, updated_at = ? WHERE id = ?',
      ['failed', '訂閱已不存在', now, deliveryId],
    );
    saveDB();
    return 'failed';
  }

  const attempts = (Number(delivery.attempts) || 0) + 1;
  const payload = String(delivery.payload);
  let outcome: DeliveryAttemptOutcome;
  let secret: string;
  try {
    secret = decryptSecret(String(sub.secret_encrypted), masterSecret());
  } catch (e) {
    // 主金鑰被更換或資料損毀時無法再簽章，此訂閱已不可能成功投遞；
    // 直接永久失敗，並在錯誤訊息標明原因，避免無意義地重試 5 次。
    const reason = `無法解密簽章密鑰（請重新建立此 Webhook 訂閱）：${(e instanceof Error ? e.message : String(e)).slice(0, ERROR_MAX)}`;
    getDB().run(
      'UPDATE webhook_deliveries SET status = ?, attempts = ?, last_error = ?, updated_at = ?, next_retry_at = 0 WHERE id = ?',
      ['failed', attempts, reason, now, deliveryId],
    );
    getDB().run('UPDATE webhook_subscriptions SET last_failure_at = ?, updated_at = ? WHERE id = ?', [
      now,
      now,
      String(sub.id),
    ]);
    saveDB();
    return 'failed';
  }

  try {
    outcome = await postDelivery(String(sub.url), secret, deliveryId, String(delivery.event_type), payload);
  } catch (e) {
    outcome = {
      ok: false,
      statusCode: 0,
      responseBody: '',
      error: (e instanceof Error ? e.message : String(e)).slice(0, ERROR_MAX),
      retryable: true,
    };
  }

  const db = getDB();
  if (outcome.ok) {
    db.run(
      'UPDATE webhook_deliveries SET status = ?, attempts = ?, last_status_code = ?, last_error = ?, response_body = ?, updated_at = ?, next_retry_at = 0, delivered_at = ? WHERE id = ?',
      ['success', attempts, outcome.statusCode, '', outcome.responseBody, now, now, deliveryId],
    );
    db.run('UPDATE webhook_subscriptions SET last_success_at = ?, updated_at = ? WHERE id = ?', [
      now,
      now,
      String(sub.id),
    ]);
    saveDB();
    return 'success';
  }

  const retryAt =
    outcome.retryable && isRetryableStatus(outcome.statusCode) ? nextRetryAt(attempts, now) : null;
  if (retryAt == null) {
    db.run(
      'UPDATE webhook_deliveries SET status = ?, attempts = ?, last_status_code = ?, last_error = ?, response_body = ?, updated_at = ?, next_retry_at = 0 WHERE id = ?',
      ['failed', attempts, outcome.statusCode, outcome.error, outcome.responseBody, now, deliveryId],
    );
    db.run('UPDATE webhook_subscriptions SET last_failure_at = ?, updated_at = ? WHERE id = ?', [
      now,
      now,
      String(sub.id),
    ]);
    saveDB();
    return 'failed';
  }

  db.run(
    'UPDATE webhook_deliveries SET status = ?, attempts = ?, last_status_code = ?, last_error = ?, response_body = ?, updated_at = ?, next_retry_at = ? WHERE id = ?',
    ['pending', attempts, outcome.statusCode, outcome.error, outcome.responseBody, now, retryAt, deliveryId],
  );
  saveDB();
  return 'pending';
}

/**
 * 掃描並投遞所有到期的待處理紀錄（含重試）。
 * 由已驗證的使用者請求觸發（見 lib/transactionWebhooks.ts 與 requestMaintenance 慣例）。
 *
 * 以「原子認領」避免多個請求同時掃到同一列而重複投遞：先把 next_retry_at 往後推
 * 作為租約，只有認領成功的請求才會實際投遞。程序若在投遞中斷，該列仍會在租約到期後
 * （最多 2 倍逾時）被重新拾起，不會永久卡住。
 */
export async function runDueWebhookDeliveries(now: number = Date.now()): Promise<number> {
  const rows = queryAll(
    "SELECT id, attempts, next_retry_at FROM webhook_deliveries WHERE status = 'pending' AND attempts < ? AND (next_retry_at = 0 OR next_retry_at <= ?) ORDER BY created_at ASC LIMIT ?",
    [MAX_DELIVERY_ATTEMPTS, now, DELIVERY_BATCH_SIZE],
  ) as unknown as Array<{ id: string | number; attempts: string | number; next_retry_at: string | number | null }>;

  const db = getDB();
  const claimedUntil = now + DELIVERY_TIMEOUT_MS * 2;
  let processed = 0;
  for (const row of rows) {
    db.run(
      "UPDATE webhook_deliveries SET next_retry_at = ? WHERE id = ? AND status = 'pending' AND next_retry_at = ?",
      [claimedUntil, String(row.id), Number(row.next_retry_at) || 0],
    );
    if (db.getRowsModified() === 0) continue; // 已被其他請求認領
    await attemptWebhookDelivery(String(row.id), now);
    processed += 1;
  }
  return processed;
}

function isoOrNull(ms: number | null): string | null {
  return ms == null ? null : toIsoUtc(ms);
}

export function serializeWebhookSubscription(s: WebhookSubscriptionSummary) {
  return {
    id: s.id,
    url: s.url,
    events: s.events,
    active: s.active,
    secretPrefix: s.secretPrefix,
    createdAt: toIsoUtc(s.createdAt),
    updatedAt: toIsoUtc(s.updatedAt),
    lastSuccessAt: isoOrNull(s.lastSuccessAt),
    lastFailureAt: isoOrNull(s.lastFailureAt),
  };
}

export function serializeWebhookDelivery(d: WebhookDeliverySummary) {
  return {
    id: d.id,
    subscriptionId: d.subscriptionId,
    eventType: d.eventType,
    status: d.status,
    attempts: d.attempts,
    lastStatusCode: d.lastStatusCode,
    lastError: d.lastError,
    createdAt: toIsoUtc(d.createdAt),
    updatedAt: toIsoUtc(d.updatedAt),
    deliveredAt: isoOrNull(d.deliveredAt),
  };
}
