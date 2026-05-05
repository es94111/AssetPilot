import AppLayout from "@/components/layout/AppLayout";
import DividendsClient from "@/components/features/stocks/DividendsClient";
import { requireServerAuth } from "@/lib/auth";

export default async function DividendsPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <DividendsClient />
    </AppLayout>
  );
}
