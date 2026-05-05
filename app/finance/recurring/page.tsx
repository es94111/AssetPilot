import AppLayout from "@/components/layout/AppLayout";
import RecurringClient from "@/components/features/recurring/RecurringClient";
import { requireServerAuth } from "@/lib/auth";

export default async function RecurringPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <RecurringClient />
    </AppLayout>
  );
}
