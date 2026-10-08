'use client';

// components/features/settings/NotificationsSettingsClient.tsx — 推播通知設定（issue #257）
//
// 職責：
//   1. 在此裝置訂閱／解除訂閱 Web Push（VAPID 公鑰來自 GET /api/push/public-key）
//   2. 三種通知種類（帳單到期／預算超標／股利發放）各自開關
//   3. 列出已訂閱裝置、刪除裝置、傳送測試通知
//
// 瀏覽器端刻意不 import lib/webPushCore.ts：那支帶 node Buffer 相依，
// base64url → Uint8Array 的轉換在此就地實作（僅 8 行）。

import { useCallback, useEffect, useState } from 'react';
import { BellRing, BellOff, Send, Trash2 } from 'lucide-react';
import { apiDelete, apiFetch, apiGet, apiPost, apiPut } from '@/lib/clientApi';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/i18n/I18nProvider';
import { localeTag } from '@/lib/i18n/localeTag';

type PushCategory = 'bill_due' | 'budget_exceeded' | 'dividend';

interface SubscriptionSummary {
  id: string;
  endpointHost: string;
  userAgent: string;
  createdAt: number;
  lastSuccessAt: number | null;
  failureCount: number;
  disabled: boolean;
  isCurrent: boolean;
}

const CATEGORY_HINT_KEYS: Record<PushCategory, string> = {
  bill_due: 'billDueHint',
  budget_exceeded: 'budgetExceededHint',
  dividend: 'dividendHint',
};

const CATEGORY_LABEL_KEYS: Record<PushCategory, string> = {
  bill_due: 'billDue',
  budget_exceeded: 'budgetExceeded',
  dividend: 'dividend',
};

function urlBase64ToUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

export default function NotificationsSettingsClient() {
  const { t, locale } = useT();
  const tn = (key: string, vars?: Record<string, string | number>) =>
    t(`settings.notifications.${key}`, vars);
  const tp = (key: string, vars?: Record<string, string | number>) =>
    t(`notifications.push.${key}`, vars);
  const dateLocale = localeTag(locale);

  const [supported, setSupported] = useState(true);
  const [serverEnabled, setServerEnabled] = useState(true);
  const [publicKey, setPublicKey] = useState('');
  const [currentEndpoint, setCurrentEndpoint] = useState('');
  const [subscribing, setSubscribing] = useState(false);
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [testing, setTesting] = useState(false);

  const [preferences, setPreferences] = useState<Record<PushCategory, boolean>>({
    bill_due: true,
    budget_exceeded: true,
    dividend: true,
  });
  const [subscriptions, setSubscriptions] = useState<SubscriptionSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSubscriptions = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const local = await registration?.pushManager.getSubscription();
      const endpoint = local?.endpoint || '';
      const data = await apiFetch('/api/push/subscriptions', {
        headers: endpoint ? { 'x-push-endpoint': endpoint } : undefined,
      });
      const list: SubscriptionSummary[] = data.subscriptions || [];
      setSubscriptions(list);
      // A browser may retain its local PushSubscription across account switches. Only
      // show it as subscribed for this account if the server confirms endpoint ownership.
      setCurrentEndpoint(list.some((item) => item.isCurrent) ? endpoint : '');
    } catch {
      setSubscriptions([]);
      setCurrentEndpoint('');
    }
  }, []);

  const loadPreferences = useCallback(async () => {
    try {
      const data = await apiGet('/api/push/preferences');
      setPreferences({
        bill_due: !!data.preferences?.bill_due,
        budget_exceeded: !!data.preferences?.budget_exceeded,
        dividend: !!data.preferences?.dividend,
      });
    } catch {
      /* 載入失敗時維持畫面預設值，使用者仍可重新操作 */
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hasApi = typeof window !== 'undefined'
        && 'serviceWorker' in navigator
        && 'PushManager' in window
        && 'Notification' in window;
      if (!cancelled) setSupported(hasApi);

      try {
        const data = await apiGet('/api/push/public-key');
        if (cancelled) return;
        setServerEnabled(!!data.enabled);
        setPublicKey(data.publicKey || '');
      } catch {
        if (!cancelled) setServerEnabled(false);
      }

      await loadSubscriptions();
      await loadPreferences();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadPreferences, loadSubscriptions]);

  const notify = useCallback((text: string, error = false) => {
    setMessage(text);
    setIsError(error);
  }, []);

  const subscribe = useCallback(async () => {
    if (!publicKey) return;
    setSubscribing(true);
    notify('');
    try {
      const permission = Notification.permission === 'granted'
        ? 'granted'
        : await Notification.requestPermission();
      if (permission !== 'granted') {
        notify(tn('permissionDenied'), true);
        return;
      }
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
      await apiPost('/api/push/subscriptions', {
        subscription: subscription.toJSON(),
      });
      setCurrentEndpoint(subscription.endpoint);
      notify(tn('subscribeSuccess'));
      await loadSubscriptions();
    } catch (error) {
      notify(tn('subscribeFailed', { error: errorText(error, '') }), true);
    } finally {
      setSubscribing(false);
    }
  }, [loadSubscriptions, notify, publicKey, tn]);

  const unsubscribe = useCallback(async () => {
    setSubscribing(true);
    notify('');
    try {
      const registration = await navigator.serviceWorker.getRegistration('/');
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        // 先請伺服器刪除列，再在本機取消訂閱；反過來會留下無法推播的孤兒列。
        await apiPost('/api/push/unsubscribe', { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setCurrentEndpoint('');
      notify(tn('unsubscribeSuccess'));
      await loadSubscriptions();
    } catch (error) {
      notify(tn('unsubscribeFailed', { error: errorText(error, '') }), true);
    } finally {
      setSubscribing(false);
    }
  }, [loadSubscriptions, notify, tn]);

  const toggleCategory = useCallback(async (category: PushCategory, enabled: boolean) => {
    const previous = preferences;
    setPreferences({ ...preferences, [category]: enabled });
    try {
      const data = await apiPut('/api/push/preferences', { preferences: { [category]: enabled } });
      setPreferences({
        bill_due: !!data.preferences?.bill_due,
        budget_exceeded: !!data.preferences?.budget_exceeded,
        dividend: !!data.preferences?.dividend,
      });
      notify('');
    } catch (error) {
      setPreferences(previous);
      notify(errorText(error, ''), true);
    }
  }, [notify, preferences]);

  const removeDevice = useCallback(async (id: string) => {
    const target = subscriptions.find((device) => device.id === id);
    try {
      await apiDelete(`/api/push/subscriptions/${encodeURIComponent(id)}`);
      if (target?.isCurrent) {
        const registration = await navigator.serviceWorker.getRegistration('/');
        const local = await registration?.pushManager.getSubscription();
        if (local) await local.unsubscribe().catch(() => undefined);
        setCurrentEndpoint('');
      }
      notify(tn('deviceRemoved'));
      await loadSubscriptions();
    } catch (error) {
      notify(tn('deviceRemoveFailed', { error: errorText(error, '') }), true);
    }
  }, [loadSubscriptions, notify, subscriptions, tn]);

  const sendTest = useCallback(async () => {
    setTesting(true);
    notify('');
    try {
      const data = await apiPost('/api/push/test');
      notify(tn('testSent', { delivered: data.delivered ?? 0 }));
      await loadSubscriptions();
    } catch (error) {
      const text = errorText(error, '');
      notify(/尚未訂閱|NoSubscription|409/.test(text) ? tn('testNoDevice') : tn('testFailed', { error: text }), true);
    } finally {
      setTesting(false);
    }
  }, [loadSubscriptions, notify, tn]);

  if (loading) {
    return <div className="p-8 text-slate-500">{t('common.loading')}</div>;
  }

  const cardClass = 'p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm';

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{tn('title')}</h2>

      <div className={cardClass}>
        <h3 className="text-lg font-semibold mb-2">{t('nav.notifications')}</h3>
        <p className="text-sm text-slate-500 mb-4">{tn('description')}</p>

        {!supported && <p className="text-sm text-amber-600 mb-3">{tn('unsupported')}</p>}
        {supported && !serverEnabled && (
          <p className="text-sm text-amber-600 mb-3">{tn('disabledOnServer')}</p>
        )}

        <div className="flex flex-wrap items-center gap-3">
          {currentEndpoint ? (
            <>
              <span className="inline-flex items-center gap-2 text-sm text-green-600">
                <BellRing size={16} aria-hidden="true" />
                {tn('subscribed')}
              </span>
              <Button variant="outline" onClick={unsubscribe} disabled={subscribing}>
                {subscribing ? tn('subscribing') : tn('unsubscribe')}
              </Button>
            </>
          ) : (
            <Button onClick={subscribe} disabled={subscribing || !supported || !serverEnabled}>
              <BellOff size={16} aria-hidden="true" className="me-2" />
              {subscribing ? tn('subscribing') : tn('subscribe')}
            </Button>
          )}
        </div>

        {message && (
          <p className={`text-sm mt-3 ${isError ? 'text-red-500' : 'text-green-600'}`}>{message}</p>
        )}
      </div>

      <div className={cardClass}>
        <h3 className="text-lg font-semibold mb-4">{tn('categoriesTitle')}</h3>
        <div className="space-y-4">
          {(Object.keys(CATEGORY_LABEL_KEYS) as PushCategory[]).map((category) => (
            <label key={category} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4"
                checked={preferences[category]}
                onChange={(event) => toggleCategory(category, event.target.checked)}
              />
              <span>
                <span className="font-medium block">{tn(CATEGORY_LABEL_KEYS[category])}</span>
                <span className="text-sm text-slate-500">{tn(CATEGORY_HINT_KEYS[category])}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className={cardClass}>
        <h3 className="text-lg font-semibold mb-4">{tn('devicesTitle')}</h3>
        {subscriptions.length === 0 && <p className="text-sm text-slate-500">{tn('noDevices')}</p>}
        <div className="space-y-2">
          {subscriptions.map((device) => (
            <div key={device.id} className="flex items-center justify-between gap-3 p-3 border rounded-md">
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">
                  {device.userAgent || device.endpointHost || tn('deviceUnknown')}
                </div>
                <div className="text-xs text-slate-500">
                  {tn('deviceSubscribedAt', { date: new Date(device.createdAt).toLocaleString(dateLocale) })}
                  {device.disabled ? `　·　${tn('deviceDisabled')}` : ''}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={tn('removeDevice')}
                onClick={() => removeDevice(device.id)}
                className="text-red-500 hover:text-red-700 shrink-0"
              >
                <Trash2 size={16} aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className={cardClass}>
        <h3 className="text-lg font-semibold mb-4">{tn('testTitle')}</h3>
        <Button onClick={sendTest} disabled={testing || !supported || !serverEnabled}>
          <Send size={16} aria-hidden="true" className="me-2" />
          {testing ? tn('testSending') : tn('testButton')}
        </Button>
        <p className="text-xs text-slate-500 mt-3">{tp('test.body')}</p>
      </div>
    </div>
  );
}
