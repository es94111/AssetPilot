'use client';

import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  LayoutDashboard, Receipt, ChartBar, Wallet, Building2, Tags, Repeat,
  Briefcase, Key, User, Shield, Database, LogOut, TrendingUp, Coins,
  BarChart3, Settings2, Sun, Moon, Monitor, Info,
} from 'lucide-react';
import { useState, type ElementType } from 'react';
import { useTheme, type Theme } from '@/hooks/useTheme';
import Modal from '@/components/ui/Modal';

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

const THEME_OPTIONS: { value: Theme; icon: ElementType; label: string }[] = [
  { value: 'light', icon: Sun, label: '亮色' },
  { value: 'system', icon: Monitor, label: '系統' },
  { value: 'dark', icon: Moon, label: '暗色' },
];

type ChangelogItem = {
  tag?: string;
  text?: string;
};

type ChangelogRelease = {
  version?: string;
  date?: string;
  title?: string;
  type?: string;
  changes?: ChangelogItem[];
};

type ChangelogData = {
  currentVersion?: string;
  localCurrentVersion?: string;
  latestVersion?: string;
  updateAvailable?: boolean;
  availableReleases?: ChangelogRelease[];
  releases?: ChangelogRelease[];
};

export default function Sidebar({ user, open, onClose }: { user: any; open?: boolean; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [changelog, setChangelog] = useState<ChangelogData | null>(null);
  const [changelogLoading, setChangelogLoading] = useState(false);
  const [changelogError, setChangelogError] = useState('');

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

  async function handleOpenChangelog() {
    setChangelogOpen(true);
    setChangelogError('');
    if (changelog) return;

    setChangelogLoading(true);
    try {
      const resp = await fetch('/api/changelog', { cache: 'no-store' });
      if (!resp.ok) throw new Error('讀取版本資訊失敗');
      setChangelog(await resp.json());
    } catch (error) {
      setChangelogError(error instanceof Error ? error.message : '讀取版本資訊失敗');
    } finally {
      setChangelogLoading(false);
    }
  }

  const currentVersion = changelog?.localCurrentVersion || changelog?.currentVersion || '未知';
  const latestVersion = changelog?.latestVersion || changelog?.currentVersion || '未知';
  const releasesToShow = (
    changelog?.availableReleases?.length
      ? changelog.availableReleases
      : changelog?.releases || []
  ).slice(0, 10);

  return (
    <>
      <aside
        data-open={open ? 'true' : 'false'}
        className="app-sidebar fixed inset-y-0 left-0 z-50 flex h-full w-64 flex-col transition-transform duration-200"
        style={{ background: 'var(--surface-glass)', borderRight: '1px solid var(--glass-border)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)' }}
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
          <div className="mb-1 flex items-center justify-between rounded-lg px-3 py-1.5" style={{ background: 'var(--border)' }}>
            {THEME_OPTIONS.map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                title={label}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer"
                style={theme === value
                  ? { background: 'var(--surface)', color: 'var(--primary)', boxShadow: 'var(--shadow)' }
                  : { color: 'var(--text-muted)' }
                }
              >
                <Icon size={14} strokeWidth={theme === value ? 2.2 : 1.8} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <button
            onClick={handleOpenChangelog}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 cursor-pointer"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--border)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <Info size={17} strokeWidth={1.8} />
            <span>版本資訊</span>
          </button>
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

      <Modal
        open={changelogOpen}
        onClose={() => setChangelogOpen(false)}
        title="版本資訊"
        className="max-h-[85vh] overflow-hidden"
      >
        {changelogLoading ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>正在讀取版本資訊...</p>
        ) : changelogError ? (
          <p className="text-sm" style={{ color: 'var(--danger)' }}>{changelogError}</p>
        ) : (
          <div className="max-h-[65vh] overflow-y-auto pr-1">
            <div className="mb-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg px-3 py-2" style={{ background: 'var(--border)' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>目前版本</p>
                <p className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{currentVersion}</p>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: 'var(--primary-light-bg)', color: 'var(--primary)' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>可更新版本</p>
                <p className="text-lg font-semibold">{changelog?.updateAvailable ? latestVersion : '已是最新版本'}</p>
              </div>
            </div>
            <p className="mb-3 text-sm font-medium" style={{ color: 'var(--text)' }}>
              {changelog?.updateAvailable ? '可更新內容' : '最近更新內容'}
            </p>
            <div className="space-y-4">
              {releasesToShow.map(release => (
                <section key={release.version} className="border-b pb-4 last:border-b-0 last:pb-0" style={{ borderColor: 'var(--border)' }}>
                  <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                      v{release.version}
                    </h3>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{release.date}</span>
                  </div>
                  {release.title && (
                    <p className="mb-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {release.title}
                    </p>
                  )}
                  <ul className="space-y-1.5">
                    {(release.changes || []).map((change, index) => (
                      <li key={`${release.version}-${index}`} className="flex gap-2 text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                        {change.tag && (
                          <span className="mt-0.5 h-fit rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
                            {change.tag}
                          </span>
                        )}
                        <span>{change.text}</span>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
