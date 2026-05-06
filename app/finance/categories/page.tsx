import AppLayout from "@/components/layout/AppLayout";
import CategoriesClient from "@/components/features/categories/CategoriesClient";
import { requireServerAuth } from "@/lib/serverAuth";

export default async function CategoriesPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <CategoriesClient />
    </AppLayout>
  );
}
