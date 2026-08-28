'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT } from '@/components/i18n/I18nProvider';

const TABS = [
  { path: '/stocks/portfolio', key: 'features.stocks.tabs.portfolio' },
  { path: '/stocks/transactions', key: 'features.stocks.tabs.transactions' },
  { path: '/stocks/dividends', key: 'features.stocks.tabs.dividends' },
  { path: '/stocks/realized', key: 'features.stocks.tabs.realized' },
  { path: '/stocks/settings', key: 'features.stocks.tabs.settings' },
];

export default function StocksTabNav() {
  const pathname = usePathname();
  const { t } = useT();

  return (
    <nav aria-label={t('nav.titleStocks')} className="mb-5 flex gap-1 overflow-x-auto border-b" style={{ borderColor: 'var(--border)' }}>
      {TABS.map(tab => {
        const isActive = pathname === tab.path || (tab.path === '/stocks/portfolio' && pathname === '/stocks');
        return (
          <Link
            key={tab.path}
            href={tab.path}
            aria-current={isActive ? 'page' : undefined}
            className="relative flex min-h-11 shrink-0 items-center px-4 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            style={{
              color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
            }}
          >
            {t(tab.key)}
            <span
              aria-hidden="true"
              className="absolute inset-x-2 bottom-0 h-0.5 rounded-full transition-all duration-200"
              style={{
                background: isActive ? 'var(--primary)' : 'transparent',
                boxShadow: isActive ? '0 1px 0 0 var(--primary)' : 'none',
              }}
            />
          </Link>
        );
      })}
    </nav>
  );
}
