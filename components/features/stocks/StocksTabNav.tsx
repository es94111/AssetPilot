'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { useT } from '@/components/i18n/I18nProvider';
import Disclosure from '@/components/ui/Disclosure';

const views = [
  { path: '/stocks/portfolio', label: 'mobileLegacy.holdings' },
  { path: '/stocks/transactions', label: 'mobileLegacy.transactions' },
  { path: '/stocks/dividends', label: 'mobileLegacy.dividends' },
  { path: '/stocks/realized', label: 'mobileLegacy.returns' },
] as const;

const returnsViews = [
  { path: '/stocks/realized', label: 'features.stocks.tabs.realized' },
  { path: '/stocks/performance', label: 'features.stocks.tabs.performance' },
] as const;

export default function StocksTabNav({ tools }: { tools?: ReactNode }) {
  const pathname = usePathname();
  const { t } = useT();
  const isReturns = returnsViews.some(({ path }) => pathname === path);

  return (
    <div className="space-y-2">
      <nav aria-label={t('ux.stockView')} className="grid grid-cols-4 gap-1 border-b border-[var(--border)]">
        {views.map(({ path, label }) => {
          const active = path === pathname || (isReturns && path === '/stocks/realized');
          return (
            <Link key={path} href={path}
              aria-current={path === pathname ? 'page' : active ? 'location' : undefined}
              className={`flex min-h-11 min-w-0 items-center justify-center break-words border-b-2 px-1 py-2 text-center text-sm font-medium leading-tight focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] ${active ? 'border-primary text-primary' : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]'}`}>
              <span className="min-w-0">{t(label)}</span>
            </Link>
          );
        })}
      </nav>
      {isReturns && (
        <nav aria-label={t('mobileLegacy.returns')} className="flex flex-wrap gap-2">
          {returnsViews.map(({ path, label }) => (
            <Link key={path} href={path} aria-current={pathname === path ? 'page' : undefined}
              className={`nav-link min-h-11 ${pathname === path ? '' : 'border border-[var(--border)]'}`}>
              {t(label)}
            </Link>
          ))}
        </nav>
      )}
      {pathname !== '/stocks/settings' && (
        <Disclosure title={t('ux.stockTools')} className="max-w-xl">
          <div className="flex flex-wrap items-center gap-2">
            <Link className="nav-link min-h-11" href="/stocks/settings">{t('nav.stocksSettings')}</Link>
            {tools}
          </div>
        </Disclosure>
      )}
    </div>
  );
}
