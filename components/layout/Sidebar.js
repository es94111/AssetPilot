'use client';

import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';

const SVG = (d) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
    strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: d }} />
);

const ICONS = {
  gauge:        '<path d="M12 14l4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  receipt:      '<path d="M4 2v20l3-2 3 2 3-2 3 2 3-2 1 2V2H4z"/><path d="M16 8H8"/><path d="M16 12H8"/><path d="M13 16H8"/>',
  chart:        '<path d="M3 3v18h18"/><path d="M7 14l4-4 4 4 5-5"/>',
  wallet:       '<path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/>',
  bank:         '<rect x="3" y="10" width="18" height="11"/><path d="M3 7l9-5 9 5"/><path d="M7 14v4"/><path d="M12 14v4"/><path d="M17 14v4"/>',
  tags:         '<path d="M9 5H4v5l9 9 5-5z"/><circle cx="6.5" cy="7.5" r="1.5"/><path d="M14 9l7 7-5 5-7-7"/>',
  repeat:       '<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
  briefcase:    '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>',
  gift:         '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  check:        '<polyline points="20 6 9 17 4 12"/>',
  key:          '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3"/>',
  user:         '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  shield:       '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
  database:     '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
  sliders:      '<line x1="4" x2="4" y1="21" y2="14"/><line x1="4" x2="4" y1="10" y2="3"/><line x1="12" x2="12" y1="21" y2="12"/><line x1="12" x2="12" y1="8" y2="3"/><line x1="20" x2="20" y1="21" y2="16"/><line x1="20" x2="20" y1="12" y2="3"/><line x1="2" x2="6" y1="14" y2="14"/><line x1="10" x2="14" y1="8" y2="8"/><line x1="18" x2="22" y1="16" y2="16"/>',
  'arrow-up-down': '<path d="M7 17V3"/><polyline points="3 7 7 3 11 7"/><path d="M17 7v14"/><polyline points="13 17 17 21 21 17"/>',
};

const NAV_ITEMS = [
  { path: '/dashboard',              icon: 'gauge',         label: '儀表板',          requireAdmin: false },
  { path: '/finance/transactions',   icon: 'receipt',       label: '交易記錄',        requireAdmin: false },
  { path: '/finance/reports',        icon: 'chart',         label: '統計報表',        requireAdmin: false },
  { path: '/finance/budget',         icon: 'wallet',        label: '預算管理',        requireAdmin: false },
  { path: '/finance/accounts',       icon: 'bank',          label: '帳戶管理',        requireAdmin: false },
  { path: '/finance/categories',     icon: 'tags',          label: '分類管理',        requireAdmin: false },
  { path: '/finance/recurring',      icon: 'repeat',        label: '固定收支',        requireAdmin: false },
  { path: '/stocks',                 icon: 'briefcase',     label: '持股總覽',        requireAdmin: false },
  { path: '/api-credits',            icon: 'key',           label: 'API 使用與授權',  requireAdmin: false },
  { path: '/settings/account',       icon: 'user',          label: '帳號設定',        requireAdmin: false },
  { path: '/settings/admin',         icon: 'shield',        label: '管理員',          requireAdmin: true  },
  { path: '/settings/export',        icon: 'database',      label: '資料匯出匯入',    requireAdmin: false },
];

/**
 * @param {{ user: { displayName: string, isAdmin: boolean, email?: string } }} props
 */
export default function Sidebar({ user }) {
  const pathname = usePathname();
  const router = useRouter();

  const visibleItems = NAV_ITEMS.filter(item => !item.requireAdmin || user?.isAdmin);

  function isActive(itemPath) {
    if (itemPath === '/dashboard') return pathname === '/dashboard';
    return pathname.startsWith(itemPath);
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <aside className="sidebar" id="sidebar">
      <div className="sidebar-top">
        <div className="sidebar-header">
          <Image src="/favicon.svg" alt="" width={28} height={28} className="sidebar-logo-img" />
          <span>AssetPilot</span>
        </div>
      </div>

      <nav className="sidebar-mid">
        <div className="sidebar-nav">
          {visibleItems.map(item => (
            <a
              key={item.path}
              href={item.path}
              className={`nav-item${isActive(item.path) ? ' active' : ''}`}
              onClick={e => {
                e.preventDefault();
                router.push(item.path);
              }}
            >
              <span className="nav-icon">{SVG(ICONS[item.icon] || '')}</span>
              <span className="nav-label">{item.label}</span>
            </a>
          ))}
        </div>
      </nav>

      <div className="sidebar-bottom">
        <div className="sidebar-legal-links">
          <a href="/privacy" className="sidebar-legal-link">
            <i className="fas fa-shield-halved" />隱私權政策
          </a>
          <span className="sidebar-legal-sep">·</span>
          <a href="/terms" className="sidebar-legal-link">
            <i className="fas fa-file-contract" />服務條款
          </a>
        </div>
        <div className="sidebar-footer" id="sidebarFooter">
          <div className="user-info">
            <i className="fas fa-user-circle" />
            <span>{user?.displayName || user?.email || '使用者'}</span>
          </div>
          <button className="btn-icon logout-btn" onClick={handleLogout} title="登出">
            <i className="fas fa-right-from-bracket" />
          </button>
        </div>
      </div>
    </aside>
  );
}
