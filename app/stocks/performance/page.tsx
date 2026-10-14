import AppLayout from "@/components/layout/AppLayout";
import PerformanceClient from "@/components/features/stocks/PerformanceClient";
import { requireServerAuth } from "@/lib/serverAuth";

export default async function PerformancePage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <PerformanceClient />
    </AppLayout>
  );
}
