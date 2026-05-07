'use client';

import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  LayoutDashboard, Receipt, ChartBar, Wallet, Building2, Tags, Repeat,
  Briefcase, Key, User, Shield, Database, LogOut, TrendingUp, Coins,
  BarChart3, Settings2,
} from 'lucide-react';

const NAV_SECTIONS = [
  {
    label: '財務管理',
    items: [
      { path: '/dashboard',            label: '儀表板',    icon: LayoutDashboard },
      { path: '/finance/transactions', label: '交易記錄',  icon: Receipt },
      { path: '/finance/reports',      label: '統計報表',  icon: ChartBar },
      { path: '/finance/budget',       label: '預算管理',  icon: Wallet },
      { path: '/finance/accounts',     label: '帳戶管理',  icon: Building2 },
      { path: '/finance/categories',   label: '分類管理',  icon: Tags },
      { path: '/finance/recurring',    label: '固定收支',  icon: Repeat },
    ],
  },
  {
    label: '股票投資',
    items: [
      { path: '/stocks/portfolio',     label: '持股總覽',      icon: Briefcase },
      { path: '/stocks/transactions',  label: '股票交易紀錄',  icon: TrendingUp },
      { path: '/stocks/dividends',     label: '股利紀錄',      icon: Coins },
      { path: '/stocks/realized',      label: '實現損益',      icon: BarChart3 },
      { path: '/stocks/settings',      label: '股票設定',      icon: Settings2 },
    ],
  },
  {
    label: '系統設定',
    adminOnly: false,
    items: [
      { path: '/settings/export',  label: '資料匯出匯入', icon: Database },
      { path: '/settings/account', label: '帳號設定',     icon: User },
      { path: '/api-credits',      label: 'API 授權',     icon: Key },
      { path: '/settings/admin',   label: '管理員',       icon: Shield, requireAdmin: true },
    ],
  },
];

export default function Sidebar({ user, open, onClose }: { user: any; open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    onClose?.();
    router.push('/login');
    router.refresh();
  }

  function handleNavigate(path: string) {
    onClose?.();
    router.push(path);
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col transform transition-transform duration-200 lg:static lg:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      style={{ background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <Image src="/favicon.svg" alt="" width={28} height={28} />
        <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--text)' }}>AssetPilot</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {NAV_SECTIONS.map(section => {
          const visibleItems = section.items.filter(item => !(item as any).requireAdmin || user?.isAdmin);
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.label}>
              <p className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                {section.label}
              </p>
              <div className="space-y-0.5">
                {visibleItems.map(item => {
                  const Icon = item.icon;
                  const active = pathname === item.path || (item.path !== '/dashboard' && pathname.startsWith(item.path));
                  return (
                    <button
                      key={item.path}
                      onClick={() => handleNavigate(item.path)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 cursor-pointer"
                      style={active
                        ? { background: 'var(--primary-light-bg)', color: 'var(--primary)' }
                        : { color: 'var(--text-secondary)' }
                      }
                      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--border)'; }}
                      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                      <span>{item.label}</span>
                      {active && (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full" style={{ background: 'var(--primary)' }} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 pb-4" style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
        <div className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold"
            style={{ background: 'var(--primary-light-bg)', color: 'var(--primary)' }}
          >
            {(user?.displayName || user?.email || 'U')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium" style={{ color: 'var(--text)' }}>
              {user?.displayName || '使用者'}
            </p>
            <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
              {user?.email || ''}
            </p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 cursor-pointer"
          style={{ color: 'var(--danger)' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--danger-bg)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        >
          <LogOut size={17} strokeWidth={1.8} />
          <span>登出</span>
        </button>
      </div>
    </aside>
  );
}
