'use client';

import React, { createContext, useCallback, useContext, useState, ReactNode } from 'react';

type ToastType = 'info' | 'success' | 'error';
type Toast = { id: number; message: string; type: ToastType };

const ToastContext = createContext<((message: string, type?: ToastType, duration?: number) => void) | null>(null);

let _id = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((message: string, type: ToastType = 'info', duration: number = 3000) => {
    const id = ++_id;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const typeClasses = {
    info: 'bg-blue-500 text-white',
    success: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
  };

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`px-4 py-2 rounded shadow-lg flex items-center gap-2 ${typeClasses[t.type]}`}>
            <span>{t.message}</span>
            <button onClick={() => dismiss(t.id)} aria-label="關閉" className="hover:opacity-75">
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
