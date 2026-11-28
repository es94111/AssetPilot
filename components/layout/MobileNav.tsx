'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { activeMainSection, MAIN_NAV } from './navigation';
import { useT } from '@/components/i18n/I18nProvider';

export default function MobileNav() {
  const pathname = usePathname();
  const { t } = useT();
  const activeSection = activeMainSection(pathname);

  return (
    <nav
      aria-label={t('shell.mainNav')}
      className="app-mobile-nav fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t px-2 pb-[env(safe-area-inset-bottom)] lg:hidden"
      style={{
        background: 'var(--surface)',
        borderColor: 'var(--glass-border)',
      }}
    >
      {MAIN_NAV.map(({ id, path, label, icon: Icon }) => {
        const active = activeSection === id;
        return (
          <Link
            key={path}
            href={path}
            aria-current={pathname === path ? 'page' : active ? 'location' : undefined}
            className="flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-0.5 py-2 text-[10.5px] font-semibold transition-colors duration-150 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary"
            style={{ color: active ? 'var(--primary)' : 'var(--text-muted)' }}
          >
            <span
              className="flex h-7 w-11 items-center justify-center rounded-full transition-colors duration-150"
              style={{ background: active ? 'var(--primary-light-bg)' : 'transparent' }}
            >
              <Icon size={18} strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" />
            </span>
            <span className="max-w-full break-words text-center leading-tight">{t(label)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
