'use client';

import { usePathname, useRouter } from 'next/navigation';

const TABS = [
  { path: '/stocks/portfolio',     label: '持股總覽' },
  { path: '/stocks/transactions',  label: '交易紀錄' },
  { path: '/stocks/dividends',     label: '股利紀錄' },
  { path: '/stocks/realized',      label: '實現損益' },
  { path: '/stocks/settings',      label: '交易設定' },
];

export default function StocksTabNav() {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="flex gap-2 border-b border-slate-200 mb-5">
      {TABS.map(t => {
        const isActive = pathname === t.path || (t.path === '/stocks/portfolio' && pathname === '/stocks');
        return (
          <button
            key={t.path}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              isActive 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => router.push(t.path)}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
