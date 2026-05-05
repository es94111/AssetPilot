import { requireAuth } from '@/lib/auth';
import { DashboardFilters } from './components/DashboardFilters';
import logger from '@/lib/logger';

async function getDashboardData(session: string, month?: string) {
  const url = month 
    ? `http://assetpilot:3000/api/dashboard?month=${month}`
    : 'http://assetpilot:3000/api/dashboard';

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

export default async function DashboardPage(props: {
  searchParams: Promise<{ month?: string }>;
}) {
  const searchParams = await props.searchParams;
  const session = await requireAuth();
  const data = await getDashboardData(session, searchParams.month);

  return (
    <div className="container mx-auto p-6 md:p-10">
      <h1 className="text-4xl font-extrabold tracking-tight mb-8">儀表板</h1>
      <DashboardFilters />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
          <h2 className="text-sm font-medium text-slate-500 mb-1">總收入</h2>
          <p className="text-3xl font-semibold text-slate-900">{data.totalIncome}</p>
        </div>
        <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
          <h2 className="text-sm font-medium text-slate-500 mb-1">總支出</h2>
          <p className="text-3xl font-semibold text-slate-900">{data.totalExpense}</p>
        </div>
      </div>
    </div>
  );

}
