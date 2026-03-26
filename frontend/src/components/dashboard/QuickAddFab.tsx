import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Scale, UtensilsCrossed, Droplets, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export default function QuickAddFab() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const actions = [
    { icon: Scale, label: '體重', action: () => navigate('/body') },
    { icon: UtensilsCrossed, label: '飲食', action: () => navigate('/diet') },
    { icon: Droplets, label: '飲水', action: () => navigate('/diet') },
  ];

  return (
    <div className="fixed bottom-20 right-4 md:bottom-8 md:right-8 z-50 flex flex-col-reverse items-end gap-2">
      {open &&
        actions.map(({ icon: Icon, label, action }) => (
          <button
            key={label}
            onClick={() => { action(); setOpen(false); }}
            className="flex items-center gap-2 bg-white shadow-lg rounded-full pl-4 pr-3 py-2.5 text-sm font-medium text-text hover:bg-surface-hover transition-all duration-200 cursor-pointer"
          >
            {label}
            <Icon className="w-4 h-4 text-primary" />
          </button>
        ))}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-200 cursor-pointer',
          open ? 'bg-gray-700 rotate-45' : 'bg-cta hover:bg-cta-dark',
        )}
        aria-label="快速新增"
      >
        {open ? <X className="w-6 h-6 text-white" /> : <Plus className="w-6 h-6 text-white" />}
      </button>
    </div>
  );
}
