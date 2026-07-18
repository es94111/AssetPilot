'use client';

import React, { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react';
import { useT } from '@/components/i18n/I18nProvider';

type ToastType = 'info' | 'success' | 'error';
type Toast = { id: number; message: string; type: ToastType };
type ShowToast = (message: string, type?: ToastType, duration?: number) => void;

const ToastContext = createContext<ShowToast | null>(null);
let _id = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const { t } = useT();

  const show = useCallback<ShowToast>((message, type = 'info', duration = 3000) => {
    const id = ++_id;
    setToasts(prev => [...prev, { id, message, type }]);
    window.setTimeout(() => setToasts(prev => prev.filter(toast => toast.id !== id)), duration);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  useEffect(() => () => setToasts([]), []);

  const icons = {
    info: Info,
    success: CheckCircle2,
    error: TriangleAlert,
  };
  const typeClasses = {
    info: 'bg-blue-600 text-white',
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
  };

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-2 [padding-bottom:env(safe-area-inset-bottom)]" aria-live="polite" aria-atomic="false">
        {toasts.map(toast => {
          const Icon = icons[toast.type];
          return (
            <div key={toast.id} role={toast.type === 'error' ? 'alert' : 'status'} className={`flex items-center gap-2 rounded px-4 py-2 shadow-lg ${typeClasses[toast.type]}`}>
              <Icon size={18} aria-hidden="true" />
              <span className="min-w-0 flex-1">{toast.message}</span>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label={t('common.close')}
                className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

export type { ToastType, ShowToast };
