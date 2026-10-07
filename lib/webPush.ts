// lib/webPush.ts — Web Push 訂閱管理與通知發送（issue #257）
//
// 對外行為：
//   - 訂閱／解除訂閱：瀏覽器 PushSubscription → web_push_subscriptions 表
//   - 通知種類開關：user_settings.push_bill_due / push_budget_exceeded / push_dividend
//   - 冪等發送：先寫 web_push_send_log（UNIQUE (user_id, category, event_key)），
//     衝突即視為「已推播過」直接跳過，與 monthly_report_send_log 的去重設計一致
//   - 失效訂閱自動清除：push service 回 404/410 立即刪除；連續失敗達門檻則停用
//
// 觸發時機沿用 lib/requestMaintenance.ts 慣例（只在已驗證的使用者請求中順帶執行），
// 不建立常駐 timer，讓閒置服務不因背景工作而無法休眠。

import crypto from 'crypto';
import { getDB, queryAll, queryOne, saveDB } from './db';
import { getTranslator } from './i18n/getDictionary';
import { getUserLanguage } from './i18n/userLanguage';
import { toIsoUtc } from './userTime';
import { uid } from './userDefaults';
import { getVapidKeys, getVapidSubject, isWebPushConfigured } from './webPushConfig';
import {
  MAX_PUSH_FAILURES,
  PUSH_CATEGORIES,
  PushSubscriptionError,
  buildPushPayload,
  defaultPushPreferences,
  endpointHost,
  eventKeyOf,
  isExpiredSubscriptionStatus,
  nextFailureCount,
  normalizePushSubscription,
  readPushPreferences,
  serializePushPayload,
  shouldDisableSubscription,
  type PushCategory,
  type PushEvent,
  type PushPreferences,
  type RawPushSubscription,
} from './webPushCore';

export {
  MAX_PUSH_FAILURES,
  PUSH_CATEGORIES,
  PushSubscriptionError,
  defaultPushPreferences,
  type PushCategory,
  type PushEvent,
  type PushPreferences,
};

/** 單一使用者的訂閱數上限（避免單一帳號累積大量端點）。 */
export const MAX_PUSH_SUBSCRIPTIONS = 20;

const PAYLOAD_MAX_BYTES = 4096;

/** user_settings 的開關欄位名稱（單一來源，避免各處硬寫字串）。 */
export const PUSH_CATEGORY_COLUMNS: Record<PushCategory, string> = {
  bill_due: 'push_bill_due',
  budget_exceeded: 'push_budget_exceeded',
  dividend: 'push_dividend',
};

interface SubscriptionRow {
  id: string | number;
  user_id?: string | number;
  endpoint?: string;
  p256dh?: string;
  auth?: string;
  user_agent?: string | number | null;
  created_at?: string | number;
  updated_at?: string | number;
  last_success_at?: string | number | null;
  failure_count?: string | number | null;
  disabled_at?: string | number | null;
}

// web-push 為 CommonJS 套件（相依 node 內建模組）。以動態 import 延遲載入，
// 讓模組圖只在使用推播時才展開（與 lib/transactionAttachments.ts 對 sharp 的處理相同）。
type WebPushModule = typeof import('web-push');

/** 發送單一訂閱的實作；抽換點讓測試能以假 transport 驗證失效清理與失敗計數。 */
export type PushTransport = (
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payloadJson: string,
) => Promise<void>;

let webPushPromise: Promise<WebPushModule> | null = null;

async function loadWebPush(): Promise<WebPushModule> {
  if (!webPushPromise) {
    webPushPromise = import('web-push')
      .then((mod) => {
        const webpush = (mod as unknown as { default?: WebPushModule }).default ?? mod;
        // VAPID 金鑰來自環境變數，見 lib/webPushConfig.ts（首啟自動產生並持久化）。
        const keys = getVapidKeys();
        webpush.setVapidDetails(getVapidSubject(), keys.publicKey, keys.privateKey);
        return webpush;
      })
      .catch((error: unknown) => {
        webPushPromise = null;
        throw error;
      });
  }
  return webPushPromise;
}

let pushTransport: PushTransport | null = null;

const defaultPushTransport: PushTransport = async (subscription, payloadJson) => {
  const webpush = await loadWebPush();
  await webpush.sendNotification(subscription, payloadJson, { TTL: 60 * 60 * 12, urgency: 'normal' });
};

async function sendToSubscription(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payloadJson: string,
): Promise<void> {
  const transport = pushTransport ?? defaultPushTransport;
  await transport(subscription, payloadJson);
}

/** 測試用：抽換發送實作（傳 null 還原為真正的 web-push）。 */
export function __setPushTransportForTests(transport: PushTransport | null): void {
  pushTransport = transport;
}

// ── 通知開關 ──

export function getUserPushPreferences(userId: string): PushPreferences {
  const row = queryOne(
    'SELECT push_bill_due, push_budget_exceeded, push_dividend FROM user_settings WHERE user_id = ?',
    [userId],
  );
  return readPushPreferences(row as Record<string, unknown> | null);
}

/** 更新單一通知種類的開關；兼容未建立 user_settings 列的舊使用者。 */
export function setUserPushPreference(userId: string, category: PushCategory, enabled: boolean): void {
  const column = PUSH_CATEGORY_COLUMNS[category];
  getDB().run(
    'INSERT INTO user_settings (user_id, updated_at) VALUES (?,?) ON CONFLICT (user_id) DO NOTHING',
    [userId, Date.now()],
  );
  getDB().run(
    `UPDATE user_settings SET ${column} = ?, updated_at = ? WHERE user_id = ?`,
    [enabled ? 1 : 0, Date.now(), userId],
  );
  saveDB();
}

// ── 訂閱管理 ──

export function countActiveSubscriptions(userId: string): number {
  const row = queryOne(
    'SELECT COUNT(*) AS cnt FROM web_push_subscriptions WHERE user_id = ? AND disabled_at = 0',
    [userId],
  );
  return Number(row?.cnt) || 0;
}

/**
 * 建立或更新訂閱（相同 endpoint 重複訂閱＝更新，因此可安全重送）。
 * 上限檢查只在「新增」時生效，重新訂閱既有端點不受上限影響。
 */
export function savePushSubscription(
  userId: string,
  raw: RawPushSubscription | null | undefined,
  userAgent = '',
): { id: string; created: boolean } {
  const normalized = normalizePushSubscription(raw);
  const existing = queryOne(
    'SELECT id, user_id, disabled_at FROM web_push_subscriptions WHERE endpoint = ?',
    [normalized.endpoint],
  ) as SubscriptionRow | null;
  const now = Date.now();
  const ua = String(userAgent || '').slice(0, 300);

  if (existing?.id) {
    const alreadyActiveForUser = String(existing.user_id) === userId && Number(existing.disabled_at) === 0;
    // Reactivating a disabled endpoint or moving it from another account adds one active
    // subscription to this user; enforce the same cap as a fresh endpoint before updating.
    if (!alreadyActiveForUser && countActiveSubscriptions(userId) >= MAX_PUSH_SUBSCRIPTIONS) {
      throw new PushSubscriptionError(`訂閱裝置數已達上限（${MAX_PUSH_SUBSCRIPTIONS}）`);
    }
    // 同一端點可能先前屬於其他使用者（共用裝置換人登入）：一律改綁到目前使用者，
    // 避免前一位使用者的通知繼續送到該裝置。
    getDB().run(
      'UPDATE web_push_subscriptions SET user_id = ?, p256dh = ?, auth = ?, user_agent = ?, updated_at = ?, disabled_at = 0, failure_count = 0 WHERE id = ?',
      [userId, normalized.p256dh, normalized.auth, ua, now, String(existing.id)],
    );
    saveDB();
    return { id: String(existing.id), created: false };
  }

  if (countActiveSubscriptions(userId) >= MAX_PUSH_SUBSCRIPTIONS) {
    throw new PushSubscriptionError(`訂閱裝置數已達上限（${MAX_PUSH_SUBSCRIPTIONS}）`);
  }

  const id = uid();
  getDB().run(
    'INSERT INTO web_push_subscriptions (id, user_id, endpoint, p256dh, auth, user_agent, created_at, updated_at, last_success_at, failure_count, disabled_at) VALUES (?,?,?,?,?,?,?,?,0,0,0)',
    [id, userId, normalized.endpoint, normalized.p256dh, normalized.auth, ua, now, now],
  );
  saveDB();
  return { id, created: true };
}

/** 解除訂閱：僅能刪除自己的訂閱（endpoint 為瀏覽器提供值，必須同時比對 user_id）。 */
export function removePushSubscription(userId: string, endpoint: unknown): number {
  const value = String(endpoint ?? '').trim();
  if (!value) return 0;
  const db = getDB();
  db.run('DELETE FROM web_push_subscriptions WHERE user_id = ? AND endpoint = ?', [userId, value]);
  const removed = db.getRowsModified();
  saveDB();
  return removed;
}

/** 以列 id 解除訂閱（設定頁刪除其他裝置用；仍限制只能刪除自己的列）。 */
export function removePushSubscriptionById(userId: string, id: unknown): number {
  const value = String(id ?? '').trim();
  if (!value) return 0;
  const db = getDB();
  db.run('DELETE FROM web_push_subscriptions WHERE user_id = ? AND id = ?', [userId, value]);
  const removed = db.getRowsModified();
  saveDB();
  return removed;
}

export interface PushSubscriptionSummary {
  id: string;
  endpointHost: string;
  userAgent: string;
  createdAt: number;
  lastSuccessAt: number | null;
  failureCount: number;
  disabled: boolean;
  isCurrent: boolean;
}

/** 列出訂閱；完整端點不回傳前端，只回傳是否符合本次請求的本機端點。 */
export function listPushSubscriptions(userId: string, currentEndpoint = ''): PushSubscriptionSummary[] {
  const rows = queryAll(
    'SELECT id, endpoint, user_agent, created_at, last_success_at, failure_count, disabled_at FROM web_push_subscriptions WHERE user_id = ? ORDER BY created_at DESC',
    [userId],
  ) as unknown as SubscriptionRow[];
  return rows.map((row) => ({
    id: String(row.id),
    // 只回傳端點主機名稱：完整端點本身即為可推播的憑證，不需要外流到前端。
    endpointHost: endpointHost(row.endpoint),
    userAgent: String(row.user_agent ?? ''),
    createdAt: Number(row.created_at) || 0,
    lastSuccessAt: Number(row.last_success_at) || null,
    failureCount: Number(row.failure_count) || 0,
    disabled: Number(row.disabled_at) !== 0,
    isCurrent: !!currentEndpoint && row.endpoint === currentEndpoint,
  }));
}

// ── 冪等紀錄 ──

type DedupOutcome = { created: true; logId: string } | { created: false };

export function isUniqueViolation(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error ?? '');
  // sql.js：UNIQUE constraint failed；PostgreSQL：duplicate key value violates unique constraint
  return /UNIQUE|duplicate key/i.test(text);
}

/**
 * 先去重再發送：INSERT 成功＝本次負責推播；UNIQUE 衝突＝已推播過，直接跳過。
 *
 * 失敗（failed）的列保留且不再重試，語意與 monthly_report_send_log 一致
 * （寄送失敗保留紀錄、不自動重試），避免同一事件在同一裝置上反覆出現。
 */
function claimSendLog(userId: string, category: PushCategory, rawEventKey: string): DedupOutcome {
  const logId = uid();
  try {
    getDB().run(
      'INSERT INTO web_push_send_log (id, user_id, category, event_key, sent_at_utc) VALUES (?,?,?,?,?)',
      [logId, userId, category, rawEventKey, toIsoUtc(Date.now())],
    );
    return { created: true, logId };
  } catch (error) {
    if (isUniqueViolation(error)) return { created: false };
    throw error;
  }
}

function finalizeSendLog(logId: string, delivered: boolean, errorMessage = ''): void {
  getDB().run(
    'UPDATE web_push_send_log SET send_status = ?, delivered = ?, error_message = ? WHERE id = ?',
    [delivered ? 'success' : 'failed', delivered ? 1 : 0, String(errorMessage).slice(0, 500), logId],
  );
}

/**
 * 放棄本次認領（刪除去重列），讓該事件之後仍可推播。
 * 只用於「還沒真正嘗試送給任何訂閱」的情況：沒有訂閱或訂閱在認領與發送之間被刪除。
 * 真正的發送失敗一律保留 failed 列（與 monthly_report_send_log 相同：失敗不自動重試）。
 */
function releaseSendLog(logId: string): void {
  getDB().run('DELETE FROM web_push_send_log WHERE id = ?', [logId]);
}

/** 是否已有該事件的推播紀錄（含失敗），供測試與除錯查詢。 */
export function hasRecordedPush(
  userId: string,
  category: PushCategory,
  rawEventKey: string,
): boolean {
  const row = queryOne(
    'SELECT id FROM web_push_send_log WHERE user_id = ? AND category = ? AND event_key = ?',
    [userId, category, rawEventKey],
  );
  return !!row;
}

// ── 發送 ──

interface DeliveryResult {
  delivered: number;
  expired: number;
  failed: number;
  errors: string[];
}

async function deliverToSubscriptions(userId: string, payloadJson: string): Promise<DeliveryResult> {
  const result: DeliveryResult = { delivered: 0, expired: 0, failed: 0, errors: [] };
  const rows = queryAll(
    'SELECT id, endpoint, p256dh, auth, failure_count FROM web_push_subscriptions WHERE user_id = ? AND disabled_at = 0',
    [userId],
  ) as unknown as SubscriptionRow[];
  if (rows.length === 0) return result;
  if (Buffer.byteLength(payloadJson, 'utf8') > PAYLOAD_MAX_BYTES) {
    result.errors.push('推播內容過大');
    return result;
  }

  const db = getDB();
  const now = Date.now();

  for (const row of rows) {
    const subscriptionId = String(row.id);
    try {
      await sendToSubscription(
        {
          endpoint: String(row.endpoint),
          keys: { p256dh: String(row.p256dh), auth: String(row.auth) },
        },
        payloadJson,
      );
      db.run(
        'UPDATE web_push_subscriptions SET last_success_at = ?, failure_count = 0, updated_at = ? WHERE id = ?',
        [now, now, subscriptionId],
      );
      result.delivered += 1;
    } catch (error) {
      const statusCode = (error as { statusCode?: unknown })?.statusCode;
      if (isExpiredSubscriptionStatus(statusCode)) {
        // push service 明確表示訂閱已失效 → 立即清除，避免持續重試。
        db.run('DELETE FROM web_push_subscriptions WHERE endpoint = ?', [String(row.endpoint)]);
        result.expired += 1;
        continue;
      }
      const failures = nextFailureCount(row.failure_count, false);
      if (shouldDisableSubscription(failures)) {
        db.run(
          'UPDATE web_push_subscriptions SET failure_count = ?, disabled_at = ?, updated_at = ? WHERE id = ?',
          [failures, now, now, subscriptionId],
        );
      } else {
        db.run(
          'UPDATE web_push_subscriptions SET failure_count = ?, updated_at = ? WHERE id = ?',
          [failures, now, subscriptionId],
        );
      }
      result.failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      if (result.errors.length < 3) result.errors.push(message);
    }
  }

  saveDB();
  return result;
}

export interface PushDispatchResult {
  status:
    | 'skipped_disabled'
    | 'skipped_duplicate'
    | 'skipped_no_subscription'
    | 'completed'
    | 'failed';
  delivered: number;
  expired: number;
  failed: number;
  reason?: string;
}

/**
 * 發送單一通知事件（冪等）。
 * 依序檢查：金鑰設定 → 種類開關 → 是否有訂閱 → 去重紀錄 → 發送。
 *
 * 沒有訂閱時「不寫入去重紀錄」：此時沒有任何送達嘗試，事件不應被永久消耗掉，
 * 使用者之後訂閱仍能收到當前狀態（每事件每期間一次）。
 */
export async function dispatchPushEvent(
  userId: string,
  event: PushEvent,
): Promise<PushDispatchResult> {
  if (!isWebPushConfigured()) {
    return { status: 'failed', delivered: 0, expired: 0, failed: 0, reason: 'Web Push 金鑰未設定' };
  }
  const preferences = getUserPushPreferences(userId);
  if (!preferences[event.category]) {
    return { status: 'skipped_disabled', delivered: 0, expired: 0, failed: 0 };
  }
  if (countActiveSubscriptions(userId) === 0) {
    return { status: 'skipped_no_subscription', delivered: 0, expired: 0, failed: 0 };
  }

  const claim = claimSendLog(userId, event.category, eventKeyOf(event));
  if (!claim.created) {
    return { status: 'skipped_duplicate', delivered: 0, expired: 0, failed: 0 };
  }

  const t = getTranslator(getUserLanguage(userId));
  const payloadJson = serializePushPayload(buildPushPayload(event, t));

  let outcome: DeliveryResult;
  try {
    outcome = await deliverToSubscriptions(userId, payloadJson);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    finalizeSendLog(claim.logId, false, message);
    saveDB();
    return { status: 'failed', delivered: 0, expired: 0, failed: 0, reason: message };
  }

  if (outcome.delivered === 0 && outcome.failed === 0 && outcome.expired === 0) {
    // 認領後訂閱剛好被刪除（競態）：本次沒有任何送達嘗試，釋放標記以便日後推播。
    releaseSendLog(claim.logId);
    saveDB();
    return { status: 'skipped_no_subscription', delivered: 0, expired: 0, failed: 0 };
  }

  const delivered = outcome.delivered > 0;
  finalizeSendLog(claim.logId, delivered, outcome.errors.join('；'));
  saveDB();
  return {
    status: delivered ? 'completed' : 'failed',
    delivered: outcome.delivered,
    expired: outcome.expired,
    failed: outcome.failed,
    reason: outcome.errors[0],
  };
}

/**
 * 設定頁「傳送測試通知」：直接發送一則推播，不寫入去重紀錄
 * （每次按下都應該收到，才能確認裝置真的收得到）。
 */
export async function sendTestNotification(userId: string): Promise<PushDispatchResult> {
  if (!isWebPushConfigured()) {
    return { status: 'failed', delivered: 0, expired: 0, failed: 0, reason: 'Web Push 金鑰未設定' };
  }
  const t = getTranslator(getUserLanguage(userId));
  const payloadJson = JSON.stringify({
    title: t('notifications.push.test.title'),
    body: t('notifications.push.test.body'),
    tag: `test:${crypto.randomUUID()}`,
    url: '/settings/notifications',
    category: 'test',
  });
  const outcome = await deliverToSubscriptions(userId, payloadJson);
  if (outcome.delivered === 0 && outcome.failed === 0 && outcome.expired === 0) {
    return { status: 'skipped_no_subscription', delivered: 0, expired: 0, failed: 0 };
  }
  return {
    status: outcome.delivered > 0 ? 'completed' : 'failed',
    delivered: outcome.delivered,
    expired: outcome.expired,
    failed: outcome.failed,
    reason: outcome.errors[0],
  };
}
