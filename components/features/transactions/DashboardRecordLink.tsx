'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { useActiveLedger } from '@/components/features/ledgers/LedgerSwitcher';
import { useT } from '@/components/i18n/I18nProvider';
import { buttonVariants } from '@/components/ui/button';
import { transactionsQuickAddHref } from '@/lib/transactionsQuickAdd';

export default function DashboardRecordLink() {
  const { t } = useT();
  const { canWrite } = useActiveLedger();
  if (!canWrite) return null;
  return (
    <Link href={transactionsQuickAddHref()} className={buttonVariants({ className: 'min-h-11 gap-2' })}>
      <Plus size={18} aria-hidden="true" />
      {t('mobileLegacy.addTransaction')}
    </Link>
  );
}
