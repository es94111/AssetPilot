export const dynamic = 'force-dynamic';
import AppLayout from '../../../components/layout/AppLayout';
import DataTransferClient from '../../../components/features/data-transfer/DataTransferClient';
import { requireServerAuth } from '../../../lib/serverAuth';

export default async function DataTransferPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <DataTransferClient user={user} />
    </AppLayout>
  );
}
