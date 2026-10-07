import AppLayout from '@/components/layout/AppLayout';
import GoalsClient from '@/components/features/goals/GoalsClient';
import { requireServerAuth } from '@/lib/serverAuth';

export default async function GoalsPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <GoalsClient />
    </AppLayout>
  );
}
