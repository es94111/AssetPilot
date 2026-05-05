import { requireAuth } from '@/lib/auth';
import { FilterControls } from './components/FilterControls';
import { TransactionsTable } from './components/TransactionsTable';
import { CategoryChart } from './components/CategoryChart';

// ... (existing getTransactions)

export default async function TransactionsPage(props: {
  searchParams: Promise<{ page?: string; limit?: string; account?: string; category?: string; date?: string }>;
}) {
  // ... (existing data fetching)
  const data = await getTransactions(session, searchParams);

  // 轉換資料給 CategoryChart
  const chartData = Object.entries(data.summaryByCategory || {}).map(([name, value]) => ({
    name,
    value: value as number,
  }));

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">交易紀錄</h1>
      <FilterControls />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
            <TransactionsTable data={data.transactions} />
        </div>
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">分類占比</h2>
            <CategoryChart data={chartData} />
        </div>
      </div>
    </div>
  );
}
