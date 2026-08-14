import AppLayout from "@/components/layout/AppLayout";
import McpConnectionsClient from "@/components/features/settings/McpConnectionsClient";
import { requireServerAuth } from "@/lib/serverAuth";

export default async function McpConnectionsPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <McpConnectionsClient />
    </AppLayout>
  );
}
