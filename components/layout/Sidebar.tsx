'use client';

import Image from 'next/image';
import Link from 'next/link';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useT } from '@/components/i18n/I18nProvider';
import LedgerSwitcher from '@/components/features/ledgers/LedgerSwitcher';
import { activeMainSection, MAIN_NAV } from './navigation';

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

export default function Sidebar() {
  const pathname = usePathname();
  const { t } = useT();
  const [collapsed, setCollapsed] = useState(false);
  const activeSection = activeMainSection(pathname);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1');
    } catch {
      // Storage can be unavailable in a private browser session.
    }
  }, []);

  const toggleLabel = t(collapsed ? 'shell.expandSidebar' : 'shell.collapseSidebar');
  return (
    <aside
      data-collapsed={collapsed}
      className="app-sidebar hidden min-h-dvh w-64 shrink-0 flex-col border-e border-[var(--border)] bg-[var(--surface)] lg:flex lg:data-[collapsed=true]:w-[4.5rem]"
    >
      <div className={`flex min-h-16 items-center gap-3 border-b border-[var(--border)] px-4 ${collapsed ? 'justify-center' : ''}`}>
        <Image src="/favicon.svg" alt="" width={28} height={28} />
        {!collapsed && <span className="font-bold">AssetPilot</span>}
      </div>
      <LedgerSwitcher compact={collapsed} />
      <nav className="flex-1 space-y-1 px-3 py-4" aria-label={t('shell.mainNav')}>
        {MAIN_NAV.map(({ id, path, label, icon: Icon }) => (
          <Link
            key={id}
            href={path}
            aria-current={pathname === path ? 'page' : activeSection === id ? 'location' : undefined}
            aria-label={collapsed ? t(label) : undefined}
            title={collapsed ? t(label) : undefined}
            className={`nav-link min-h-11 gap-2.5 ${collapsed ? 'justify-center px-0' : ''}`}
          >
            <Icon size={19} aria-hidden="true" />
            {!collapsed && <span className="min-w-0 flex-1">{t(label)}</span>}
          </Link>
        ))}
      </nav>
      <div className="border-t border-[var(--border)] p-3">
        <button
          type="button"
          className={`nav-link min-h-11 gap-2.5 w-full text-start ${collapsed ? 'justify-center px-0' : ''}`}
          title={toggleLabel}
          aria-label={toggleLabel}
          aria-expanded={!collapsed}
          onClick={() => {
            const next = !collapsed;
            setCollapsed(next);
            try {
              window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? '1' : '0');
            } catch {
              // Keep the current preference for this session.
            }
          }}
        >
          {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
          {!collapsed && <span>{toggleLabel}</span>}
        </button>
      </div>
    </aside>
  );
}
