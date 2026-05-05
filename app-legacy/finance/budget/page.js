export const dynamic = 'force-dynamic';
import AppLayout from '../../../components/layout/AppLayout';
import BudgetClient from '../../../components/features/budget/BudgetClient';
import { requireServerAuth } from '../../../lib/serverAuth';

export default async function BudgetPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <BudgetClient user={user} />
    </AppLayout>
  );
}
