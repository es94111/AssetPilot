'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import TopNav from './TopNav';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':            '儀表板',
  '/finance/transactions': '交易記錄',
  '/finance/reports':      '統計報表',
  '/finance/budget':       '預算管理',
  '/finance/accounts':     '帳戶管理',
  '/finance/categories':   '分類管理',
  '/finance/recurring':    '固定收支',
  '/stocks':               '持股總覽',
  '/stocks/portfolio':     '持股總覽',
  '/stocks/transactions':  '股票交易紀錄',
  '/stocks/dividends':     '股票股利紀錄',
  '/stocks/realized':      '股票實現損益',
  '/stocks/settings':      '股票交易設定',
  '/api-credits':          'API 使用與授權',
  '/settings/account':     '帳號設定',
  '/settings/admin':       '管理員',
  '/settings/export':      '資料匯出匯入',
};

export default function AppLayout({ user, children }: { user: any; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const title = PAGE_TITLES[pathname] || 'AssetPilot';

  return (
    <div className="flex h-screen" style={{ background: 'var(--bg)' }}>
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
