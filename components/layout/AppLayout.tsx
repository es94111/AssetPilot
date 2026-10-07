'use client';

import { useCallback, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import MobileNav from './MobileNav';
import OfflineSyncStatus from '@/components/features/offline/OfflineSyncStatus';
import PwaRegistrar from '@/components/features/pwa/PwaRegistrar';
import { useT } from '@/components/i18n/I18nProvider';

// 頁首標題對應的譯文鍵，於 render 時用 t() 解析。
const PAGE_TITLE_KEYS: Record<string, string> = {
  '/dashboard':            'nav.dashboard',
  '/finance/info-board':   'nav.infoBoard',
  '/finance/transactions': 'nav.transactions',
  '/finance/calendar':     'nav.calendar',
  '/finance/reports':      'nav.reports',
  '/finance/budget':       'nav.budget',
  '/finance/goals':        'nav.goals',
  '/finance/accounts':     'nav.accounts',
  '/finance/categories':   'nav.categories',
  '/finance/recurring':    'nav.recurring',
  '/finance/reconciliation': 'nav.reconciliation',
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
  '/settings/ledgers':       'nav.ledgers',
  '/settings/mcp':           'nav.mcp',
  '/settings/mcp-connections': 'nav.mcpConnections',
  '/settings/api-integration': 'nav.apiIntegration',
  '/settings/notifications':   'nav.notifications',
  '/settings/invoices':       'nav.cloudInvoice',
};

export default function AppLayout({ user, children }: { user: any; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const { t } = useT();
  const titleKey = PAGE_TITLE_KEYS[pathname];
  const title = titleKey ? t(titleKey) : 'AssetPilot';
  const contentProvidesHeading = pathname === '/dashboard'
    || pathname === '/finance/info-board'
    || pathname === '/settings/export'
    || pathname === '/settings/ledgers'
    // 對帳頁面自行渲染 <h1>（標題層級由頁面內容決定），避免與 layout 的標題重複。
    || pathname === '/finance/reconciliation';

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
    window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  }, []);

  // 綁定目前登入使用者由 OfflineSyncStatus 在啟動同步前完成，避免 child effect
  // 先於此 layout effect 執行、使舊佇列以未綁定使用者的 key 開始同步。
  return (
    <div className="flex min-h-dvh" style={{ background: 'var(--app-bg)' }}>
      <a
        href="#main-content"
        className="fixed start-4 top-4 z-[100] -translate-y-24 rounded-lg bg-primary px-4 py-2 font-semibold text-white shadow-lg transition-transform focus:translate-y-0"
      >
        {t('shell.skipToContent')}
      </a>
      <Sidebar user={user} open={sidebarOpen} onClose={closeSidebar} />
      {sidebarOpen && (
        <button
          type="button"
          aria-label={t('common.close')}
          className="fixed inset-0 z-40 cursor-default border-0 bg-black/45 lg:hidden"
          onClick={closeSidebar}
        />
      )}
      <div
        className="flex min-w-0 flex-1 flex-col overflow-hidden"
        inert={sidebarOpen ? true : undefined}
        aria-hidden={sidebarOpen ? true : undefined}
      >
        <TopNav
          title={title}
          menuOpen={sidebarOpen}
          menuButtonRef={menuButtonRef}
          onMenuClick={() => sidebarOpen ? closeSidebar() : setSidebarOpen(true)}
        />
        <main id="main-content" tabIndex={-1} className="app-main w-full max-w-[1700px] flex-1 overflow-y-auto p-4 pb-24 md:p-6 md:pb-24 lg:p-8 lg:pb-8">
          {!contentProvidesHeading && <h1 className="sr-only">{title}</h1>}
          {children}
        </main>
      </div>
      <div inert={sidebarOpen ? true : undefined} aria-hidden={sidebarOpen ? true : undefined}>
        <MobileNav />
      </div>
      <OfflineSyncStatus userId={String(user?.id ?? '')} />
      <PwaRegistrar />
    </div>
  );
}
