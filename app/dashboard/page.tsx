import AppLayout from '@/components/layout/AppLayout';
import { getDashboardData } from '@/lib/dashboardHelpers';
import { requireServerAuth } from '@/lib/serverAuth';
import { DashboardFilters } from './components/DashboardFilters';

function fmtMoney(value: number | string) {
  return `NT$ ${Math.round(Number(value) || 0).toLocaleString('zh-TW')}`;
}

function percentOf(total: number, value: number) {
  if (!total) return 0;
  return Math.max(4, Math.round((value / total) * 100));
}

export default async function DashboardPage(props: {
  searchParams: Promise<{ month?: string }>;
}) {
  const searchParams = await props.searchParams;
  const user = await requireServerAuth();
  const data = await getDashboardData(searchParams.month);

  const expenseRows = Array.isArray(data.catBreakdown) ? data.catBreakdown : [];
  const incomeRows = Array.isArray(data.incomeCatBreakdown) ? data.incomeCatBreakdown : [];
  const recentRows = Array.isArray(data.recent) ? data.recent : [];
  const totalExpense = Number(data.expense) || 0;
  const totalIncome = Number(data.income) || 0;
  const net = Number(data.net) || 0;

  return (
    <AppLayout user={user}>
      <div className="space-y-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">儀表板</h1>
            <p className="text-slate-500 mt-1">{data.yearMonth} 的收支摘要、分類分布與最近交易。</p>
          </div>
          <DashboardFilters />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="p-5 bg-gradient-to-br from-emerald-50 to-white border border-emerald-200 rounded-xl shadow-sm">
            <p className="text-sm text-slate-500">總收入</p>
            <p className="mt-2 text-2xl font-semibold text-emerald-600">{fmtMoney(data.income)}</p>
          </div>
          <div className="p-5 bg-gradient-to-br from-rose-50 to-white border border-rose-200 rounded-xl shadow-sm">
            <p className="text-sm text-slate-500">總支出</p>
            <p className="mt-2 text-2xl font-semibold text-rose-600">{fmtMoney(data.expense)}</p>
          </div>
          <div className={`p-5 rounded-xl shadow-sm border ${net >= 0 ? 'bg-gradient-to-br from-blue-50 to-white border-blue-200' : 'bg-gradient-to-br from-red-50 to-white border-red-200'}`}>
            <p className="text-sm text-slate-500">淨額</p>
            <p className={`mt-2 text-2xl font-semibold ${net >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{fmtMoney(data.net)}</p>
          </div>
          <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-sm">
            <p className="text-sm text-slate-500">今日支出</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{fmtMoney(data.todayExpense)}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] gap-6">
          <section className="rounded-2xl border border-slate-200 bg-slate-950 px-6 py-6 text-white shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-slate-300">本月收支概覽</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight">{data.yearMonth}</h2>
              </div>
              <div className={`rounded-full px-3 py-1 text-sm font-medium ${net >= 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-rose-500/15 text-rose-300'}`}>
                {net >= 0 ? '本月結餘' : '本月赤字'}
              </div>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl bg-white/5 p-4">
                <div className="text-slate-400">收入</div>
                <div className="mt-2 text-lg font-semibold text-emerald-300">{fmtMoney(totalIncome)}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-4">
                <div className="text-slate-400">支出</div>
                <div className="mt-2 text-lg font-semibold text-rose-300">{fmtMoney(totalExpense)}</div>
              </div>
              <div className="rounded-xl bg-white/5 p-4">
                <div className="text-slate-400">淨額</div>
                <div className={`mt-2 text-lg font-semibold ${net >= 0 ? 'text-sky-300' : 'text-rose-300'}`}>{fmtMoney(net)}</div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white px-6 py-6 shadow-sm">
            <p className="text-sm text-slate-500">收支比例</p>
            <div className="mt-5 space-y-4">
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-600">收入佔比</span>
                  <span className="font-medium text-emerald-600">{totalIncome + totalExpense > 0 ? Math.round((totalIncome / (totalIncome + totalExpense)) * 100) : 0}%</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${totalIncome + totalExpense > 0 ? Math.round((totalIncome / (totalIncome + totalExpense)) * 100) : 0}%` }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-slate-600">支出佔比</span>
                  <span className="font-medium text-rose-600">{totalIncome + totalExpense > 0 ? Math.round((totalExpense / (totalIncome + totalExpense)) * 100) : 0}%</span>
                </div>
                <div className="h-3 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-rose-500 rounded-full" style={{ width: `${totalIncome + totalExpense > 0 ? Math.round((totalExpense / (totalIncome + totalExpense)) * 100) : 0}%` }} />
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">支出分類</h2>
              <span className="text-sm text-slate-500">{fmtMoney(totalExpense)}</span>
            </div>
            {expenseRows.length === 0 ? (
              <p className="text-sm text-slate-500">本月尚無支出資料</p>
            ) : (
              <div className="space-y-3">
                {expenseRows.map((row: any, index: number) => (
                  <div key={`${row.parentId}-${row.categoryId ?? index}`} className="space-y-1">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: row.color || row.parentColor || '#94a3b8' }} />
                        <span className="truncate">{row.parentName && row.parentName !== row.name ? `${row.parentName} › ` : ''}{row.name}</span>
                      </div>
                      <span className="font-medium shrink-0">{fmtMoney(row.total)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${percentOf(totalExpense, Number(row.total) || 0)}%`, backgroundColor: row.color || row.parentColor || '#94a3b8' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">收入分類</h2>
              <span className="text-sm text-slate-500">{fmtMoney(totalIncome)}</span>
            </div>
            {incomeRows.length === 0 ? (
              <p className="text-sm text-slate-500">本月尚無收入資料</p>
            ) : (
              <div className="space-y-3">
                {incomeRows.map((row: any, index: number) => (
                  <div key={`${row.parentId}-${row.categoryId ?? index}`} className="space-y-1">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: row.color || row.parentColor || '#94a3b8' }} />
                        <span className="truncate">{row.parentName && row.parentName !== row.name ? `${row.parentName} › ` : ''}{row.name}</span>
                      </div>
                      <span className="font-medium shrink-0">{fmtMoney(row.total)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${percentOf(totalIncome, Number(row.total) || 0)}%`, backgroundColor: row.color || row.parentColor || '#94a3b8' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <section className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">最近交易</h2>
            <span className="text-sm text-slate-500">最近 {recentRows.length} 筆</span>
          </div>
          {recentRows.length === 0 ? (
            <p className="text-sm text-slate-500">本月尚無交易資料</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b text-slate-500">
                    <th className="text-left py-2 pr-4">日期</th>
                    <th className="text-left py-2 pr-4">分類</th>
                    <th className="text-left py-2 pr-4">備註</th>
                    <th className="text-right py-2">金額</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRows.map((row: any) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">{row.date}</td>
                      <td className="py-3 pr-4">{row.cat_name || '未分類'}</td>
                      <td className="py-3 pr-4 text-slate-600">{row.note || '—'}</td>
                      <td className={`py-3 text-right font-medium ${row.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {row.type === 'income' ? '+' : '-'}{fmtMoney(row.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
