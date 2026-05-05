'use client';

import { Menu } from 'lucide-react';

export default function TopNav({ title, onMenuClick }: { title: string; onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-4 lg:hidden">
      <button className="p-2 rounded-md hover:bg-slate-100" onClick={onMenuClick} aria-label="開啟選單">
        <Menu size={24} />
      </button>
      <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
    </header>
  );
}
