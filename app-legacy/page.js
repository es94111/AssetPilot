export const dynamic = 'force-dynamic';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '../lib/auth';

export default async function RootPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('authToken')?.value;

  if (token) {
    try {
      verifyToken(token);
      redirect('/dashboard');
    } catch (_) {
      redirect('/login');
    }
  } else {
    redirect('/login');
  }
}
