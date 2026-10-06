// tests/lib/apiIntegrationUi.test.ts — API 整合設定頁 UI 邏輯（issue #273）
// 零相依純函式測試，不需 PostgreSQL；另外斷言 UI 的 scope／event 清單與
// labelKey 與後端核心（lib/apiTokenCore.ts）及 zh-TW 字典一致，避免漂移。
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  API_TOKEN_SCOPE_OPTIONS,
  WEBHOOK_EVENT_OPTIONS,
  defaultApiTokenScopes,
  defaultWebhookEvents,
  toggleOption,
  intersectKnown,
  tokenStatusLabelKey,
  deliveryStatusLabelKey,
  webhookEventLabelKey,
  webhookActiveLabelKey,
} from '../../lib/apiIntegrationUi.ts';
import { API_TOKEN_SCOPES, WEBHOOK_EVENTS } from '../../lib/apiTokenCore.ts';
import { zhTW } from '../../lib/i18n/dictionaries/zh-TW.ts';

function lookup(path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => (
    acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[key] : undefined
  ), zhTW);
}

const SCOPES = API_TOKEN_SCOPE_OPTIONS.map((option) => option.value);
const EVENTS = WEBHOOK_EVENT_OPTIONS.map((option) => option.value);

test('scope 與事件清單與 lib/apiTokenCore.ts 的權威定義一致', () => {
  assert.deepEqual(SCOPES, [...API_TOKEN_SCOPES]);
  assert.deepEqual(EVENTS, [...WEBHOOK_EVENTS]);
});

test('每個選項的 labelKey 都存在於 zh-TW 字典且為非空字串', () => {
  for (const option of [...API_TOKEN_SCOPE_OPTIONS, ...WEBHOOK_EVENT_OPTIONS]) {
    const value = lookup(option.labelKey);
    assert.equal(typeof value, 'string', `${option.labelKey} 應存在於字典`);
    assert.notEqual(String(value).trim(), '', `${option.labelKey} 不應為空字串`);
  }
});

test('所有狀態／事件 labelKey 都存在於字典', () => {
  const keys = [
    tokenStatusLabelKey('active'),
    tokenStatusLabelKey('expired'),
    tokenStatusLabelKey('revoked'),
    deliveryStatusLabelKey('pending'),
    deliveryStatusLabelKey('success'),
    deliveryStatusLabelKey('failed'),
    webhookActiveLabelKey(true),
    webhookActiveLabelKey(false),
    ...EVENTS.map((event) => webhookEventLabelKey(event)),
  ];
  for (const key of keys) {
    assert.ok(key, 'labelKey 不應為 null');
    assert.equal(typeof lookup(key as string), 'string', `${key} 應存在於字典`);
  }
});

test('未知狀態或事件不會產生 labelKey（交由呼叫端顯示原始值）', () => {
  assert.equal(tokenStatusLabelKey('unknown'), null);
  assert.equal(deliveryStatusLabelKey('unknown'), null);
  assert.equal(webhookEventLabelKey('transaction.archived'), null);
});

test('預設值符合後端限制（至少一個 scope，未指定事件時全訂閱）', () => {
  const scopes = defaultApiTokenScopes();
  assert.equal(scopes.length, 1);
  assert.deepEqual(scopes, ['transactions:read']);
  // 後端要求每個 scope 都必須是已知值
  for (const scope of scopes) assert.ok(SCOPES.includes(scope));
  assert.deepEqual(defaultWebhookEvents(), [...EVENTS]);

  // 回傳新陣列，呼叫端修改不會污染後續元件實例
  defaultApiTokenScopes().push('webhooks:manage');
  assert.deepEqual(defaultApiTokenScopes(), ['transactions:read']);
  defaultWebhookEvents().pop();
  assert.deepEqual(defaultWebhookEvents(), [...EVENTS]);
});

test('toggleOption 切換勾選並固定回傳 canonical 順序', () => {
  const all = SCOPES;
  assert.deepEqual(toggleOption([], 'transactions:read', all), ['transactions:read']);
  assert.deepEqual(toggleOption(['transactions:read'], 'transactions:read', all), []);
  // 先選寫入再選讀取，輸出仍依 all 的順序
  assert.deepEqual(
    toggleOption(['transactions:write'], 'transactions:read', all),
    ['transactions:read', 'transactions:write'],
  );
  // 重複加入不會產生重複項
  assert.deepEqual(toggleOption(['webhooks:manage'], 'webhooks:manage', all), []);
});

test('toggleOption 不修改傳入的陣列', () => {
  const original = ['transactions:read'];
  const result = toggleOption(original, 'transactions:write', SCOPES);
  assert.deepEqual(original, ['transactions:read']);
  assert.deepEqual(result, ['transactions:read', 'transactions:write']);
});

test('intersectKnown 過濾未知值並依 canonical 順序排列', () => {
  assert.deepEqual(
    intersectKnown(['transaction.deleted', 'transaction.created'], EVENTS),
    ['transaction.created', 'transaction.deleted'],
  );
  // 未知值被丟棄
  assert.deepEqual(intersectKnown(['transaction.created', 'transaction.archived'], EVENTS), ['transaction.created']);
  assert.deepEqual(intersectKnown([], EVENTS), []);
  assert.deepEqual(intersectKnown(['nope'], EVENTS), []);
  // 重複值不重複輸出
  assert.deepEqual(intersectKnown(['transaction.created', 'transaction.created'], EVENTS), ['transaction.created']);
});
