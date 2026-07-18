'use client';

import React from 'react';
import { useT } from '@/components/i18n/I18nProvider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
};

/** Compatibility wrapper for older callers; interaction is delegated to Base UI. */
export default function Modal({ open, onClose, title, children, className = '' }: ModalProps) {
  const { t } = useT();

  return (
    <Dialog open={open} onOpenChange={nextOpen => { if (!nextOpen) onClose(); }}>
      <DialogContent
        className={`max-h-[calc(100dvh-2rem)] overflow-y-auto ${className}`}
        closeLabel={t('common.close')}
      >
        {title && (
          <DialogHeader className="border-b pb-3 pr-10">
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
        )}
        <div>{children}</div>
      </DialogContent>
    </Dialog>
  );
}
