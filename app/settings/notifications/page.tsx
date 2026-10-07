import AppLayout from '@/components/layout/AppLayout';
import NotificationsSettingsClient from '@/components/features/settings/NotificationsSettingsClient';
import { requireServerAuth } from '@/lib/serverAuth';

export default async function NotificationsSettingsPage() {
  const user = await requireServerAuth();
  return (
    <AppLayout user={user}>
      <NotificationsSettingsClient />
    </AppLayout>
  );
}
