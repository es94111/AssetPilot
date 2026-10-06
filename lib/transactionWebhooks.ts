// lib/transactionWebhooks.ts — 交易事件 → Webhook 的橋接層（issue #258）
//
// 刻意獨立於 webhookHelpers 之外：webhookHelpers 只管資料與投遞，
// 這裡負責把交易列的欄位轉成穩定的對外事件 payload（不含內部 AI 欄位），
// 並在已驗證的請求中順帶觸發待投遞佇列的排空。
import { enqueueWebhookEvent, runDueWebhookDeliveries, type WebhookEvent } from './webhookHelpers';
import type { WebhookEventEnvelope } from './webhookHelpers';

let deliveryDrainInflight = false;

export interface TransactionEventRow {
  id?: unknown;
  type?: unknown;
  amount?: unknown;
  currency?: unknown;
  date?: unknown;
  account_id?: unknown;
  category_id?: unknown;
  note?: unknown;
  exclude_from_stats?: unknown;
  is_fx_fee?: unknown;
}

/** 對外事件只暴露整合方需要且穩定的欄位。 */
export function buildTransactionEventData(row: TransactionEventRow): Record<string, unknown> {
  return {
    id: String(row.id ?? ''),
    type: String(row.type ?? ''),
    amount: Number(row.amount ?? 0),
    currency: String(row.currency ?? 'TWD'),
    date: String(row.date ?? ''),
    accountId: row.account_id == null ? null : String(row.account_id),
    categoryId: row.category_id == null ? null : String(row.category_id),
    note: String(row.note ?? ''),
  };
}

/**
 * 交易異動時呼叫：只做「寫入待投遞列」的同步工作，投遞本身非阻塞。
 * 回傳建立的投遞數（0 表示沒有訂閱此事件，呼叫端可據此跳過後續工作）。
 */
export function emitTransactionEvent(
  userId: string,
  eventType: WebhookEvent,
  row: TransactionEventRow,
): number {
  const enqueued = enqueueWebhookEvent(userId, eventType, buildTransactionEventData(row));
  if (enqueued > 0) triggerWebhookDeliveryDrain();
  return enqueued;
}

/**
 * 非阻塞排空待投遞佇列。以 inflight 旗標避免同一程序內重複啟動；
 * 失敗僅記錄，不影響原始請求結果（Webhook 為盡力而為的副作用）。
 */
export function triggerWebhookDeliveryDrain(): void {
  if (deliveryDrainInflight) return;
  deliveryDrainInflight = true;
  void import('./webhookHelpers')
    .then(({ runDueWebhookDeliveries: drain }) => drain())
    .catch((error) => {
      console.error(JSON.stringify({ event: 'webhook_delivery_drain_failed', error: String(error) }));
    })
    .finally(() => {
      deliveryDrainInflight = false;
    });
}

/** 測試用：重設 inflight 旗標。 */
export function _resetWebhookDeliveryDrain(): void {
  deliveryDrainInflight = false;
}

export type { WebhookEvent, WebhookEventEnvelope };
export { runDueWebhookDeliveries };
