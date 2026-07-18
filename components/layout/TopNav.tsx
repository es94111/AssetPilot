'use client';

import { Menu } from 'lucide-react';
import type { RefObject } from 'react';
import { useT } from '@/components/i18n/I18nProvider';

export default function TopNav({ title, menuOpen, menuButtonRef, onMenuClick }: {
  title: string;
  menuOpen: boolean;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  onMenuClick: () => void;
}) {
  const { t } = useT();
  return (
    <header
      className="app-topnav sticky top-0 z-30 flex min-h-14 items-center gap-3 px-4 [padding-top:max(.75rem,env(safe-area-inset-top))]"
      style={{ background: 'var(--surface-glass)', borderBottom: '1px solid var(--glass-border)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)' }}
    >
      <button
        ref={menuButtonRef}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--border)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        onClick={onMenuClick}
        aria-label={t('shell.openMenu')}
        aria-controls="assetpilot-navigation"
        aria-expanded={menuOpen}
      >
        <Menu size={22} aria-hidden="true" />
      </button>
      <p className="truncate text-base font-semibold" style={{ color: 'var(--text)' }}>{title}</p>
    </header>
  );
}
