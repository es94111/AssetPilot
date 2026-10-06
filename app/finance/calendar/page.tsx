import AppLayout from '@/components/layout/AppLayout';
import CalendarClient from '@/components/features/calendar/CalendarClient';
import { requireServerAuth } from '@/lib/serverAuth';
import { isValidIanaTimezone, todayInUserTz } from '@/lib/userTime';

export default async function CalendarPage() {
  const user = await requireServerAuth();
  const timezone = isValidIanaTimezone(user.timezone) ? user.timezone : 'Asia/Taipei';
  const initialDate = todayInUserTz(timezone);
  return (
    <AppLayout user={user}>
      <CalendarClient initialDate={initialDate} />
    </AppLayout>
  );
}
