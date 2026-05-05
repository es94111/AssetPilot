'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import TopNav from './TopNav';

const PAGE_TITLES = {
  '/dashboard':             '儀表板',
  '/finance/transactions':  '交易記錄',
  '/finance/reports':       '統計報表',
  '/finance/budget':        '預算管理',
  '/finance/accounts':      '帳戶管理',
  '/finance/categories':    '分類管理',
  '/finance/recurring':     '固定收支',
  '/stocks':                '持股總覽',
  '/stocks/portfolio':      '持股總覽',
  '/stocks/transactions':   '股票交易紀錄',
  '/stocks/dividends':      '股票股利紀錄',
  '/stocks/realized':       '股票實現損益紀錄',
  '/stocks/settings':       '股票交易設定',
  '/api-credits':           'API 使用與授權',
  '/settings/account':      '帳號設定',
  '/settings/admin':        '管理員',
  '/settings/export':       '資料匯出匯入',
};

/**
 * @param {{ user: object, children: React.ReactNode }} props
 */
export default function AppLayout({ user, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const title = PAGE_TITLES[pathname] || 'AssetPilot';

  return (
    <div className="app-shell">
      <Sidebar user={user} />
      {sidebarOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <div className="main-wrapper">
        <TopNav title={title} onMenuClick={() => setSidebarOpen(v => !v)} />
        <main className="main-content">
          {children}
        </main>
      </div>
    </div>
  );
}
