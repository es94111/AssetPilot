import AppLayout from "@/components/layout/AppLayout";
import ReportsClient from "@/components/features/reports/ReportsClient";
import { requireServerAuth } from "@/lib/auth";

export default async function ReportsPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <ReportsClient />
    </AppLayout>
  );
}
