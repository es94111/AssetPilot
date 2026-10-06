// lib/apiIntegrationUi.ts — API Token／Webhook 設定頁的零相依 UI 邏輯（issue #273）
//
// 刻意不 import lib/apiTokenCore.ts：該模組相依 node:crypto，若被 'use client' 元件
// 匯入會把 Node API 帶進瀏覽器 bundle。這裡改以常數清單重述 scope／event 值，
// 並由 tests/lib/apiIntegrationUi.test.ts 斷言與 apiTokenCore 的權威清單一致，
// 避免兩邊漂移；同時驗證每個 labelKey 都存在於 zh-TW 字典。

export type ApiTokenScope = 'transactions:read' | 'transactions:write' | 'webhooks:manage';

export type WebhookEvent = 'transaction.created' | 'transaction.updated' | 'transaction.deleted';

export type TokenStatus = 'active' | 'expired' | 'revoked';

export type DeliveryStatus = 'pending' | 'success' | 'failed';

export interface IntegrationOption<T extends string> {
  value: T;
  /** i18n dot-path（settings.apiIntegration.*）。 */
  labelKey: string;
}

/** 對應 lib/apiTokenCore.ts 的 API_TOKEN_SCOPES，順序即 UI 顯示順序。 */
export const API_TOKEN_SCOPE_OPTIONS: readonly IntegrationOption<ApiTokenScope>[] = [
  { value: 'transactions:read', labelKey: 'settings.apiIntegration.scope.transactionsRead' },
  { value: 'transactions:write', labelKey: 'settings.apiIntegration.scope.transactionsWrite' },
  { value: 'webhooks:manage', labelKey: 'settings.apiIntegration.scope.webhooksManage' },
];

/** 對應 lib/apiTokenCore.ts 的 WEBHOOK_EVENTS，順序即 UI 顯示順序。 */
export const WEBHOOK_EVENT_OPTIONS: readonly IntegrationOption<WebhookEvent>[] = [
  { value: 'transaction.created', labelKey: 'settings.apiIntegration.event.created' },
  { value: 'transaction.updated', labelKey: 'settings.apiIntegration.event.updated' },
  { value: 'transaction.deleted', labelKey: 'settings.apiIntegration.event.deleted' },
];

/**
 * 新 Token 的預設 scope：僅讀取交易。
 * 後端要求至少一個 scope，預設採最小權限讓使用者必須主動勾選寫入能力。
 */
export function defaultApiTokenScopes(): ApiTokenScope[] {
  return ['transactions:read'];
}

/** 新 Webhook 訂閱的預設事件：全部（後端未指定時亦預設全訂閱）。 */
export function defaultWebhookEvents(): WebhookEvent[] {
  return WEBHOOK_EVENT_OPTIONS.map((option) => option.value);
}

/**
 * 切換勾選狀態，並固定回傳 canonical 順序（依 all 的排列），
 * 讓送往 API 的陣列與後端定義順序一致、也讓列表顯示穩定。
 */
export function toggleOption<T extends string>(
  selected: readonly T[],
  value: T,
  all: readonly T[],
): T[] {
  const next = new Set<T>(selected);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  return all.filter((item) => next.has(item));
}

/**
 * 把 API 回應的字串陣列轉成可勾選的選項：只保留已知值，並依 `all` 的
 * canonical 順序回傳（後端可能回傳未知或亂序的值）。
 */
export function intersectKnown<T extends string>(values: readonly string[], all: readonly T[]): T[] {
  return all.filter((value) => values.includes(value));
}

export function tokenStatusLabelKey(status: string): string | null {
  switch (status) {
    case 'active':
      return 'settings.apiIntegration.tokenStatusActive';
    case 'expired':
      return 'settings.apiIntegration.tokenStatusExpired';
    case 'revoked':
      return 'settings.apiIntegration.tokenStatusRevoked';
    default:
      return null;
  }
}

export function deliveryStatusLabelKey(status: string): string | null {
  switch (status) {
    case 'pending':
      return 'settings.apiIntegration.deliveryStatusPending';
    case 'success':
      return 'settings.apiIntegration.deliveryStatusSuccess';
    case 'failed':
      return 'settings.apiIntegration.deliveryStatusFailed';
    default:
      return null;
  }
}

export function webhookEventLabelKey(event: string): string | null {
  const found = WEBHOOK_EVENT_OPTIONS.find((option) => option.value === event);
  return found ? found.labelKey : null;
}

export function webhookActiveLabelKey(active: boolean): string {
  return active
    ? 'settings.apiIntegration.webhookEnabled'
    : 'settings.apiIntegration.webhookDisabled';
}
