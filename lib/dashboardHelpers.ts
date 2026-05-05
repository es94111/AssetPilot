import logger from '@/lib/logger';
import { requireAuth } from '@/lib/auth';

export async function getDashboardData(month?: string) {
  const session = await requireAuth();
  
  const url = month 
    ? `http://localhost:3000/api/dashboard?month=${month}`
    : 'http://localhost:3000/api/dashboard';

  logger.info({ url }, 'Fetching dashboard data');

  const res = await fetch(url, {
    headers: {
      Cookie: `session=${session}`,
    },
  });

  if (!res.ok) {
    logger.error({ status: res.status }, 'Failed to fetch dashboard data');
    throw new Error('Failed to fetch dashboard data');
  }

  return res.json();
}
