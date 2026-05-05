export const dynamic = 'force-dynamic';
import AppLayout from '../../../components/layout/AppLayout';
import TransactionsClient from '../../../components/features/transactions/TransactionsClient';
import { requireServerAuth } from '../../../lib/serverAuth';

export default async function TransactionsPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <TransactionsClient user={user} />
    </AppLayout>
  );
}
