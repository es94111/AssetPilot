import AppLayout from "@/components/layout/AppLayout";
import TagsClient from "@/components/features/tags/TagsClient";
import { requireServerAuth } from "@/lib/serverAuth";

export default async function TagsPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <TagsClient />
    </AppLayout>
  );
}
