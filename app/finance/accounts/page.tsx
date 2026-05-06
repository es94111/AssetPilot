import AppLayout from "@/components/layout/AppLayout";
import AccountsClient from "@/components/features/accounts/AccountsClient";
import { requireServerAuth } from "@/lib/serverAuth";

export default async function AccountsPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <AccountsClient user={user} />
    </AppLayout>
  );
}
