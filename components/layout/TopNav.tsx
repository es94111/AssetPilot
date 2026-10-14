'use client';

import { Menu, Sun, Moon, Monitor, Plus } from 'lucide-react';
import type { RefObject } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useT } from '@/components/i18n/I18nProvider';
import { useTheme, type Theme } from '@/hooks/useTheme';

const THEME_OPTIONS: { value: Theme; icon: typeof Sun; labelKey: string }[] = [
  { value: 'light', icon: Sun, labelKey: 'shell.theme.light' },
  { value: 'system', icon: Monitor, labelKey: 'shell.theme.system' },
  { value: 'dark', icon: Moon, labelKey: 'shell.theme.dark' },
];

export default function TopNav({ title, menuOpen, menuButtonRef, onMenuClick }: {
  title: string;
  menuOpen: boolean;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  onMenuClick: () => void;
}) {
  const { t } = useT();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  // 全域快捷鍵：Alt+N 快速開啟新增記帳
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        router.push('/finance/transactions?action=add');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  return (
    <header
      className="app-topnav sticky top-0 z-30 flex min-h-14 items-center gap-2 px-3 [padding-top:max(.5rem,env(safe-area-inset-top))]"
      style={{ background: 'var(--surface-glass)', borderBottom: '1px solid var(--glass-border)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)' }}
    >
      <button
        ref={menuButtonRef}
        className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg transition-colors duration-150 cursor-pointer hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        style={{ color: 'var(--text-secondary)' }}
        onClick={onMenuClick}
        aria-label={menuOpen ? t('shell.closeMenu') : t('shell.openMenu')}
        aria-controls="assetpilot-navigation"
        aria-expanded={menuOpen}
      >
        <Menu size={22} aria-hidden="true" />
      </button>
      <p className="min-w-0 flex-1 truncate text-base font-semibold" style={{ color: 'var(--text)' }}>{title}</p>
      
      {/* 快速新增記帳（Global Quick Action） */}
      <Link
        href="/finance/transactions?action=add"
        title={`${t('features.transactions.add')} (Alt+N)`}
        aria-label={t('features.transactions.add')}
        className="flex h-8 items-center gap-1.5 rounded-lg px-2.5 sm:px-3 text-xs font-semibold shadow-sm transition-all duration-150 cursor-pointer hover:opacity-90 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        style={{
          background: 'var(--primary)',
          color: '#ffffff',
        }}
      >
        <Plus size={15} strokeWidth={2.4} aria-hidden="true" />
        <span className="hidden sm:inline">{t('features.transactions.add')}</span>
      </Link>

      <div
        className="flex shrink-0 items-center gap-0.5 rounded-lg p-0.5"
        style={{ background: 'var(--surface-subtle)' }}
        role="group"
        aria-label={t('settings.account.themeTitle')}
      >
        {THEME_OPTIONS.map(({ value, icon: Icon, labelKey }) => (
          <button
            key={value}
            onClick={() => setTheme(value)}
            aria-label={t(labelKey)}
            aria-pressed={theme === value}
            title={t(labelKey)}
            className="flex h-8 w-8 items-center justify-center rounded-md transition-all duration-150 cursor-pointer hover:bg-[var(--surface-hover)]"
            style={theme === value
              ? { background: 'var(--surface)', color: 'var(--primary)', boxShadow: 'var(--shadow)' }
              : { color: 'var(--text-muted)' }
            }
          >
            <Icon size={15} strokeWidth={theme === value ? 2.2 : 1.8} aria-hidden="true" />
          </button>
        ))}
      </div>
    </header>
  );
}
