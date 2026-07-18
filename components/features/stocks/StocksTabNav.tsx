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
    <nav aria-label={t('nav.titleStocks')} className="mb-5 flex gap-1 overflow-x-auto border-b border-slate-200">
      {TABS.map(tab => {
        const isActive = pathname === tab.path || (tab.path === '/stocks/portfolio' && pathname === '/stocks');
        return (
          <Link
            key={tab.path}
            href={tab.path}
            aria-current={isActive ? 'page' : undefined}
            className={`flex min-h-11 shrink-0 items-center border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              isActive 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t(tab.key)}
          </Link>
        );
      })}
    </nav>
  );
}
