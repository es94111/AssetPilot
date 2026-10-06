import AppLayout from "@/components/layout/AppLayout";
import ApiIntegrationSettingsClient from "@/components/features/settings/ApiIntegrationSettingsClient";
import { requireServerAuth } from "@/lib/serverAuth";

export default async function ApiIntegrationSettingsPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <ApiIntegrationSettingsClient />
    </AppLayout>
  );
}
