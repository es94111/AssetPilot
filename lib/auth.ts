import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function getSession() {
  const cookieStore = await cookies();
  const session = cookieStore.get('session'); // 假設使用 'session' cookie

  if (!session) {
    return null;
  }

  return session.value;
}

export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    redirect('/login');
  }
  return session;
}
