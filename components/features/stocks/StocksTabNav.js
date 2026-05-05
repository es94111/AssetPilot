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
    <div className="tab-bar stock-tabs" style={{ marginBottom: '1.25rem' }}>
      {TABS.map(t => (
        <button
          key={t.path}
          className={`tab ${pathname === t.path || (t.path === '/stocks/portfolio' && pathname === '/stocks') ? 'active' : ''}`}
          onClick={() => router.push(t.path)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
