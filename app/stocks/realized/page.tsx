import AppLayout from "@/components/layout/AppLayout";
import RealizedClient from "@/components/features/stocks/RealizedClient";
import { requireServerAuth } from "@/lib/auth";

export default async function RealizedPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <RealizedClient />
    </AppLayout>
  );
}
