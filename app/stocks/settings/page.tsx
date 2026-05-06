import AppLayout from "@/components/layout/AppLayout";
import StockSettingsClient from "@/components/features/stocks/StockSettingsClient";
import { requireServerAuth } from "@/lib/serverAuth";

export default async function StockSettingsPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <StockSettingsClient />
    </AppLayout>
  );
}
