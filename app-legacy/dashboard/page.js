export const dynamic = 'force-dynamic';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '../../lib/auth';
import { queryOne } from '../../lib/db';
import AppLayout from '../../components/layout/AppLayout';
import DashboardClient from '../../components/features/dashboard/DashboardClient';

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;
  if (!token) redirect('/login');
  let userId;
  try { const d = verifyToken(token); userId = d.userId; } catch (_) { redirect('/login'); }
  const user = queryOne('SELECT id, email, display_name, is_admin, theme_mode FROM users WHERE id = ?', [userId]);
  if (!user) redirect('/login');
  const formattedUser = { id: user.id, email: user.email, displayName: user.display_name, isAdmin: !!user.is_admin, themeMode: user.theme_mode || 'system' };
  return (
    <AppLayout user={formattedUser}>
      <DashboardClient user={formattedUser} />
    </AppLayout>
  );
}
