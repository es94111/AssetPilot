'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { TRANSACTIONS_PATH, transactionsQuickAddHref } from '@/lib/transactionsQuickAdd';
import LedgerSwitcher, { useActiveLedger } from '@/components/features/ledgers/LedgerSwitcher';

export default function TopNav() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { canWrite } = useActiveLedger();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        !canWrite || event.defaultPrevented || event.repeat || event.isComposing
        || !event.altKey || event.ctrlKey || event.metaKey || event.shiftKey
        || (event.code !== 'KeyN' && event.key.toLowerCase() !== 'n')
        || target?.isContentEditable || target?.closest('input, textarea, select, [role="dialog"], dialog')
        || document.querySelector('[role="dialog"][data-state="open"], dialog[open]')
        || searchParams.has('action', 'add')
      ) return;
      event.preventDefault();
      router.push(transactionsQuickAddHref(pathname === TRANSACTIONS_PATH ? searchParams.toString() : ''));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canWrite, pathname, router, searchParams]);

  if (pathname === '/settings/ledgers') return null;

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)] px-4 [padding-top:env(safe-area-inset-top)] lg:hidden">
      <LedgerSwitcher inline />
    </header>
  );
}
