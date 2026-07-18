'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Receipt, Briefcase, User } from 'lucide-react';
import { useT } from '@/components/i18n/I18nProvider';

const MOBILE_NAV_ITEMS = [
  { path: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard },
  { path: '/finance/transactions', labelKey: 'nav.transactions', icon: Receipt },
  { path: '/stocks/portfolio', labelKey: 'nav.stocksPortfolio', icon: Briefcase },
  { path: '/settings/account', labelKey: 'nav.account', icon: User },
];

export default function MobileNav() {
  const pathname = usePathname();
  const { t } = useT();

  return (
    <nav
      aria-label={t('nav.sections.finance')}
      className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t px-2 pb-[env(safe-area-inset-bottom)] lg:hidden"
      style={{
        background: 'var(--surface-glass)',
        borderColor: 'var(--glass-border)',
        backdropFilter: 'var(--glass-blur)',
        WebkitBackdropFilter: 'var(--glass-blur)',
      }}
    >
      {MOBILE_NAV_ITEMS.map(({ path, labelKey, icon: Icon }) => {
        const active = path === '/stocks/portfolio'
          ? pathname.startsWith('/stocks')
          : pathname === path || (path !== '/dashboard' && pathname.startsWith(path));
        return (
          <Link
            key={path}
            href={path}
            aria-current={active ? 'page' : undefined}
            className="flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[11px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
            style={{ color: active ? 'var(--primary)' : 'var(--text-muted)' }}
          >
            <span
              className="flex h-7 w-12 items-center justify-center rounded-full transition-colors"
              style={{ background: active ? 'var(--primary-light-bg)' : 'transparent' }}
            >
              <Icon size={19} strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" />
            </span>
            <span className="max-w-full truncate">{t(labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
