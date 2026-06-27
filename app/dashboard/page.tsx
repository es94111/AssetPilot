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

// 父分類佔總額百分比，保留小數點第一位：(分類金額 / 總額) * 100%
function percentLabel(total: number, value: number) {
  if (!total) return '0.0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

function groupCategoryRows(rows: any[]) {
  const groups = new Map<string, any>();
  rows.forEach((row, index) => {
    const parentName = row.parentName || row.name || '未分類';
    const parentId = row.parentId || `parent-${parentName}-${index}`;
    if (!groups.has(parentId)) {
      groups.set(parentId, {
        parentId,
        parentName,
        parentColor: row.parentColor || row.color || 'var(--text-muted)',
        total: 0,
        children: [],
      });
    }
    const group = groups.get(parentId);
    const amount = Number(row.total) || 0;
    group.total += amount;
    group.children.push({
      name: row.name || parentName,
      color: row.color || row.parentColor || 'var(--text-muted)',
      total: amount,
      isOtherGroup: row.isOtherGroup,
    });
  });
  return Array.from(groups.values()).sort((a, b) => b.total - a.total);
}

export default async function DashboardPage(props: {
  searchParams: Promise<{ month?: string }>;
}) {
  const searchParams = await props.searchParams;
  const user = await requireServerAuth();
  const data = await getDashboardData(searchParams.month);

  const expenseRows = Array.isArray(data.catBreakdown) ? data.catBreakdown : [];
  const expenseGroups = groupCategoryRows(expenseRows);
  const incomeRows = Array.isArray(data.incomeCatBreakdown) ? data.incomeCatBreakdown : [];
  const recentRows = Array.isArray(data.recent) ? data.recent : [];
  const totalExpense = Number(data.expense) || 0;
  const totalIncome = Number(data.income) || 0;
  const net = Number(data.net) || 0;
  const incomeRatio = totalIncome + totalExpense > 0 ? Math.round((totalIncome / (totalIncome + totalExpense)) * 100) : 0;
  const expenseRatio = 100 - incomeRatio;

  return (
    <AppLayout user={user}>
      <div className="space-y-8">

        {/* Page header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="page-header">
            <h1>儀表板</h1>
            <p>{data.yearMonth} 的收支摘要、分類分布與最近交易。</p>
          </div>
          <DashboardFilters />
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="stat-card" style={{ borderLeft: '3px solid var(--income)' }}>
            <p className="stat-card-label">總收入</p>
            <p className="stat-card-value" style={{ color: 'var(--income)' }}>{fmtMoney(data.income)}</p>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid var(--expense)' }}>
            <p className="stat-card-label">總支出</p>
            <p className="stat-card-value" style={{ color: 'var(--expense)' }}>{fmtMoney(data.expense)}</p>
          </div>
          <div className="stat-card" style={{ borderLeft: `3px solid ${net >= 0 ? 'var(--net)' : 'var(--danger)'}` }}>
            <p className="stat-card-label">淨額</p>
            <p className="stat-card-value" style={{ color: net >= 0 ? 'var(--net)' : 'var(--danger)' }}>{fmtMoney(data.net)}</p>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid var(--today)' }}>
            <p className="stat-card-label">今日支出</p>
            <p className="stat-card-value">{fmtMoney(data.todayExpense)}</p>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid var(--primary)' }}>
            <p className="stat-card-label">銀行帳戶</p>
            <p className="stat-card-value">{fmtMoney(data.bankBalance)}</p>
          </div>
          <div className="stat-card" style={{ borderLeft: '3px solid #8b5cf6' }}>
            <p className="stat-card-label">股票總市值</p>
            <p className="stat-card-value">{fmtMoney(data.stockMarketValue)}</p>
          </div>
        </div>

        {/* Overview + Ratio */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_0.6fr] gap-6">
          {/* Overview card */}
          <section
            className="rounded-2xl px-6 py-6"
            style={{ background: 'var(--surface-glass)', border: '1px solid var(--glass-border)', boxShadow: 'var(--shadow-md)', color: 'var(--text)' }}
          >
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>本月收支概覽</p>
                <h2 className="mt-1 text-xl font-bold tracking-tight" style={{ color: 'var(--text)' }}>{data.yearMonth}</h2>
              </div>
              <span
                className="rounded-full px-3 py-1 text-xs font-semibold"
                style={net >= 0
                  ? { background: 'rgba(16,185,129,.15)', color: '#34d399' }
                  : { background: 'rgba(244,63,94,.15)', color: '#fb7185' }
                }
              >
                {net >= 0 ? '本月結餘' : '本月赤字'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: '收入', value: fmtMoney(totalIncome), color: '#34d399' },
                { label: '支出', value: fmtMoney(totalExpense), color: '#fb7185' },
                { label: '淨額', value: fmtMoney(net), color: net >= 0 ? '#7dd3fc' : '#fb7185' },
              ].map(item => (
                <div key={item.label} className="rounded-xl p-4" style={{ background: 'rgba(79,110,247,.07)' }}>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.label}</p>
                  <p className="mt-2 text-base font-bold" style={{ color: item.color }}>{item.value}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Ratio card */}
          <section className="section-card">
            <div className="section-card-header">
              <h2 className="section-card-title">收支比例</h2>
            </div>
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>收入佔比</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--income)' }}>{incomeRatio}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${incomeRatio}%`, background: 'var(--income)' }} />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>支出佔比</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--expense)' }}>{expenseRatio}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${expenseRatio}%`, background: 'var(--expense)' }} />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Category breakdowns */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <section className="section-card">
            <div className="section-card-header">
              <h2 className="section-card-title">支出分類</h2>
              <span className="section-card-sub">{fmtMoney(totalExpense)}</span>
            </div>
            {expenseGroups.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>本月尚無支出資料</p>
            ) : (
              <div className="space-y-4">
                {expenseGroups.map((group: any) => (
                  <div key={group.parentId}>
                    <div className="flex items-center justify-between gap-4 mb-1 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: group.parentColor }} />
                        <span className="truncate font-medium" style={{ color: 'var(--text)' }}>{group.parentName}</span>
                      </div>
                      <span className="flex items-baseline gap-2 shrink-0">
                        <span className="font-semibold" style={{ color: 'var(--text)' }}>{fmtMoney(group.total)}</span>
                        <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>{percentLabel(totalExpense, group.total)}</span>
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2 pl-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {group.children.map((child: any, childIndex: number) => (
                        <span key={`${group.parentId}-${child.name}-${childIndex}`} className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: child.color }} />
                          {child.name}
                        </span>
                      ))}
                    </div>
                    <div className="progress-track" style={{ height: '8px' }}>
                      <div
                        className="progress-fill flex overflow-hidden"
                        title={`${group.parentName} ${fmtMoney(group.total)}`}
                        style={{ width: `${percentOf(totalExpense, group.total)}%`, background: group.parentColor }}
                      >
                        {group.children.map((child: any, childIndex: number) => {
                          const width = group.total > 0 ? (child.total / group.total) * 100 : 0;
                          return (
                            <div
                              key={`${group.parentId}-${child.name}-bar-${childIndex}`}
                              title={`${child.name} ${fmtMoney(child.total)}`}
                              style={{ width: `${width}%`, background: child.color, height: '100%' }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="section-card">
            <div className="section-card-header">
              <h2 className="section-card-title">收入分類</h2>
              <span className="section-card-sub">{fmtMoney(totalIncome)}</span>
            </div>
            {incomeRows.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>本月尚無收入資料</p>
            ) : (
              <div className="space-y-4">
                {incomeRows.map((row: any, index: number) => (
                  <div key={`${row.parentId}-${row.categoryId ?? index}`}>
                    <div className="flex items-center justify-between gap-4 mb-1.5 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: row.color || row.parentColor || 'var(--text-muted)' }} />
                        <span className="truncate" style={{ color: 'var(--text)' }}>
                          {row.parentName && row.parentName !== row.name ? `${row.parentName} › ` : ''}{row.name}
                        </span>
                      </div>
                      <span className="flex items-baseline gap-2 shrink-0">
                        <span className="font-semibold" style={{ color: 'var(--text)' }}>{fmtMoney(row.total)}</span>
                        <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>{percentLabel(totalIncome, Number(row.total) || 0)}</span>
                      </span>
                    </div>
                    <div className="progress-track" style={{ height: '5px' }}>
                      <div className="progress-fill" style={{ width: `${percentOf(totalIncome, Number(row.total) || 0)}%`, background: row.color || row.parentColor || 'var(--text-muted)' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Recent transactions */}
        <section className="section-card">
          <div className="section-card-header">
            <h2 className="section-card-title">最近交易</h2>
            <span className="section-card-sub">最近 {recentRows.length} 筆</span>
          </div>
          {recentRows.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>本月尚無交易資料</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>日期</th>
                    <th>分類</th>
                    <th>備註</th>
                    <th style={{ textAlign: 'right' }}>金額</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRows.map((row: any) => (
                    <tr key={row.id}>
                      <td>{row.date}</td>
                      <td>{row.cat_name || '未分類'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{row.note || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: row.type === 'income' ? 'var(--income)' : 'var(--expense)' }}>
                        {row.type === 'income' ? '+' : '−'}{fmtMoney(row.amount)}
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
