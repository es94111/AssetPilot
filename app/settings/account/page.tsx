import AppLayout from "@/components/layout/AppLayout";
import AccountSettingsClient from "@/components/features/settings/AccountSettingsClient";
import { requireServerAuth } from "@/lib/serverAuth";

export default async function AccountSettingsPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <AccountSettingsClient user={user} />
    </AppLayout>
  );
}
