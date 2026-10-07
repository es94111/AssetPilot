import AppLayout from '@/components/layout/AppLayout';
import GoalsClient from '@/components/features/goals/GoalsClient';
import { requireServerAuth } from '@/lib/serverAuth';
import { cookies } from 'next/headers';
import { queryOne } from '@/lib/db';
import { isValidIanaTimezone } from '@/lib/userTime';

export default async function GoalsPage() {
  const user = await requireServerAuth();
  const cookieStore = await cookies();
  const activeLedgerId = cookieStore.get('activeLedgerId')?.value || '';
  const activeLedger = activeLedgerId
    ? queryOne(
      `SELECT l.timezone, l.is_shared FROM financial_ledgers l
       JOIN ledger_members m ON m.ledger_id = l.id AND m.user_id = ?
       WHERE l.id = ?`,
      [user.id, activeLedgerId],
    )
    : null;
  const selectedTimezone = Number(activeLedger?.is_shared) === 1
    ? String(activeLedger?.timezone || user.timezone || 'Asia/Taipei')
    : String(user.timezone || 'Asia/Taipei');
  const userTimezone = isValidIanaTimezone(selectedTimezone) ? selectedTimezone : 'Asia/Taipei';
  return (
    <AppLayout user={user}>
      <GoalsClient userTimezone={userTimezone} />
    </AppLayout>
  );
}
