'use client';

import { usePathname, useRouter } from 'next/navigation';
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
  const router = useRouter();
  const { t } = useT();

  return (
    <div className="flex gap-2 border-b border-slate-200 mb-5">
      {TABS.map(tab => {
        const isActive = pathname === tab.path || (tab.path === '/stocks/portfolio' && pathname === '/stocks');
        return (
          <button
            key={tab.path}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              isActive 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => router.push(tab.path)}
          >
            {t(tab.key)}
          </button>
        );
      })}
    </div>
  );
}
