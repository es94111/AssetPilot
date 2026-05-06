import AppLayout from "@/components/layout/AppLayout";
import DividendsClient from "@/components/features/stocks/DividendsClient";
import { requireServerAuth } from "@/lib/serverAuth";

export default async function DividendsPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <DividendsClient />
    </AppLayout>
  );
}
