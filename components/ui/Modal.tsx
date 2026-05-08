'use client';

import React, { useEffect, useRef } from 'react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
};

export default function Modal({ open, onClose, title, children, className = '' }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Basic modal logic
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-gray-600/50 dark:bg-black/60 flex items-center justify-center z-50 p-4" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`bg-white rounded-lg shadow-xl dark:bg-slate-900 dark:text-slate-100 w-full max-w-lg ${className}`} role="dialog" aria-modal="true">
        {title && (
          <div className="flex justify-between items-center p-4 border-b dark:border-slate-800">
            <h2 className="text-lg font-semibold">{title}</h2>
            <button className="text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200" onClick={onClose} aria-label="關閉">
              ✕
            </button>
          </div>
        )}
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}
