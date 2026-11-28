'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import TopNav from './TopNav';
import MobileNav from './MobileNav';
import { activeMainSection } from './navigation';
import { ActiveLedgerProvider, useActiveLedger } from '@/components/features/ledgers/LedgerSwitcher';
import OfflineSyncStatus from '@/components/features/offline/OfflineSyncStatus';
import PwaRegistrar from '@/components/features/pwa/PwaRegistrar';
import { useT } from '@/components/i18n/I18nProvider';

// 頁首標題對應的譯文鍵，於 render 時用 t() 解析。
const PAGE_TITLE_KEYS: Record<string, string> = {
  '/more': 'mobileLegacy.more',
  '/stocks/performance': 'features.stocks.tabs.performance',
  '/dashboard':            'nav.dashboard',
  '/finance/info-board':   'nav.infoBoard',
  '/finance/transactions': 'nav.transactions',
  '/finance/calendar':     'nav.calendar',
  '/finance/reports':      'nav.reports',
  '/finance/budget':       'nav.budget',
  '/finance/goals':        'nav.goals',
  '/finance/accounts':     'nav.accounts',
  '/finance/categories':   'nav.categories',
  '/finance/tags':         'nav.tags',
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
};

export default function AppLayout({ user, children }: { user: any; children: React.ReactNode }) {
  return (
    <ActiveLedgerProvider>
      <AppShell userId={String(user?.id ?? '')}>{children}</AppShell>
    </ActiveLedgerProvider>
  );
}

function AppShell({ userId, children }: { userId: string; children: React.ReactNode }) {
  const { readOnly } = useActiveLedger();
  const pathname = usePathname();
  const { t } = useT();
  const titleKey = PAGE_TITLE_KEYS[pathname];
  const isLedgerView = pathname === '/dashboard' || pathname === '/more'
    || pathname.startsWith('/finance/') || pathname.startsWith('/stocks/')
    || pathname === '/settings/ledgers';
  const title = titleKey ? t(titleKey) : 'AssetPilot';
  const contentProvidesHeading = pathname === '/dashboard'
    || pathname === '/more'
    || pathname === '/finance/info-board'
    || pathname === '/settings/export'
    || pathname === '/settings/ledgers'
    // 對帳頁面自行渲染 <h1>（標題層級由頁面內容決定），避免與 layout 的標題重複。
    || pathname === '/finance/reconciliation';

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
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav />
        <main id="main-content" tabIndex={-1} className="app-main w-full max-w-[1700px] flex-1 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-6 md:pb-[calc(6rem+env(safe-area-inset-bottom))] lg:p-8">
          {activeMainSection(pathname) === 'more' && pathname !== '/more' && (
            <Link href="/more" className="mb-3 inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline">
              {t('mobileLegacy.more')}
            </Link>
          )}
          {readOnly && isLedgerView && (
            <p className="mb-4 rounded-lg border border-[var(--border)] bg-[var(--surface-subtle)] p-3 text-sm text-[var(--text-secondary)]">
              {t('ledger.readOnlyNotice')}
            </p>
          )}
          {!contentProvidesHeading && <h1 className="sr-only">{title}</h1>}
          {children}
        </main>
      </div>
      <MobileNav />
      <OfflineSyncStatus userId={userId} />
      <PwaRegistrar />
    </div>
  );
}
