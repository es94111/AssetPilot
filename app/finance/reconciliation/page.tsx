export const dynamic = 'force-dynamic';
import AppLayout from '../../../components/layout/AppLayout';
import ReconciliationClient from '../../../components/features/reconciliation/ReconciliationClient';
import { requireServerAuth } from '../../../lib/serverAuth';

export default async function ReconciliationPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <ReconciliationClient />
    </AppLayout>
  );
}
