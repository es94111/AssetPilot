import { FolderOpen, LayoutDashboard, Receipt, TrendingUp } from 'lucide-react';

export const MAIN_NAV = [
  { id: 'home', path: '/dashboard', label: 'mobileLegacy.home', icon: LayoutDashboard },
  { id: 'transactions', path: '/finance/transactions', label: 'ux.bookkeeping', icon: Receipt },
  { id: 'stocks', path: '/stocks/portfolio', label: 'features.common.stock', icon: TrendingUp },
  { id: 'more', path: '/more', label: 'mobileLegacy.more', icon: FolderOpen },
] as const;

export function activeMainSection(pathname: string): (typeof MAIN_NAV)[number]['id'] {
  if (pathname === '/dashboard') return 'home';
  if (pathname === '/finance/transactions' || pathname.startsWith('/finance/transactions/')) return 'transactions';
  if (pathname === '/stocks' || pathname.startsWith('/stocks/')) return 'stocks';
  return 'more';
}
