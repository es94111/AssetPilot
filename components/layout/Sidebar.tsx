'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { Gauge, Receipt, ChartBar, Wallet, Building2, Tags, Repeat, Briefcase, Key, User, Shield, Database, LayoutDashboard, Settings } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/dashboard', label: '儀表板', icon: LayoutDashboard, requireAdmin: false },
  { path: '/finance/transactions', label: '交易記錄', icon: Receipt, requireAdmin: false },
  { path: '/finance/reports', label: '統計報表', icon: ChartBar, requireAdmin: false },
  { path: '/finance/budget', label: '預算管理', icon: Wallet, requireAdmin: false },
  { path: '/finance/accounts', label: '帳戶管理', icon: Building2, requireAdmin: false },
  { path: '/finance/categories', label: '分類管理', icon: Tags, requireAdmin: false },
  { path: '/finance/recurring', label: '固定收支', icon: Repeat, requireAdmin: false },
  { path: '/stocks/portfolio', label: '持股總覽', icon: Briefcase, requireAdmin: false },
  { path: '/stocks/transactions', label: '股票交易紀錄', icon: Receipt, requireAdmin: false },
  { path: '/stocks/dividends', label: '股利紀錄', icon: Wallet, requireAdmin: false },
  { path: '/stocks/realized', label: '實現損益', icon: ChartBar, requireAdmin: false },
  { path: '/stocks/settings', label: '股票設定', icon: Key, requireAdmin: false },
  { path: '/settings/export', label: '資料匯出匯入', icon: Database, requireAdmin: false },
  { path: '/settings/account', label: '帳號設定', icon: User, requireAdmin: false },
  { path: '/settings/admin', label: '管理員', icon: Shield, requireAdmin: true },
  { path: '/api-credits', label: 'API 使用與授權', icon: Key, requireAdmin: false },
];

export default function Sidebar({ user }: { user: any }) {
  const pathname = usePathname();
  const router = useRouter();

  const visibleItems = NAV_ITEMS.filter(item => !item.requireAdmin || user?.isAdmin);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-full">
      <div className="p-4 border-b">
        <div className="flex items-center gap-2 font-bold text-lg">
          <Image src="/favicon.svg" alt="" width={28} height={28} />
          <span>AssetPilot</span>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {visibleItems.map(item => {
          const Icon = item.icon;
          const active = pathname === item.path || (item.path !== '/dashboard' && pathname.startsWith(item.path));
          return (
            <button
              key={item.path}
              onClick={() => router.push(item.path)}
              className={`flex items-center gap-3 w-full p-2 rounded-lg transition-colors ${
                active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t space-y-4">
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <User size={16} />
          <span>{user?.displayName || user?.email || '使用者'}</span>
        </div>
        <Button variant="ghost" className="w-full justify-start text-red-600" onClick={handleLogout}>
          登出
        </Button>
      </div>
    </aside>
  );
}

// Minimal Button component for sidebar logout
function Button({ variant = 'default', className = '', ...props }: any) {
  const base = "px-4 py-2 rounded-md font-medium transition-colors";
  const variants = {
    default: "bg-blue-600 text-white hover:bg-blue-700",
    ghost: "bg-transparent hover:bg-slate-100",
  };
  return <button className={`${base} ${variants[variant as keyof typeof variants]} ${className}`} {...props} />;
}
