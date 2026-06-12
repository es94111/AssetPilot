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
import { useT } from '@/components/i18n/I18nProvider';
import Modal from '@/components/ui/Modal';

// label 以譯文鍵（labelKey）表示，於 render 時用 t() 解析。
const NAV_SECTIONS = [
  {
    labelKey: 'nav.sections.finance',
    items: [
      { path: '/dashboard',            labelKey: 'nav.dashboard',          icon: LayoutDashboard },
      { path: '/finance/transactions', labelKey: 'nav.transactions',       icon: Receipt },
      { path: '/finance/reports',      labelKey: 'nav.reports',            icon: ChartBar },
      { path: '/finance/budget',       labelKey: 'nav.budget',             icon: Wallet },
      { path: '/finance/accounts',     labelKey: 'nav.accounts',           icon: Building2 },
      { path: '/finance/categories',   labelKey: 'nav.categories',         icon: Tags },
      { path: '/finance/recurring',    labelKey: 'nav.recurring',          icon: Repeat },
    ],
  },
  {
    labelKey: 'nav.sections.stocks',
    items: [
      { path: '/stocks/portfolio',     labelKey: 'nav.stocksPortfolio',    icon: Briefcase },
      { path: '/stocks/transactions',  labelKey: 'nav.stocksTransactions', icon: TrendingUp },
      { path: '/stocks/dividends',     labelKey: 'nav.stocksDividends',    icon: Coins },
      { path: '/stocks/realized',      labelKey: 'nav.stocksRealized',     icon: BarChart3 },
      { path: '/stocks/settings',      labelKey: 'nav.stocksSettings',     icon: Settings2 },
    ],
  },
  {
    labelKey: 'nav.sections.system',
    adminOnly: false,
    items: [
      { path: '/settings/export',  labelKey: 'nav.exportImport', icon: Database },
      { path: '/settings/account', labelKey: 'nav.account',      icon: User },
      { path: '/api-credits',      labelKey: 'nav.apiCredits',   icon: Key },
      { path: '/settings/admin',   labelKey: 'nav.admin',        icon: Shield, requireAdmin: true },
    ],
  },
];

const THEME_OPTIONS: { value: Theme; icon: ElementType; labelKey: string }[] = [
  { value: 'light', icon: Sun, labelKey: 'shell.theme.light' },
  { value: 'system', icon: Monitor, labelKey: 'shell.theme.system' },
  { value: 'dark', icon: Moon, labelKey: 'shell.theme.dark' },
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
  const { t } = useT();
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
      if (!resp.ok) throw new Error(t('shell.changelog.loadFailed'));
      setChangelog(await resp.json());
    } catch (error) {
      setChangelogError(error instanceof Error ? error.message : t('shell.changelog.loadFailed'));
    } finally {
      setChangelogLoading(false);
    }
  }

  const currentVersion = changelog?.localCurrentVersion || changelog?.currentVersion || t('shell.changelog.unknownVersion');
  const latestVersion = changelog?.latestVersion || changelog?.currentVersion || t('shell.changelog.unknownVersion');
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
              <div key={section.labelKey}>
                <p className="mb-1.5 px-2 text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  {t(section.labelKey)}
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
                        <span>{t(item.labelKey)}</span>
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
                {user?.displayName || t('shell.fallbackUser')}
              </p>
              <p className="truncate text-xs" style={{ color: 'var(--text-muted)' }}>
                {user?.email || ''}
              </p>
            </div>
          </div>
          <div className="mb-1 flex items-center justify-between rounded-lg px-3 py-1.5" style={{ background: 'var(--border)' }}>
            {THEME_OPTIONS.map(({ value, icon: Icon, labelKey }) => (
              <button
                key={value}
                onClick={() => setTheme(value)}
                title={t(labelKey)}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors duration-150 cursor-pointer"
                style={theme === value
                  ? { background: 'var(--surface)', color: 'var(--primary)', boxShadow: 'var(--shadow)' }
                  : { color: 'var(--text-muted)' }
                }
              >
                <Icon size={14} strokeWidth={theme === value ? 2.2 : 1.8} />
                <span>{t(labelKey)}</span>
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
            <span>{t('shell.versionInfo')}</span>
          </button>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 cursor-pointer"
            style={{ color: 'var(--danger)' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--danger-bg)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
          >
            <LogOut size={17} strokeWidth={1.8} />
            <span>{t('shell.logout')}</span>
          </button>
        </div>
      </aside>

      <Modal
        open={changelogOpen}
        onClose={() => setChangelogOpen(false)}
        title={t('shell.versionInfo')}
        className="max-h-[85vh] overflow-hidden"
      >
        {changelogLoading ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('shell.changelog.loading')}</p>
        ) : changelogError ? (
          <p className="text-sm" style={{ color: 'var(--danger)' }}>{changelogError}</p>
        ) : (
          <div className="max-h-[65vh] overflow-y-auto pr-1">
            <div className="mb-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg px-3 py-2" style={{ background: 'var(--border)' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('shell.changelog.currentVersion')}</p>
                <p className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{currentVersion}</p>
              </div>
              <div className="rounded-lg px-3 py-2" style={{ background: 'var(--primary-light-bg)', color: 'var(--primary)' }}>
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{t('shell.changelog.updatableVersion')}</p>
                <p className="text-lg font-semibold">{changelog?.updateAvailable ? latestVersion : t('shell.changelog.upToDate')}</p>
              </div>
            </div>
            <p className="mb-3 text-sm font-medium" style={{ color: 'var(--text)' }}>
              {changelog?.updateAvailable ? t('shell.changelog.updatableContent') : t('shell.changelog.recentContent')}
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
