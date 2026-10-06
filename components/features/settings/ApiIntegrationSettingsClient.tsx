'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/clientApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Modal from '@/components/ui/Modal';
import { useT } from '@/components/i18n/I18nProvider';
import { localeTag } from '@/lib/i18n/localeTag';
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
  type ApiTokenScope,
  type WebhookEvent,
} from '@/lib/apiIntegrationUi';

interface ApiTokenSummary {
  id: string;
  name: string;
  status: string;
  scopes: string[];
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

interface WebhookSubscription {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  secretPrefix: string;
  createdAt: string;
  updatedAt: string;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
}

interface WebhookDelivery {
  id: string;
  subscriptionId: string;
  eventType: string;
  status: string;
  attempts: number;
  lastStatusCode: number | null;
  lastError: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt: string | null;
}

interface WebhookDraft {
  url: string;
  events: WebhookEvent[];
  active: boolean;
}

function statusBadgeClass(status: string): string {
  if (status === 'active') return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
  if (status === 'expired') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
}

function deliveryBadgeClass(status: string): string {
  if (status === 'success') return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
  if (status === 'pending') return 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300';
  return 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
}

const CARD_CLASS =
  'rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900';
const CODE_CLASS =
  'block break-all rounded-md bg-slate-100 p-3 text-xs dark:bg-slate-800';

/** 簽章標頭的實際格式（對應 lib/apiTokenCore.ts 的 signWebhookPayload）。 */
const SIGNATURE_HEADER_EXAMPLE = 'X-AssetPilot-Signature: t=<unix 秒>,v1=<HMAC-SHA256 hex>';

export default function ApiIntegrationSettingsClient() {
  const { locale, t } = useT();
  const dateLocale = localeTag(locale);
  const ta = (key: string, vars?: Record<string, string | number>) => t(`settings.apiIntegration.${key}`, vars);

  const [tokens, setTokens] = useState<ApiTokenSummary[]>([]);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [tokensMsg, setTokensMsg] = useState('');

  const [tokenName, setTokenName] = useState('');
  const [tokenExpiresAt, setTokenExpiresAt] = useState('');
  const [tokenScopes, setTokenScopes] = useState<ApiTokenScope[]>(defaultApiTokenScopes);
  const [tokenCreating, setTokenCreating] = useState(false);
  const [tokenError, setTokenError] = useState('');
  const [newToken, setNewToken] = useState('');
  const [tokenCopied, setTokenCopied] = useState(false);
  const [tokenCopyError, setTokenCopyError] = useState('');

  const [subscriptions, setSubscriptions] = useState<WebhookSubscription[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(true);
  const [subscriptionsMsg, setSubscriptionsMsg] = useState('');

  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEvents, setWebhookEvents] = useState<WebhookEvent[]>(defaultWebhookEvents);
  const [webhookCreating, setWebhookCreating] = useState(false);
  const [webhookError, setWebhookError] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editDraft, setEditDraft] = useState<WebhookDraft | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [newSecret, setNewSecret] = useState('');
  const [secretCopied, setSecretCopied] = useState(false);
  const [secretCopyError, setSecretCopyError] = useState('');

  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [deliveriesLoading, setDeliveriesLoading] = useState(true);
  const [deliveriesMsg, setDeliveriesMsg] = useState('');
  const [deliveryFilter, setDeliveryFilter] = useState('');
  const deliveryRequestSeq = useRef(0);

  const loadTokens = useCallback(async () => {
    setTokensLoading(true);
    try {
      const res = await apiGet('/api/user/api-tokens');
      setTokens(res.tokens || []);
      setTokensMsg('');
    } catch (e: any) {
      setTokensMsg(e.message || ta('loadTokensFailed'));
    }
    setTokensLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSubscriptions = useCallback(async () => {
    setSubscriptionsLoading(true);
    try {
      const res = await apiGet('/api/user/webhooks');
      setSubscriptions(res.subscriptions || []);
      setSubscriptionsMsg('');
    } catch (e: any) {
      setSubscriptionsMsg(e.message || ta('loadWebhooksFailed'));
    }
    setSubscriptionsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDeliveries = useCallback(async (subscriptionId: string) => {
    // 依序認領請求：切換篩選時可能有多次載入同時進行，只讓最後一次的結果生效，
    // 避免較慢的舊回應覆蓋新篩選的結果（畫面顯示的訂閱與 Select 不一致）。
    deliveryRequestSeq.current += 1;
    const seq = deliveryRequestSeq.current;
    setDeliveriesLoading(true);
    try {
      const query = subscriptionId ? `?subscriptionId=${encodeURIComponent(subscriptionId)}` : '';
      const res = await apiGet(`/api/user/webhooks/deliveries${query}`);
      if (seq !== deliveryRequestSeq.current) return;
      setDeliveries(res.deliveries || []);
      setDeliveriesMsg('');
    } catch (e: any) {
      if (seq !== deliveryRequestSeq.current) return;
      setDeliveriesMsg(e.message || ta('loadDeliveriesFailed'));
    } finally {
      if (seq === deliveryRequestSeq.current) setDeliveriesLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadTokens(); }, [loadTokens]);
  useEffect(() => { loadSubscriptions(); }, [loadSubscriptions]);
  useEffect(() => { loadDeliveries(''); }, [loadDeliveries]);

  /**
   * 複製到剪貼簿，並在真的寫入成功後才回報成功。
   *
   * 不可用 finally 回報成功：非安全脈絡（自架常見的 http://<區網 IP>:3000）下
   * navigator.clipboard 不存在，寫入會失敗；若仍標記為「已複製」，使用者就能在
   * 沒有實際複製到的情況下關閉一次性視窗，Token 明文與簽章密鑰將永久遺失
   * （後端只存雜湊／密文，且 secret 僅在建立時回傳一次）。
   * 因此改為只在成功時設定 copied，失敗時顯示錯誤並保持關閉鈕停用。
   */
  async function copyToClipboard(
    value: string,
    onSuccess: () => void,
    onFailure: (message: string) => void,
  ) {
    try {
      await navigator.clipboard.writeText(value);
      onSuccess();
    } catch (e: any) {
      onFailure(e?.message || ta('copyFailed'));
    }
  }

  async function handleCreateToken(e: React.FormEvent) {
    e.preventDefault();
    setTokenError('');
    const trimmed = tokenName.trim();
    if (!trimmed) { setTokenError(ta('tokenNameRequired')); return; }
    if (tokenScopes.length === 0) { setTokenError(ta('tokenScopeRequired')); return; }

    setTokenCreating(true);
    try {
      const body: { name: string; scopes: ApiTokenScope[]; expiresAt?: string } = {
        name: trimmed,
        scopes: tokenScopes,
      };
      if (tokenExpiresAt) body.expiresAt = new Date(tokenExpiresAt).toISOString();
      const res = await apiPost('/api/user/api-tokens', body);
      setNewToken(res.secret || '');
      setTokenCopied(false);
      setTokenCopyError('');
      setTokenName('');
      setTokenExpiresAt('');
      setTokenScopes(defaultApiTokenScopes());
      await loadTokens();
    } catch (e: any) {
      setTokenError(e.message || ta('createTokenFailed'));
    }
    setTokenCreating(false);
  }

  async function handleRevokeToken(id: string) {
    if (!confirm(ta('tokenRevokeConfirm'))) return;
    setTokensMsg('');
    try {
      await apiDelete(`/api/user/api-tokens/${encodeURIComponent(id)}`);
      setTokens((prev) => prev.map((token) => (
        token.id === id ? { ...token, status: 'revoked' } : token
      )));
    } catch (e: any) {
      setTokensMsg(e.message || ta('revokeTokenFailed'));
    }
  }

  async function handleCreateWebhook(e: React.FormEvent) {
    e.preventDefault();
    setWebhookError('');
    const trimmed = webhookUrl.trim();
    if (!trimmed) { setWebhookError(ta('urlRequired')); return; }
    if (webhookEvents.length === 0) { setWebhookError(ta('eventRequired')); return; }

    setWebhookCreating(true);
    try {
      const res = await apiPost('/api/user/webhooks', { url: trimmed, events: webhookEvents });
      setNewSecret(res.secret || '');
      setSecretCopied(false);
      setSecretCopyError('');
      setWebhookUrl('');
      setWebhookEvents(defaultWebhookEvents());
      await loadSubscriptions();
    } catch (e: any) {
      setWebhookError(e.message || ta('createWebhookFailed'));
    }
    setWebhookCreating(false);
  }

  function startEdit(subscription: WebhookSubscription) {
    setSubscriptionsMsg('');
    setEditingId(subscription.id);
    setEditDraft({
      url: subscription.url,
      events: intersectKnown(subscription.events, WEBHOOK_EVENT_OPTIONS.map((option) => option.value)),
      active: subscription.active,
    });
  }

  async function handleSaveEdit() {
    if (!editDraft) return;
    const trimmed = editDraft.url.trim();
    if (!trimmed) { setSubscriptionsMsg(ta('urlRequired')); return; }
    if (editDraft.events.length === 0) { setSubscriptionsMsg(ta('eventRequired')); return; }

    setEditSaving(true);
    try {
      const res = await apiPatch(`/api/user/webhooks/${encodeURIComponent(editingId)}`, {
        url: trimmed,
        events: editDraft.events,
        active: editDraft.active,
      });
      setSubscriptions((prev) => prev.map((subscription) => (
        subscription.id === editingId ? res.subscription : subscription
      )));
      setEditingId('');
      setEditDraft(null);
      setSubscriptionsMsg('');
    } catch (e: any) {
      setSubscriptionsMsg(e.message || ta('updateWebhookFailed'));
    }
    setEditSaving(false);
  }

  async function handleDeleteWebhook(id: string) {
    if (!confirm(ta('webhookDeleteConfirm'))) return;
    setSubscriptionsMsg('');
    try {
      await apiDelete(`/api/user/webhooks/${encodeURIComponent(id)}`);
      if (editingId === id) {
        setEditingId('');
        setEditDraft(null);
      }
      if (deliveryFilter === id) setDeliveryFilter('');
      await loadSubscriptions();
      await loadDeliveries(deliveryFilter === id ? '' : deliveryFilter);
    } catch (e: any) {
      setSubscriptionsMsg(e.message || ta('deleteWebhookFailed'));
    }
  }

  function handleDeliveryFilterChange(next: string) {
    setDeliveryFilter(next);
    loadDeliveries(next);
  }

  const deliveryFilterOptions = [
    { label: ta('deliveryAllSubscriptions'), value: '' },
    ...subscriptions.map((subscription) => ({
      label: `${subscription.url} (${subscription.secretPrefix}…)`,
      value: subscription.id,
    })),
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{ta('title')}</h2>
      <p className="text-sm text-slate-500">{ta('description')}</p>

      {/* API Token */}
      <section className={CARD_CLASS}>
        <h3 className="mb-2 text-lg font-semibold">{ta('tokenTitle')}</h3>
        <p className="mb-4 text-sm text-slate-500">{ta('tokenDescription')}</p>

        <h4 className="mb-3 text-base font-semibold">{ta('tokenCreateTitle')}</h4>
        <form onSubmit={handleCreateToken} className="max-w-md space-y-4">
          <Input
            label={ta('tokenNameLabel')}
            value={tokenName}
            onChange={(e) => setTokenName(e.target.value)}
            placeholder={ta('tokenNamePlaceholder')}
            maxLength={100}
          />
          <Input
            label={ta('tokenExpiresAtLabel')}
            type="datetime-local"
            value={tokenExpiresAt}
            onChange={(e) => setTokenExpiresAt(e.target.value)}
          />
          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-200">
              {ta('tokenScopesLabel')}
            </legend>
            <div className="space-y-2">
              {API_TOKEN_SCOPE_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={tokenScopes.includes(option.value)}
                    onChange={() => setTokenScopes((prev) => toggleOption(
                      prev,
                      option.value,
                      API_TOKEN_SCOPE_OPTIONS.map((item) => item.value),
                    ))}
                  />
                  <span>{t(option.labelKey)}</span>
                  <code className="text-xs text-slate-400">{option.value}</code>
                </label>
              ))}
            </div>
          </fieldset>
          {tokenError && <div role="alert" className="text-sm text-red-500">{tokenError}</div>}
          <Button type="submit" disabled={tokenCreating}>
            {tokenCreating ? ta('tokenCreating') : ta('tokenCreateButton')}
          </Button>
        </form>
      </section>

      <section className={CARD_CLASS}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{ta('tokenListTitle')}</h3>
          <Button variant="outline" onClick={loadTokens}>{t('common.refresh')}</Button>
        </div>
        {tokensMsg && <p role="alert" className="mb-3 text-sm text-red-500">{tokensMsg}</p>}
        {tokensLoading ? (
          <p className="text-slate-500">{t('common.loading')}</p>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-slate-500">{ta('tokenNoItems')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-2 pr-4 text-left">{ta('colName')}</th>
                  <th className="py-2 pr-4 text-left">{ta('colPrefix')}</th>
                  <th className="py-2 pr-4 text-left">{ta('colScopes')}</th>
                  <th className="py-2 pr-4 text-left">{ta('colStatus')}</th>
                  <th className="py-2 pr-4 text-left">{ta('colCreatedAt')}</th>
                  <th className="py-2 pr-4 text-left">{ta('colLastUsedAt')}</th>
                  <th className="py-2 pr-4 text-left">{ta('colExpiresAt')}</th>
                  <th className="py-2 text-left">{ta('colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {tokens.map((token) => {
                  const statusKey = tokenStatusLabelKey(token.status);
                  const scopeLabels = intersectKnown(token.scopes, API_TOKEN_SCOPE_OPTIONS.map((o) => o.value));
                  return (
                    <tr key={token.id} className="border-b last:border-0">
                      <td className="py-3 pr-4 font-medium">{token.name}</td>
                      <td className="py-3 pr-4">
                        <code className="text-xs">{token.prefix}…</code>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="flex flex-wrap gap-1">
                          {scopeLabels.map((scope) => {
                            const option = API_TOKEN_SCOPE_OPTIONS.find((o) => o.value === scope);
                            return (
                              <code key={scope} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">
                                {option ? t(option.labelKey) : scope}
                              </code>
                            );
                          })}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusBadgeClass(token.status)}`}>
                          {statusKey ? t(statusKey) : token.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4">{new Date(token.createdAt).toLocaleString(dateLocale)}</td>
                      <td className="py-3 pr-4">
                        {token.lastUsedAt ? new Date(token.lastUsedAt).toLocaleString(dateLocale) : ta('neverUsed')}
                      </td>
                      <td className="py-3 pr-4">
                        {token.expiresAt ? new Date(token.expiresAt).toLocaleString(dateLocale) : ta('neverExpires')}
                      </td>
                      <td className="py-3">
                        {token.status === 'active' && (
                          <Button
                            variant="outline"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => handleRevokeToken(token.id)}
                          >
                            {ta('tokenRevokeButton')}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Webhook 訂閱 */}
      <section className={CARD_CLASS}>
        <h3 className="mb-2 text-lg font-semibold">{ta('webhookTitle')}</h3>
        <p className="mb-4 text-sm text-slate-500">{ta('webhookDescription')}</p>

        <h4 className="mb-3 text-base font-semibold">{ta('webhookCreateTitle')}</h4>
        <form onSubmit={handleCreateWebhook} className="max-w-xl space-y-4">
          <Input
            label={ta('webhookUrlLabel')}
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder={ta('webhookUrlPlaceholder')}
            inputMode="url"
            maxLength={2048}
          />
          <fieldset>
            <legend className="mb-2 block text-sm font-medium text-gray-700 dark:text-slate-200">
              {ta('webhookEventsLabel')}
            </legend>
            <div className="space-y-2">
              {WEBHOOK_EVENT_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={webhookEvents.includes(option.value)}
                    onChange={() => setWebhookEvents((prev) => toggleOption(
                      prev,
                      option.value,
                      WEBHOOK_EVENT_OPTIONS.map((item) => item.value),
                    ))}
                  />
                  <span>{t(option.labelKey)}</span>
                  <code className="text-xs text-slate-400">{option.value}</code>
                </label>
              ))}
            </div>
          </fieldset>
          {webhookError && <div role="alert" className="text-sm text-red-500">{webhookError}</div>}
          <Button type="submit" disabled={webhookCreating}>
            {webhookCreating ? t('common.saving') : ta('webhookCreateButton')}
          </Button>
        </form>
      </section>

      <section className={CARD_CLASS}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{ta('webhookListTitle')}</h3>
          <Button variant="outline" onClick={loadSubscriptions}>{t('common.refresh')}</Button>
        </div>
        {subscriptionsMsg && <p role="alert" className="mb-3 text-sm text-red-500">{subscriptionsMsg}</p>}
        {subscriptionsLoading ? (
          <p className="text-slate-500">{t('common.loading')}</p>
        ) : subscriptions.length === 0 ? (
          <p className="text-sm text-slate-500">{ta('webhookNoItems')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-2 pr-4 text-left">{ta('colUrl')}</th>
                  <th className="py-2 pr-4 text-left">{ta('colEvents')}</th>
                  <th className="py-2 pr-4 text-left">{ta('colEnabled')}</th>
                  <th className="py-2 pr-4 text-left">{ta('colLastSuccess')}</th>
                  <th className="py-2 pr-4 text-left">{ta('colLastFailure')}</th>
                  <th className="py-2 text-left">{ta('colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {subscriptions.map((subscription) => {
                  const editing = editingId === subscription.id && editDraft;
                  return (
                    <tr key={subscription.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        {editing ? (
                          <input
                            type="url"
                            aria-label={ta('webhookUrlLabel')}
                            value={editDraft.url}
                            onChange={(e) => setEditDraft({ ...editDraft, url: e.target.value })}
                            maxLength={2048}
                            className="min-h-11 w-full min-w-64 rounded-md border border-gray-300 px-3 py-2 text-xs shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:[color-scheme:dark]"
                          />
                        ) : (
                          <code className="text-xs break-all">{subscription.url}</code>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {editing ? (
                          <div className="space-y-1">
                            {WEBHOOK_EVENT_OPTIONS.map((option) => (
                              <label key={option.value} className="flex items-center gap-2 text-xs">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4"
                                  checked={editDraft.events.includes(option.value)}
                                  onChange={() => setEditDraft({
                                    ...editDraft,
                                    events: toggleOption(
                                      editDraft.events,
                                      option.value,
                                      WEBHOOK_EVENT_OPTIONS.map((item) => item.value),
                                    ),
                                  })}
                                />
                                <span>{t(option.labelKey)}</span>
                              </label>
                            ))}
                          </div>
                        ) : (
                          <span className="flex flex-wrap gap-1">
                            {intersectKnown(subscription.events, WEBHOOK_EVENT_OPTIONS.map((o) => o.value))
                              .map((event) => {
                                const key = webhookEventLabelKey(event);
                                return (
                                  <code key={event} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs dark:bg-slate-800">
                                    {key ? t(key) : event}
                                  </code>
                                );
                              })}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {editing ? (
                          <label className="flex items-center gap-2 text-xs">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={editDraft.active}
                              onChange={(e) => setEditDraft({ ...editDraft, active: e.target.checked })}
                            />
                            <span>{ta('webhookActiveLabel')}</span>
                          </label>
                        ) : (
                          <span className={subscription.active
                            ? 'rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300'
                            : 'rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400'}
                          >
                            {t(webhookActiveLabelKey(subscription.active))}
                          </span>
                        )}
                      </td>
                      <td className="py-3 pr-4">
                        {subscription.lastSuccessAt
                          ? new Date(subscription.lastSuccessAt).toLocaleString(dateLocale)
                          : ta('neverUsed')}
                      </td>
                      <td className="py-3 pr-4">
                        {subscription.lastFailureAt
                          ? new Date(subscription.lastFailureAt).toLocaleString(dateLocale)
                          : ta('neverUsed')}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-2">
                          {editing ? (
                            <>
                              <Button onClick={handleSaveEdit} disabled={editSaving}>
                                {editSaving ? t('common.saving') : ta('webhookSaveButton')}
                              </Button>
                              <Button
                                variant="outline"
                                onClick={() => { setEditingId(''); setEditDraft(null); }}
                              >
                                {ta('webhookCancelEdit')}
                              </Button>
                            </>
                          ) : (
                            <Button variant="outline" onClick={() => startEdit(subscription)}>
                              {ta('webhookEditButton')}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => handleDeleteWebhook(subscription.id)}
                          >
                            {ta('webhookDeleteButton')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 投遞紀錄 */}
      <section className={CARD_CLASS}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold">{ta('deliveryTitle')}</h3>
            <p className="text-sm text-slate-500">{ta('deliveryDescription')}</p>
          </div>
          <Button variant="outline" onClick={() => loadDeliveries(deliveryFilter)}>
            {t('common.refresh')}
          </Button>
        </div>
        <div className="mb-4 max-w-md">
          <Select
            label={ta('deliveryFilterLabel')}
            value={deliveryFilter}
            options={deliveryFilterOptions}
            onChange={(e) => handleDeliveryFilterChange(e.target.value)}
          />
        </div>
        {deliveriesMsg && <p role="alert" className="mb-3 text-sm text-red-500">{deliveriesMsg}</p>}
        {deliveriesLoading ? (
          <p className="text-slate-500">{t('common.loading')}</p>
        ) : deliveries.length === 0 ? (
          <p className="text-sm text-slate-500">{ta('deliveryNoItems')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="py-2 pr-4 text-left">{ta('colEventType')}</th>
                  <th className="py-2 pr-4 text-left">{ta('colStatus')}</th>
                  <th className="py-2 pr-4 text-left">{ta('colAttempts')}</th>
                  <th className="py-2 pr-4 text-left">{ta('colStatusCode')}</th>
                  <th className="py-2 pr-4 text-left">{ta('colDeliveredAt')}</th>
                  <th className="py-2 text-left">{ta('colError')}</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((delivery) => {
                  const eventKey = webhookEventLabelKey(delivery.eventType);
                  const statusKey = deliveryStatusLabelKey(delivery.status);
                  return (
                    <tr key={delivery.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        <code className="text-xs">{eventKey ? t(eventKey) : delivery.eventType}</code>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`rounded-full px-2 py-1 text-xs font-medium ${deliveryBadgeClass(delivery.status)}`}>
                          {statusKey ? t(statusKey) : delivery.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4">{delivery.attempts}</td>
                      <td className="py-3 pr-4">{delivery.lastStatusCode || '—'}</td>
                      <td className="py-3 pr-4">
                        {delivery.deliveredAt
                          ? new Date(delivery.deliveredAt).toLocaleString(dateLocale)
                          : new Date(delivery.createdAt).toLocaleString(dateLocale)}
                      </td>
                      <td className="max-w-xs py-3 text-xs text-slate-500">{delivery.lastError || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={!!newToken}
        onClose={() => { if (tokenCopied) setNewToken(''); }}
        title={ta('tokenModalTitle')}
      >
        <div className="space-y-4">
          <p className="text-sm text-amber-600">{ta('tokenModalWarning')}</p>
          <code className={CODE_CLASS}>{newToken}</code>
          <Button
            variant="outline"
            onClick={() => copyToClipboard(newToken, () => setTokenCopied(true), setTokenCopyError)}
          >
            {tokenCopied ? t('common.copied') : t('common.copy')}
          </Button>
          {tokenCopyError && <p role="alert" className="text-sm text-red-500">{tokenCopyError}</p>}
          <div className="flex justify-end pt-2">
            <Button onClick={() => setNewToken('')} disabled={!tokenCopied}>
              {ta('closeConfirm')}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={!!newSecret}
        onClose={() => { if (secretCopied) setNewSecret(''); }}
        title={ta('webhookSecretModalTitle')}
      >
        <div className="space-y-4">
          <p className="text-sm text-amber-600">{ta('webhookSecretModalWarning')}</p>
          <code className={CODE_CLASS}>{newSecret}</code>
          <Button
            variant="outline"
            onClick={() => copyToClipboard(newSecret, () => setSecretCopied(true), setSecretCopyError)}
          >
            {secretCopied ? t('common.copied') : t('common.copy')}
          </Button>
          {secretCopyError && <p role="alert" className="text-sm text-red-500">{secretCopyError}</p>}
          <div>
            <p className="mb-1 block text-sm font-medium text-slate-600 dark:text-slate-300">
              {ta('webhookSignatureHeaderLabel')}
            </p>
            <code className={CODE_CLASS}>{SIGNATURE_HEADER_EXAMPLE}</code>
          </div>
          <p className="text-xs text-slate-500">{ta('webhookSignatureHint')}</p>
          <div className="flex justify-end pt-2">
            <Button onClick={() => setNewSecret('')} disabled={!secretCopied}>
              {ta('closeConfirm')}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
