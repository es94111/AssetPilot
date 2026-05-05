import AppLayout from "@/components/layout/AppLayout";
import AdminClient from "@/components/features/admin/AdminClient";
import { requireServerAdmin } from "@/lib/serverAuth";

export default async function AdminPage() {
  const user = await requireServerAdmin();
  return (
    <AppLayout user={user}>
      <AdminClient />
    </AppLayout>
  );
}
