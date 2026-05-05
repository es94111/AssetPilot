import AppLayout from "@/components/layout/AppLayout";
import StockSettingsClient from "@/components/features/stocks/StockSettingsClient";
import { requireServerAuth } from "@/lib/auth";

export default async function StockSettingsPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <StockSettingsClient />
    </AppLayout>
  );
}
