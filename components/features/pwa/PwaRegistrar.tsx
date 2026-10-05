'use client';

// components/features/pwa/PwaRegistrar.tsx — Service Worker 註冊 + 安裝提示
//
// 掛載於 AppLayout（登入後的畫面），職責：
//   1. 註冊 /sw.js（僅 production；dev 下 Next 的 HMR chunk 無穩定雜湊，快取會造成
//      開發時載入到舊程式碼，因此 dev 一律不註冊）。
//   2. 監聽 beforeinstallprompt，提供使用者在 App 內一鍵「安裝」的提示——
//      對應驗收條件「加入 Web App Manifest 與安裝提示」。

import { useCallback, useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { useT } from '@/components/i18n/I18nProvider';
import { Button } from '@/components/ui/button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'assetpilot.installPromptDismissed';

export default function PwaRegistrar() {
  const { t } = useT();
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    // 註冊失敗不影響任何既有功能，僅記錄以便除錯。
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('[pwa] service worker registration failed', error);
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.localStorage.getItem(DISMISS_KEY) === '1') return;
    const handler = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const install = useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice.catch(() => undefined);
    setInstallEvent(null);
  }, [installEvent]);

  const dismiss = useCallback(() => {
    window.localStorage.setItem(DISMISS_KEY, '1');
    setInstallEvent(null);
  }, []);

  if (!installEvent) return null;

  return (
    <div
      className="fixed inset-x-3 top-16 z-40 mx-auto flex max-w-xl items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium shadow-[var(--shadow-glass-lg)] md:inset-x-auto md:end-6 md:mx-0"
      style={{ background: 'var(--surface-glass)', border: '1px solid var(--glass-border)', color: 'var(--text)' }}
      role="dialog"
      aria-label={t('features.pwa.installTitle')}
    >
      <Download size={18} aria-hidden="true" className="shrink-0" />
      <span className="min-w-0 flex-1">{t('features.pwa.installHint')}</span>
      <Button type="button" size="sm" onClick={install}>{t('features.pwa.installAction')}</Button>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t('common.close')}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg transition-colors hover:bg-[var(--surface-hover)]"
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
