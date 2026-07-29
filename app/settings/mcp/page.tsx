import AppLayout from "@/components/layout/AppLayout";
import McpSettingsClient from "@/components/features/settings/McpSettingsClient";
import { requireServerAuth } from "@/lib/serverAuth";

export default async function McpSettingsPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <McpSettingsClient />
    </AppLayout>
  );
}
