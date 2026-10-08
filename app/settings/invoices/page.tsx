import AppLayout from "@/components/layout/AppLayout";
import InvoiceCarrierSettingsClient from "@/components/features/settings/InvoiceCarrierSettingsClient";
import { requireServerAuth } from "@/lib/serverAuth";

export default async function InvoiceCarrierSettingsPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <InvoiceCarrierSettingsClient />
    </AppLayout>
  );
}
