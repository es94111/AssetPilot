import AppLayout from '@/components/layout/AppLayout';
import { getDashboardData } from '@/lib/dashboardHelpers';
import { requireServerAuth } from '@/lib/serverAuth';
import { DashboardFilters } from './components/DashboardFilters';

export default async function DashboardPage(props: {
  searchParams: Promise<{ month?: string }>;
}) {
  const searchParams = await props.searchParams;
  const user = await requireServerAuth();
  const data = await getDashboardData(searchParams.month);

  return (
    <AppLayout user={user}>
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
    </AppLayout>
  );
}
