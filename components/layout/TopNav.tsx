'use client';

import { Menu } from 'lucide-react';

export default function TopNav({ title, onMenuClick }: { title: string; onMenuClick: () => void }) {
  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 lg:hidden"
      style={{ background: 'var(--surface-glass)', borderBottom: '1px solid var(--glass-border)', backdropFilter: 'var(--glass-blur)', WebkitBackdropFilter: 'var(--glass-blur)' }}
    >
      <button
        className="flex h-9 w-9 items-center justify-center rounded-lg transition-colors duration-150 cursor-pointer"
        style={{ color: 'var(--text-secondary)' }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--border)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
        onClick={onMenuClick}
        aria-label="開啟選單"
      >
        <Menu size={22} />
      </button>
      <h1 className="text-base font-semibold" style={{ color: 'var(--text)' }}>{title}</h1>
    </header>
  );
}
