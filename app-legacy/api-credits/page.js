export const dynamic = 'force-dynamic';
import AppLayout from '../../components/layout/AppLayout';
import ApiCreditsClient from '../../components/features/api-credits/ApiCreditsClient';
import { requireServerAuth } from '../../lib/serverAuth';

export default async function ApiCreditsPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <ApiCreditsClient user={user} />
    </AppLayout>
  );
}
