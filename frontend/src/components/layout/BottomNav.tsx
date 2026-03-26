import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Scale, UtensilsCrossed, Settings } from 'lucide-react';
import { cn } from '../../lib/utils';

const navItems = [
  { to: '/', icon: LayoutDashboard, label: '儀表板' },
  { to: '/body', icon: Scale, label: '身體' },
  { to: '/diet', icon: UtensilsCrossed, label: '飲食' },
  { to: '/settings', icon: Settings, label: '設定' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 md:hidden bg-white border-t border-gray-200 z-50 pb-safe">
      <div className="flex items-center justify-around h-16">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-0.5 w-16 h-full text-xs transition-colors duration-200 cursor-pointer',
                isActive ? 'text-primary' : 'text-text-muted',
              )
            }
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
