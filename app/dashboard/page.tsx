import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CircleDollarSign,
  Plus,
  ReceiptText,
  TrendingUp,
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { getDashboardData } from '@/lib/dashboardHelpers';
import { getTranslator } from '@/lib/i18n/getDictionary';
import { localeTag } from '@/lib/i18n/localeTag';
import { resolveLocale } from '@/lib/i18n/resolveLocale';
import { requireServerAuth } from '@/lib/serverAuth';
import { DashboardFilters } from './components/DashboardFilters';

function fmtMoney(value: number | string, locale: string) {
  return `NT$ ${Math.round(Number(value) || 0).toLocaleString(localeTag(locale))}`;
}

function fmtMonth(value: string, locale: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value || '');
  if (!match) return value;
  return new Intl.DateTimeFormat(localeTag(locale), {
    year: 'numeric',
    month: 'long',
  }).format(new Date(Number(match[1]), Number(match[2]) - 1, 1));
}

function percentOf(total: number, value: number) {
  if (!total) return 0;
  return Math.max(4, Math.round((value / total) * 100));
}

function percentLabel(total: number, value: number) {
  if (!total) return '0.0%';
  return `${((value / total) * 100).toFixed(1)}%`;
}

function transactionHref(yearMonth: string, type: 'income' | 'expense') {
  const [year, month] = yearMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const params = new URLSearchParams({
    type,
    dateFrom: `${yearMonth}-01`,
    dateTo: `${yearMonth}-${String(lastDay).padStart(2, '0')}`,
  });
  return `/finance/transactions?${params.toString()}`;
}

function groupCategoryRows(rows: any[], uncategorizedLabel: string) {
  const groups = new Map<string, any>();
  rows.forEach((row, index) => {
    const parentName = row.parentName || row.name || uncategorizedLabel;
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
  const locale = await resolveLocale();
  const t = getTranslator(locale);
  const data = await getDashboardData(searchParams.month);
  const dashboardMonth = fmtMonth(data.yearMonth, locale);

  const expenseRows = Array.isArray(data.catBreakdown) ? data.catBreakdown : [];
  const expenseGroups = groupCategoryRows(expenseRows, t('dashboard.uncategorized'));
  const incomeRows = Array.isArray(data.incomeCatBreakdown) ? data.incomeCatBreakdown : [];
  const recentRows = Array.isArray(data.recent) ? data.recent : [];
  const totalExpense = Number(data.expense) || 0;
  const totalIncome = Number(data.income) || 0;
  const net = Number(data.net) || 0;
  const cashflowTotal = totalIncome + totalExpense;
  const incomeRatio = cashflowTotal > 0
    ? Math.round((totalIncome / cashflowTotal) * 100)
    : 0;
  const expenseRatio = cashflowTotal > 0 ? 100 - incomeRatio : 0;

  const quickMetrics = [
    {
      label: t('dashboard.overview.income'),
      value: fmtMoney(totalIncome, locale),
      href: transactionHref(data.yearMonth, 'income'),
    },
    {
      label: t('dashboard.overview.expense'),
      value: fmtMoney(totalExpense, locale),
      href: transactionHref(data.yearMonth, 'expense'),
    },
    {
      label: t('dashboard.kpi.todayExpense'),
      value: fmtMoney(data.todayExpense, locale),
      href: '/finance/transactions',
    },
  ];

  const assetCards = [
    {
      label: t('dashboard.kpi.bankAccounts'),
      value: fmtMoney(data.bankBalance, locale),
      href: '/finance/accounts',
      icon: Building2,
      tone: 'var(--primary)',
      surface: 'var(--primary-light-bg)',
    },
    {
      label: t('dashboard.kpi.stockMarketValue'),
      value: fmtMoney(data.stockMarketValue, locale),
      href: '/stocks/portfolio',
      icon: TrendingUp,
      tone: '#7c3aed',
      surface: 'rgba(124, 58, 237, 0.10)',
    },
  ];

  return (
    <AppLayout user={user}>
      <div className="mx-auto w-full max-w-[1600px] space-y-6 md:space-y-8">
        <header className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="page-header">
            <h1>{t('dashboard.title')}</h1>
            <p>{t('dashboard.subtitle', { month: dashboardMonth })}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <DashboardFilters />
            <Link
              href="/finance/transactions?action=add"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-primary-dark"
            >
              <Plus size={17} aria-hidden="true" />
              {t('features.transactions.add')}
            </Link>
          </div>
        </header>

        <section className="dashboard-hero relative overflow-hidden rounded-[28px] p-5 text-white shadow-lg sm:p-7 lg:p-8">
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-sky-300/15 blur-3xl" />
          <div className="relative grid gap-7 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <span className="text-sm font-medium text-white/90">{t('dashboard.overview.title')}</span>
                <span className="rounded-full bg-white/12 px-3 py-1 text-xs font-semibold text-white">
                  {net >= 0 ? t('dashboard.overview.balance') : t('dashboard.overview.deficit')}
                </span>
              </div>
              <p className="text-sm font-medium text-white/90">{t('dashboard.kpi.net')}</p>
              <h2 className="mt-1 text-4xl font-extrabold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">
                {fmtMoney(net, locale)}
              </h2>
              <p className="mt-3 text-sm text-white/90">{dashboardMonth}</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {quickMetrics.map(metric => (
                <Link
                  key={metric.label}
                  href={metric.href}
                  className="group rounded-2xl border border-white/10 bg-white/10 p-4 transition-colors hover:bg-white/16"
                >
                  <span className="flex items-center justify-between gap-2 text-xs font-medium text-white/90">
                    {metric.label}
                    <ArrowUpRight size={15} className="opacity-60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                  </span>
                  <strong className="mt-2 block text-lg font-bold text-white tabular-nums">{metric.value}</strong>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          {assetCards.map(({ label, value, href, icon: Icon, tone, surface }) => (
            <Link
              key={href}
              href={href}
              className="group flex min-h-32 items-center gap-4 rounded-2xl border p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
              style={{ background: 'var(--surface-glass)', borderColor: 'var(--glass-border)' }}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: surface, color: tone }}>
                <Icon size={23} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <strong className="mt-1 block truncate text-2xl font-bold tracking-tight tabular-nums" style={{ color: 'var(--text)' }}>{value}</strong>
              </span>
              <ArrowRight size={19} className="shrink-0 transition-transform group-hover:translate-x-1" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
            </Link>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <section className="section-card">
            <div className="section-card-header">
              <div>
                <h2 className="section-card-title">{t('dashboard.sections.expenseCategories')}</h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{fmtMoney(totalExpense, locale)}</p>
              </div>
              <Link href="/finance/reports" className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-primary/10">
                {t('nav.reports')} <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            {expenseGroups.length === 0 ? (
              <div className="empty-hint">
                <ReceiptText size={28} className="mx-auto mb-3 opacity-60" aria-hidden="true" />
                <p>{t('dashboard.empty.noExpense')}</p>
              </div>
            ) : (
              <div className="space-y-5">
                {expenseGroups.map((group: any) => (
                  <div key={group.parentId}>
                    <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: group.parentColor }} />
                        <span className="truncate font-semibold" style={{ color: 'var(--text)' }}>{group.parentName}</span>
                      </div>
                      <span className="flex shrink-0 items-baseline gap-2">
                        <span className="font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{fmtMoney(group.total, locale)}</span>
                        <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{percentLabel(totalExpense, group.total)}</span>
                      </span>
                    </div>
                    <div className="progress-track" style={{ height: '8px' }}>
                      <div className="progress-fill flex overflow-hidden" style={{ width: `${percentOf(totalExpense, group.total)}%`, background: group.parentColor }}>
                        {group.children.map((child: any, childIndex: number) => (
                          <span
                            key={`${group.parentId}-${child.name}-${childIndex}`}
                            title={`${child.name} ${fmtMoney(child.total, locale)}`}
                            style={{ width: `${group.total > 0 ? (child.total / group.total) * 100 : 0}%`, background: child.color }}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {group.children.map((child: any, childIndex: number) => (
                        <span key={`${group.parentId}-${child.name}-label-${childIndex}`} className="inline-flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ background: child.color }} />
                          {child.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="section-card">
            <div className="section-card-header">
              <div>
                <h2 className="section-card-title">{t('dashboard.ratio.title')}</h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{dashboardMonth}</p>
              </div>
              <CircleDollarSign size={22} style={{ color: 'var(--primary)' }} aria-hidden="true" />
            </div>
            <div className="space-y-6">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('dashboard.ratio.incomeShare')}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--income)' }}>{incomeRatio}%</span>
                </div>
                <div className="progress-track h-3">
                  <div className="progress-fill" style={{ width: `${incomeRatio}%`, background: 'var(--income)' }} />
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{t('dashboard.ratio.expenseShare')}</span>
                  <span className="text-sm font-bold tabular-nums" style={{ color: 'var(--expense)' }}>{expenseRatio}%</span>
                </div>
                <div className="progress-track h-3">
                  <div className="progress-fill" style={{ width: `${expenseRatio}%`, background: 'var(--expense)' }} />
                </div>
              </div>
              <div className="rounded-2xl p-4" style={{ background: net >= 0 ? 'var(--net-bg)' : 'var(--danger-bg)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{t('dashboard.overview.net')}</p>
                <p className="mt-1 text-xl font-bold tabular-nums" style={{ color: net >= 0 ? 'var(--net)' : 'var(--danger)' }}>{fmtMoney(net, locale)}</p>
              </div>
            </div>
          </section>
        </div>

        <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <section className="section-card">
            <div className="section-card-header">
              <h2 className="section-card-title">{t('dashboard.sections.incomeCategories')}</h2>
              <span className="section-card-sub">{fmtMoney(totalIncome, locale)}</span>
            </div>
            {incomeRows.length === 0 ? (
              <div className="empty-hint py-10">
                <p>{t('dashboard.empty.noIncome')}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {incomeRows.map((row: any, index: number) => (
                  <div key={`${row.parentId}-${row.categoryId ?? index}`}>
                    <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                      <span className="flex min-w-0 items-center gap-2 font-medium" style={{ color: 'var(--text)' }}>
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: row.color || row.parentColor || 'var(--text-muted)' }} />
                        <span className="truncate">{row.parentName && row.parentName !== row.name ? `${row.parentName} › ` : ''}{row.name}</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{fmtMoney(row.total, locale)}</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width: `${percentOf(totalIncome, Number(row.total) || 0)}%`, background: row.color || row.parentColor || 'var(--text-muted)' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="section-card">
            <div className="section-card-header">
              <div>
                <h2 className="section-card-title">{t('dashboard.sections.recentTransactions')}</h2>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{t('dashboard.sections.recentCount', { count: recentRows.length })}</p>
              </div>
              <Link href="/finance/transactions" className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-primary/10">
                {t('nav.transactions')} <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
            {recentRows.length === 0 ? (
              <div className="empty-hint py-10">
                <p>{t('dashboard.empty.noTransactions')}</p>
              </div>
            ) : (
              <>
                <ul className="space-y-2 md:hidden">
                  {recentRows.map((row: any) => (
                    <li key={row.id} className="flex items-center gap-3 rounded-xl border p-3" style={{ borderColor: 'var(--border)' }}>
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: row.type === 'income' ? 'var(--income-bg)' : 'var(--expense-bg)', color: row.type === 'income' ? 'var(--income)' : 'var(--expense)' }}>
                        <ReceiptText size={18} aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>{row.cat_name || t('dashboard.uncategorized')}</span>
                        <span className="block text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{row.date}</span>
                        {row.note && <span className="block truncate text-xs" style={{ color: 'var(--text-secondary)' }}>{row.note}</span>}
                      </span>
                      <span className="shrink-0 text-sm font-bold tabular-nums" style={{ color: row.type === 'income' ? 'var(--income)' : 'var(--expense)' }}>
                        {row.type === 'income' ? '+' : '−'}{fmtMoney(row.amount, locale)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="hidden overflow-x-auto md:block">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>{t('dashboard.table.date')}</th>
                        <th>{t('dashboard.table.category')}</th>
                        <th>{t('dashboard.table.note')}</th>
                        <th style={{ textAlign: 'end' }}>{t('dashboard.table.amount')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentRows.map((row: any) => (
                        <tr key={row.id}>
                          <td>{row.date}</td>
                          <td>{row.cat_name || t('dashboard.uncategorized')}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{row.note || '—'}</td>
                          <td style={{ textAlign: 'end', fontWeight: 700, color: row.type === 'income' ? 'var(--income)' : 'var(--expense)' }}>
                            {row.type === 'income' ? '+' : '−'}{fmtMoney(row.amount, locale)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  );
}
