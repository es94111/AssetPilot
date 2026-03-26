import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Scale, UtensilsCrossed, Settings, LogOut, Heart } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '儀表板' },
  { to: '/body', icon: Scale, label: '身體紀錄' },
  { to: '/diet', icon: UtensilsCrossed, label: '飲食紀錄' },
  { to: '/settings', icon: Settings, label: '設定' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="hidden md:flex md:flex-col md:w-60 bg-white border-r border-gray-200 h-screen sticky top-0">
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Heart className="w-7 h-7 text-primary" />
          <span className="font-heading text-xl font-bold text-text">VitaTrack</span>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-text-muted hover:bg-surface-hover hover:text-text',
              )
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-muted truncate">{user?.name}</span>
          <button
            onClick={logout}
            className="p-2 rounded-lg text-text-muted hover:text-red-500 hover:bg-red-50 transition-colors duration-200 cursor-pointer"
            aria-label="登出"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
