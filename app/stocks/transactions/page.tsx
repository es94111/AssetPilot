import AppLayout from "@/components/layout/AppLayout";
import StockTxClient from "@/components/features/stocks/StockTxClient";
import { requireServerAuth } from "@/lib/serverAuth";

export default async function TransactionsPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <StockTxClient />
    </AppLayout>
  );
}
