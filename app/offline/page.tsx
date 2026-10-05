import type { Metadata } from 'next';
import Link from 'next/link';
import { CloudOff } from 'lucide-react';
import { getTranslator } from '@/lib/i18n/getDictionary';
import { resolveLocale } from '@/lib/i18n/resolveLocale';

// 離線頁：Service Worker 在導覽請求失敗時回退至此頁（見 public/sw.js）。
// 刻意不使用任何 client JS，讓它在沒有網路時也能從快取完整顯示。

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  const t = getTranslator(locale);
  return {
    title: t('features.offline.pageTitle'),
    robots: { index: false, follow: false },
  };
}

export default async function OfflinePage() {
  const locale = await resolveLocale();
  const t = getTranslator(locale);

  return (
    <main
      className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center"
      style={{ background: 'var(--app-bg)', color: 'var(--text)' }}
    >
      <CloudOff size={48} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
      <h1 className="text-xl font-semibold">{t('features.offline.pageTitle')}</h1>
      <p className="max-w-md text-sm" style={{ color: 'var(--text-secondary)' }}>
        {t('features.offline.pageBody')}
      </p>
      <Link
        href="/finance/transactions"
        className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-medium"
        style={{ background: 'var(--primary-solid)', color: 'var(--text-on-primary)' }}
      >
        {t('features.offline.pageAction')}
      </Link>
    </main>
  );
}
