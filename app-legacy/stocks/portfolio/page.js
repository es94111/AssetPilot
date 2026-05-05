export const dynamic = 'force-dynamic';
import AppLayout from '../../../components/layout/AppLayout';
import PortfolioClient from '../../../components/features/stocks/PortfolioClient';
import { requireServerAuth } from '../../../lib/serverAuth';

export default async function PortfolioPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <PortfolioClient user={user} />
    </AppLayout>
  );
}
