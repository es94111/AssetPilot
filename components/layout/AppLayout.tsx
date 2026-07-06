'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import { useT } from '@/components/i18n/I18nProvider';

// 頁首標題對應的譯文鍵，於 render 時用 t() 解析。
const PAGE_TITLE_KEYS: Record<string, string> = {
  '/dashboard':            'nav.dashboard',
  '/finance/info-board':   'nav.infoBoard',
  '/finance/transactions': 'nav.transactions',
  '/finance/reports':      'nav.reports',
  '/finance/budget':       'nav.budget',
  '/finance/accounts':     'nav.accounts',
  '/finance/categories':   'nav.categories',
  '/finance/recurring':    'nav.recurring',
  '/stocks':               'nav.titleStocks',
  '/stocks/portfolio':     'nav.stocksPortfolio',
  '/stocks/transactions':  'nav.titleStockTransactions',
  '/stocks/dividends':     'nav.titleStockDividends',
  '/stocks/realized':      'nav.titleStockRealized',
  '/stocks/settings':      'nav.titleStockSettings',
  '/api-credits':          'nav.titleApiCredits',
  '/settings/account':     'nav.account',
  '/settings/admin':       'nav.admin',
  '/settings/export':      'nav.exportImport',
};

export default function AppLayout({ user, children }: { user: any; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { t } = useT();
  const titleKey = PAGE_TITLE_KEYS[pathname];
  const title = titleKey ? t(titleKey) : 'AssetPilot';

  return (
    <div className="flex h-screen" style={{ background: 'var(--app-bg)' }}>
      <Sidebar user={user} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          style={{ background: 'rgba(0,0,0,0.45)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav title={title} onMenuClick={() => setSidebarOpen(v => !v)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
