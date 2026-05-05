export const dynamic = 'force-dynamic';
import AppLayout from '../../../components/layout/AppLayout';
import StockTxClient from '../../../components/features/stocks/StockTxClient';
import { requireServerAuth } from '../../../lib/serverAuth';

export default async function StockTxPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <StockTxClient user={user} />
    </AppLayout>
  );
}
