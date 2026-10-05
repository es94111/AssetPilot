'use client';

// components/features/offline/OfflineSyncStatus.tsx — 離線／待同步狀態列
//
// 掛載於 AppLayout，負責：
//   1. 啟動離線佇列自動同步（恢復連線時送出）。
//   2. 顯示離線提示與待同步筆數。
//   3. 對「不可自動重試」的失敗項目提示使用者選擇「重試」或「捨棄」——
//      對應驗收條件「同步衝突處理策略需明確定義（以最後寫入或提示使用者選擇）」。

import { useEffect, useRef, useState } from 'react';
import { CloudOff, CloudUpload, TriangleAlert, RefreshCw, Trash2 } from 'lucide-react';
import { useT } from '@/components/i18n/I18nProvider';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/Toast';
import {
  discardItem,
  getFailedItems,
  OFFLINE_QUEUE_LOGOUT_SIGNAL,
  retryItem,
  setOfflineQueueUser,
  startOfflineSync,
} from '@/lib/clientOfflineQueue';
import type { OfflineQueueItem, QueueSummary } from '@/lib/offlineQueueCore';

function isBrowserOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export default function OfflineSyncStatus({ userId }: { userId: string }) {
  const { t } = useT();
  const showToast = useToast();
  const [summary, setSummary] = useState<QueueSummary>({ pending: 0, failed: 0, total: 0 });
  const [failed, setFailed] = useState<OfflineQueueItem[]>([]);
  const [offline, setOffline] = useState(isBrowserOffline);

  useEffect(() => {
    // 身分切換／清理必須先於自動同步，否則子元件的 effect 可能在 AppLayout
    // 綁定 userId 前先以舊／未綁定的 key 讀取並送出佇列。
    setOfflineQueueUser(userId);
    const stop = startOfflineSync((next) => {
      setSummary(next);
      setFailed(getFailedItems());
    });
    return stop;
  }, [userId]);

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === OFFLINE_QUEUE_LOGOUT_SIGNAL && event.newValue) {
        // 同一瀏覽器的其他分頁共用 auth cookie；任何分頁登出時皆停止本頁同步。
        setOfflineQueueUser(null);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    const goOnline = () => setOffline(false);
    const goOffline = () => setOffline(true);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    setOffline(isBrowserOffline());
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  const failedCount = summary.failed;
  const lastNotified = useRef(0);
  useEffect(() => {
    if (failedCount === 0) {
      lastNotified.current = 0;
      return;
    }
    if (failedCount === lastNotified.current) return;
    lastNotified.current = failedCount;
    showToast(t('features.offline.syncFailedToast', { count: failedCount }), 'error');
  }, [failedCount, showToast, t]);

  function handleRetry(id: string) {
    retryItem(id);
    setFailed(getFailedItems());
  }

  function handleDiscard(id: string) {
    // discardItem 會同步派送佇列變更事件，訂閱端已以真實佇列重新計算 summary；
    // 這裡不可再手動遞減，否則會重複扣減而顯示錯誤的待同步筆數。
    discardItem(id);
    setFailed(getFailedItems());
  }

  const showPendingBar = offline || summary.pending > 0;
  if (!showPendingBar && failed.length === 0) return null;

  return (
    <div
      className="fixed inset-x-3 bottom-20 z-40 mx-auto flex max-w-xl flex-col gap-2 md:bottom-6 md:inset-x-auto md:end-6 md:mx-0"
      role="status"
      aria-live="polite"
    >
      {showPendingBar && (
        <div
          className="offline-sync-bar flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium shadow-[var(--shadow-glass-lg)]"
          style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', color: 'var(--text)' }}
        >
          {offline ? <CloudOff size={18} aria-hidden="true" /> : <CloudUpload size={18} aria-hidden="true" />}
          <span className="min-w-0 flex-1">
            {offline
              ? t('features.offline.notice')
              : t('features.offline.pendingSync', { count: summary.pending })}
          </span>
        </div>
      )}
      {failed.map((item) => (
        <div
          key={item.id}
          className="offline-sync-item flex flex-col gap-2 rounded-xl px-3 py-2 text-sm shadow-[var(--shadow-glass-lg)]"
          style={{ background: 'var(--expense-bg)', border: '1px solid var(--expense)', color: 'var(--text)' }}
        >
          <span className="flex items-center gap-2 font-medium">
            <TriangleAlert size={18} aria-hidden="true" className="shrink-0" />
            <span className="min-w-0 flex-1 break-words">
              {t('features.offline.itemFailed', { message: item.lastError || '' })}
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => handleRetry(item.id)}>
              <RefreshCw size={16} aria-hidden="true" /> {t('features.offline.retry')}
            </Button>
            <Button type="button" size="sm" variant="destructive" onClick={() => handleDiscard(item.id)}>
              <Trash2 size={16} aria-hidden="true" /> {t('features.offline.discard')}
            </Button>
          </span>
        </div>
      ))}
    </div>
  );
}
