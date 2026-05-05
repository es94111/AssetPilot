import AppLayout from "@/components/layout/AppLayout";
import BudgetClient from "@/components/features/budget/BudgetClient";
import { requireServerAuth } from "@/lib/auth";

export default async function BudgetPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <BudgetClient />
    </AppLayout>
  );
}
