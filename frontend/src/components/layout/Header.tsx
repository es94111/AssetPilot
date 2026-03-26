import { Heart, LogOut } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Header() {
  const { user, logout } = useAuth();

  return (
    <header className="md:hidden sticky top-0 z-40 bg-white border-b border-gray-200 px-4 h-14 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <Heart className="w-5 h-5 text-primary" />
        <span className="font-heading text-lg font-bold">VitaTrack</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm text-text-muted">{user?.name}</span>
        <button
          onClick={logout}
          className="p-2 rounded-lg text-text-muted hover:text-red-500 transition-colors duration-200 cursor-pointer"
          aria-label="登出"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
}
