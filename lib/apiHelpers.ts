import { requireAuth } from '@/lib/auth';
import logger from '@/lib/logger';

export async function fetchFromExpressApi(endpoint: string) {
  const session = await requireAuth();
  const url = `http://localhost:3000${endpoint}`;
  
  const res = await fetch(url, {
    headers: {
      Cookie: `session=${session}`,
    },
  });

  if (!res.ok) {
    logger.error({ status: res.status, url }, 'Failed to fetch from Express API');
    throw new Error('Failed to fetch from API');
  }

  return res.json();
}
