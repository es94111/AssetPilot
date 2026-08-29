import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CalendarRange,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Gauge,
  Plus,
  ReceiptText,
  Repeat2,
  ShieldAlert,
  Tag,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { getDashboardData } from '@/lib/dashboardHelpers';
import {
  DEFAULT_DASHBOARD_LAYOUT,
  normalizeDashboardLayout,
  type DashboardModuleId,
} from '@/lib/dashboardPreferences';
import { getTranslator } from '@/lib/i18n/getDictionary';
import { localeTag } from '@/lib/i18n/localeTag';
import { resolveLocale } from '@/lib/i18n/resolveLocale';
import { requireServerAuth } from '@/lib/serverAuth';
import { DashboardFilters } from './components/DashboardFilters';
import { DashboardPersonalization } from './components/DashboardPersonalization';
import { SavingsScenario } from './components/SavingsScenario';

function fmtMoney(value: number | string, locale: string, currency = 'TWD') {
  const amount = (Number(value) || 0).toLocaleString(localeTag(locale), {
    minimumFractionDigits: 0,
    maximumFractionDigits: currency === 'TWD' ? 0 : 2,
  });
  return currency === 'TWD' ? `NT$ ${amount}` : `${currency} ${amount}`;
}

function fmtMonth(value: string, locale: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(value || '');
  if (!match) return value;
  return new Intl.DateTimeFormat(localeTag(locale), { year: 'numeric', month: 'long' })
    .format(new Date(Number(match[1]), Number(match[2]) - 1, 1));
}

function fmtDate(value: string, locale: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!match) return value;
  return new Intl.DateTimeFormat(localeTag(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))));
}

function percentOf(total: number, value: number) {
  if (!total) return 0;
  return Math.max(4, Math.round((value / total) * 100));
}

function percentLabel(total: number, value: number) {
  return total ? `${((value / total) * 100).toFixed(1)}%` : '0.0%';
}

function transactionHref(yearMonth: string, type: 'income' | 'expense') {
  const [year, month] = yearMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `/finance/transactions?${new URLSearchParams({
    type,
    dateFrom: `${yearMonth}-01`,
    dateTo: `${yearMonth}-${String(lastDay).padStart(2, '0')}`,
  })}`;
}

function comparisonTransactionHref(
  type: 'income' | 'expense',
  categoryId: string | null,
  dateFrom: string,
  dateTo: string
) {
  const params = new URLSearchParams({ type, dateFrom, dateTo });
  if (categoryId) params.set('categoryId', categoryId);
  else params.set('categoryId', '__uncategorized__');
  return `/finance/transactions?${params}`;
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
    });
  });
  return Array.from(groups.values()).sort((a, b) => b.total - a.total);
}

export default async function DashboardPage(props: { searchParams: Promise<{ month?: string }> }) {
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
  const dataStatus = data.dataStatus || { generatedAt: Date.now(), unpricedHoldingCount: 0 };
  const attentionStatus = data.attention || {
    recurringNeedsAttentionCount: 0,
    uncategorizedTransactionCount: 0,
    uncategorizedAmount: 0,
  };
  const layout = normalizeDashboardLayout(data.preferences?.layout || DEFAULT_DASHBOARD_LAYOUT);
  const comparison = data.comparison;
  const portfolio = data.portfolioHealth;
  const cashOutlook = data.cashOutlook;
  const cashOutlookActionHref = (cashOutlook?.startingBalance ?? 0) < 0 && cashOutlook?.firstShortfallDate === cashOutlook?.today
    ? '/finance/accounts'
    : '/finance/recurring';
  const generatedAtLabel = new Intl.DateTimeFormat(localeTag(locale), {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dataStatus.generatedAt));

  const attentionItems = [
    cashOutlook?.firstShortfallDate ? {
      key: 'cash-shortfall', icon: ShieldAlert,
      label: t('dashboard.cashOutlook.attentionShortfall', {
        date: fmtDate(cashOutlook.firstShortfallDate, locale),
        amount: fmtMoney(Math.abs(cashOutlook.firstShortfallBalance || 0), locale),
      }),
      href: cashOutlookActionHref,
    } : null,
    attentionStatus.recurringNeedsAttentionCount > 0 ? {
      key: 'recurring', icon: Repeat2,
      label: t('dashboard.attention.recurring', { count: attentionStatus.recurringNeedsAttentionCount }),
      href: '/finance/recurring',
    } : null,
    attentionStatus.uncategorizedTransactionCount > 0 ? {
      key: 'uncategorized', icon: Tag,
      label: t('dashboard.attention.uncategorized', {
        count: attentionStatus.uncategorizedTransactionCount,
        amount: fmtMoney(attentionStatus.uncategorizedAmount, locale),
      }),
      href: transactionHref(data.yearMonth, 'expense').replace('type=expense', 'categoryId=__uncategorized__'),
    } : null,
    dataStatus.unpricedHoldingCount > 0 ? {
      key: 'unpriced', icon: TrendingUp,
      label: t('dashboard.attention.unpriced', { count: dataStatus.unpricedHoldingCount }),
      href: '/stocks/portfolio',
    } : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null).slice(0, 3);
  const leadAttention = attentionItems[0];
  const signalCashValue = cashOutlook?.available
    ? fmtMoney(cashOutlook.projectedClosingBalance, locale)
    : '—';
  let signalPortfolioValue = '—';
  if (portfolio?.available) {
    const prefix = portfolio.unrealizedGrossPL >= 0 ? '+' : '−';
    signalPortfolioValue = `${prefix}${fmtMoney(Math.abs(portfolio.unrealizedGrossPL), locale, portfolio.currency || 'TWD')}`;
  }
  const LeadAttentionIcon = leadAttention?.icon || CircleAlert;

  const assetCards = [
    {
      label: t('dashboard.kpi.bankAccounts'), value: fmtMoney(data.bankBalance, locale),
      href: '/finance/accounts', icon: Building2, tone: 'var(--primary)', surface: 'var(--primary-light-bg)',
    },
    {
      label: t('dashboard.kpi.stockMarketValue'),
      value: portfolio?.unavailableReason === 'mixedCurrencies'
        ? '—'
        : fmtMoney(data.stockMarketValue, locale, portfolio?.currency || 'TWD'),
      href: '/stocks/portfolio', icon: TrendingUp, tone: 'var(--net)', surface: 'var(--net-bg)',
    },
  ];

  const modules: Record<DashboardModuleId, ReactNode> = {
    assets: (
      <section key="assets" className="dashboard-asset-grid grid gap-4 md:grid-cols-2 xl:col-span-2" aria-label={t('dashboard.personalize.modules.assets')}>
        {assetCards.map(({ label, value, href, icon: Icon, tone, surface }) => (
          <Link key={href} href={href} className="dashboard-asset-card group flex min-h-32 items-center gap-4 rounded-2xl border p-5 shadow-sm" style={{ background: 'var(--surface-glass)', borderColor: 'var(--glass-border)' }}>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: surface, color: tone }}><Icon size={23} aria-hidden="true" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
              <strong className="mt-1 block truncate text-2xl font-bold tracking-tight tabular-nums" style={{ color: 'var(--text)' }}>{value}</strong>
            </span>
            <ArrowRight size={19} className="shrink-0 transition-transform group-hover:translate-x-1" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
          </Link>
        ))}
      </section>
    ),
    attention: (
      <section key="attention" className="section-card" aria-labelledby="dashboard-attention-title">
        <div className="section-card-header">
          <div>
            <h2 id="dashboard-attention-title" className="section-card-title">{t('dashboard.attention.title')}</h2>
            <p className="mt-1 inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}><Clock3 size={14} aria-hidden="true" />{t('dashboard.dataStatus.queriedAt', { time: generatedAtLabel })}</p>
          </div>
          <CircleAlert size={22} style={{ color: attentionItems.length ? 'var(--expense)' : 'var(--income)' }} aria-hidden="true" />
        </div>
        {attentionItems.length === 0 ? (
          <div className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-dashed px-4 py-6 text-center" style={{ borderColor: 'var(--border)' }}>
            <CheckCircle2 size={30} className="mb-2" style={{ color: 'var(--income)' }} aria-hidden="true" />
            <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{t('dashboard.attention.allClear')}</p>
          </div>
        ) : (
          <ul className="space-y-2">{attentionItems.map(({ key, icon: Icon, label, href }) => (
            <li key={key}><Link href={href} className="group flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors hover:bg-primary/5" style={{ borderColor: 'var(--border)' }}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: 'var(--expense-bg)', color: 'var(--expense)' }}><Icon size={18} aria-hidden="true" /></span>
              <span className="min-w-0 flex-1 text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</span>
              <ArrowRight size={17} className="shrink-0 transition-transform group-hover:translate-x-1" style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
            </Link></li>
          ))}</ul>
        )}
      </section>
    ),
    whyChanged: (
      <section key="whyChanged" className="section-card" aria-labelledby="dashboard-change-title">
        <div className="section-card-header">
          <div>
            <h2 id="dashboard-change-title" className="section-card-title">{t('dashboard.comparison.title')}</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              {comparison?.window
                ? t(comparison.window.mode === 'monthToDate' ? 'dashboard.comparison.mtd' : 'dashboard.comparison.full', {
                  currentStart: fmtDate(comparison.window.currentStart, locale),
                  currentEnd: fmtDate(comparison.window.currentEnd, locale),
                  previousStart: fmtDate(comparison.window.previousStart, locale),
                  previousEnd: fmtDate(comparison.window.previousEnd, locale),
                })
                : t('dashboard.comparison.unavailable')}
            </p>
          </div>
          <Link href="/finance/reports" className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-primary/10">{t('nav.reports')} <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
        {!comparison?.available || !comparison.delta ? (
          <div className="empty-hint py-10"><p>{t('dashboard.comparison.unavailable')}</p></div>
        ) : comparison.drivers.length === 0 ? (
          <div className="empty-hint py-10"><p>{t('dashboard.comparison.noChanges')}</p></div>
        ) : (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3" style={{ background: 'var(--surface-hover)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('dashboard.comparison.previousNet')}</p>
                <strong className="mt-1 block tabular-nums" style={{ color: 'var(--text)' }}>{fmtMoney(comparison.previous?.net || 0, locale)}</strong>
              </div>
              <div className="rounded-xl p-3" style={{ background: comparison.delta.net >= 0 ? 'var(--net-bg)' : 'var(--danger-bg)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('dashboard.comparison.netChange')}</p>
                <strong className="mt-1 block tabular-nums" style={{ color: comparison.delta.net >= 0 ? 'var(--net)' : 'var(--danger)' }}>{comparison.delta.net >= 0 ? '+' : '−'}{fmtMoney(Math.abs(comparison.delta.net), locale)}</strong>
              </div>
            </div>
            <ol className="space-y-2">{comparison.drivers.map((driver, index) => {
              const improvesNet = driver.netContribution > 0;
              const Icon = improvesNet ? TrendingUp : TrendingDown;
              return (
                <li key={`${driver.type}-${driver.categoryId ?? driver.name}`}>
                  <Link href={comparison.window ? comparisonTransactionHref(
                    driver.type,
                    driver.categoryId,
                    driver.current === 0 && driver.previous > 0 ? comparison.window.previousStart : comparison.window.currentStart,
                    driver.current === 0 && driver.previous > 0 ? comparison.window.previousEnd : comparison.window.currentEnd
                  ) : '/finance/transactions'} className="group grid min-h-14 grid-cols-[2rem_minmax(0,1fr)] items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-primary/5 sm:grid-cols-[2rem_minmax(0,1fr)_auto]" style={{ borderColor: 'var(--border)' }}>
                    <span className="text-center text-sm font-bold" style={{ color: 'var(--text-muted)' }}>{index + 1}</span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: driver.color }} /><span className="truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>{driver.name}</span></span>
                      <span className="mt-0.5 flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}><Icon size={13} aria-hidden="true" />{driver.isNew ? t('dashboard.comparison.newThisPeriod') : driver.delta > 0 ? t('dashboard.comparison.increased') : t('dashboard.comparison.decreased')}</span>
                    </span>
                    <strong className="col-start-2 text-end text-sm tabular-nums sm:col-start-auto" style={{ color: improvesNet ? 'var(--net)' : 'var(--danger)' }}>{driver.delta >= 0 ? '+' : '−'}{fmtMoney(Math.abs(driver.delta), locale)}</strong>
                  </Link>
                </li>
              );
            })}</ol>
          </>
        )}
      </section>
    ),
    cashOutlook: (
      <section key="cashOutlook" className="section-card xl:col-span-2" aria-labelledby="dashboard-cash-outlook-title">
        <div className="section-card-header">
          <div>
            <h2 id="dashboard-cash-outlook-title" className="section-card-title">{t('dashboard.cashOutlook.title')}</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
              {cashOutlook?.windowStart && cashOutlook.windowEnd
                ? t('dashboard.cashOutlook.window', { start: fmtDate(cashOutlook.windowStart, locale), end: fmtDate(cashOutlook.windowEnd, locale) })
                : t('dashboard.cashOutlook.subtitle')}
            </p>
          </div>
          <CalendarRange size={22} style={{ color: 'var(--primary)' }} aria-hidden="true" />
        </div>

        {cashOutlook?.available ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="min-w-0 rounded-xl p-4" style={{ background: 'var(--surface-hover)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('dashboard.cashOutlook.startingBalance')}</p>
                <strong className="mt-1 block break-all text-lg tabular-nums" style={{ color: 'var(--text)' }}>{fmtMoney(cashOutlook.startingBalance, locale)}</strong>
              </div>
              <div className="min-w-0 rounded-xl p-4" style={{ background: 'var(--surface-hover)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('dashboard.cashOutlook.scheduledNet')}</p>
                <strong className="mt-1 block break-all text-lg tabular-nums" style={{ color: cashOutlook.scheduledIncome - cashOutlook.scheduledExpense >= 0 ? 'var(--net)' : 'var(--danger)' }}>
                  {cashOutlook.scheduledIncome - cashOutlook.scheduledExpense >= 0 ? '+' : '−'}{fmtMoney(Math.abs(cashOutlook.scheduledIncome - cashOutlook.scheduledExpense), locale)}
                </strong>
              </div>
              <div className="min-w-0 rounded-xl p-4" style={{ background: 'var(--surface-hover)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('dashboard.cashOutlook.closingBalance')}</p>
                <strong className="mt-1 block break-all text-lg tabular-nums" style={{ color: cashOutlook.projectedClosingBalance >= 0 ? 'var(--text)' : 'var(--danger)' }}>{fmtMoney(cashOutlook.projectedClosingBalance, locale)}</strong>
              </div>
              <div className="min-w-0 rounded-xl p-4" style={{ background: cashOutlook.firstShortfallDate ? 'var(--danger-bg)' : 'var(--net-bg)' }}>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('dashboard.cashOutlook.lowestBalance')}</p>
                <strong className="mt-1 block break-all text-lg tabular-nums" style={{ color: cashOutlook.lowestProjectedBalance >= 0 ? 'var(--net)' : 'var(--danger)' }}>{fmtMoney(cashOutlook.lowestProjectedBalance, locale)}</strong>
                {cashOutlook.lowestBalanceDate && <span className="mt-1 block text-xs" style={{ color: 'var(--text-secondary)' }}>{fmtDate(cashOutlook.lowestBalanceDate, locale)}</span>}
              </div>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--border)' }}>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('dashboard.cashOutlook.flowSummary', { income: fmtMoney(cashOutlook.scheduledIncome, locale), expense: fmtMoney(cashOutlook.scheduledExpense, locale), count: cashOutlook.occurrenceCount })}</span>
              <Link href="/finance/recurring" className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-primary/10">{t('nav.recurring')} <ArrowRight size={15} aria-hidden="true" /></Link>
            </div>

            {cashOutlook.firstShortfallDate && (
              <div className="flex flex-col gap-3 rounded-xl p-4 sm:flex-row sm:items-start" style={{ background: 'var(--danger-bg)' }} role="status">
                <ShieldAlert className="mt-0.5 shrink-0" size={20} style={{ color: 'var(--danger)' }} aria-hidden="true" />
                <div className="min-w-0 flex-1"><p className="font-semibold" style={{ color: 'var(--text)' }}>{t('dashboard.cashOutlook.shortfallTitle')}</p><p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>{t('dashboard.cashOutlook.shortfallBody', { date: fmtDate(cashOutlook.firstShortfallDate, locale), amount: fmtMoney(Math.abs(cashOutlook.firstShortfallBalance || 0), locale) })}</p></div>
                <Link href={cashOutlookActionHref} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1 rounded-lg px-3 text-sm font-semibold text-primary hover:bg-primary/10">{cashOutlookActionHref === '/finance/accounts' ? t('nav.accounts') : t('nav.recurring')} <ArrowRight size={15} aria-hidden="true" /></Link>
              </div>
            )}

            <div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{t('dashboard.cashOutlook.upcoming')}</h3>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('dashboard.cashOutlook.showing', { shown: Math.min(5, cashOutlook.upcomingEvents.length), total: cashOutlook.occurrenceCount })}</span>
              </div>
              {cashOutlook.upcomingEvents.length === 0 ? (
                <div className="empty-hint py-6"><p>{t('dashboard.cashOutlook.noUpcoming')}</p></div>
              ) : <ol className="grid gap-2 lg:grid-cols-2">
                {cashOutlook.upcomingEvents.slice(0, 5).map(event => (
                  <li key={`${event.scheduleId}-${event.date}`} className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 rounded-xl border p-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]" style={{ borderColor: 'var(--border)' }}>
                    <time dateTime={event.date} className="rounded-lg px-2 py-1 text-xs font-semibold tabular-nums" style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}>{fmtDate(event.date, locale)}</time>
                    <span className="min-w-0 truncate text-sm font-medium" style={{ color: 'var(--text)' }}>{event.note || (event.type === 'income' ? t('features.common.income') : t('features.common.expense'))}</span>
                    <strong className="col-start-2 text-end text-sm tabular-nums sm:col-start-auto" style={{ color: event.type === 'income' ? 'var(--income)' : 'var(--expense)' }}>{event.type === 'income' ? '+' : '−'}{fmtMoney(event.amount, locale)}</strong>
                  </li>
                ))}
              </ol>}
            </div>

            {cashOutlook.uncoveredScheduleCount > 0 && <Link href="/finance/recurring" className="flex min-h-11 items-center justify-between gap-3 rounded-xl p-3 text-sm hover:brightness-95" style={{ background: 'var(--primary-light-bg)', color: 'var(--text-secondary)' }}><span>{t('dashboard.cashOutlook.coverage', { included: cashOutlook.includedScheduleCount, total: cashOutlook.activeScheduleCount, uncovered: cashOutlook.uncoveredScheduleCount })}</span><ArrowRight size={16} className="shrink-0" aria-hidden="true" /></Link>}
            <p className="rounded-xl border border-dashed p-3 text-xs leading-relaxed" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>{t('dashboard.cashOutlook.disclaimer')}</p>
          </div>
        ) : (
          <div className="empty-hint py-8">
            <p>{t(`dashboard.cashOutlook.${cashOutlook?.unavailableReason || 'noSchedules'}`)}</p>
            <Link href={cashOutlook?.unavailableReason === 'noBankAccounts' ? '/finance/accounts' : '/finance/recurring'} className="mt-3 inline-flex min-h-11 items-center gap-1 rounded-lg px-3 font-semibold text-primary hover:bg-primary/10">
              {cashOutlook?.unavailableReason === 'noBankAccounts' ? t('nav.accounts') : t('nav.recurring')} <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
        )}
      </section>
    ),
    savingsScenario: <SavingsScenario key="savingsScenario" />,
    spending: (
      <section key="spending" className="section-card" aria-labelledby="dashboard-expense-title">
        <div className="section-card-header">
          <div><h2 id="dashboard-expense-title" className="section-card-title">{t('dashboard.sections.expenseCategories')}</h2><p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{fmtMoney(totalExpense, locale)}</p></div>
          <Link href="/finance/reports" className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-primary/10">{t('nav.reports')} <ArrowRight size={15} aria-hidden="true" /></Link>
        </div>
        {expenseGroups.length === 0 ? (
          <div className="empty-hint"><ReceiptText size={28} className="mx-auto mb-3 opacity-60" aria-hidden="true" /><p>{t('dashboard.empty.noExpense')}</p></div>
        ) : (
          <div className="space-y-5">{expenseGroups.map((group: any) => (
            <div key={group.parentId}>
              <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                <span className="flex min-w-0 items-center gap-2"><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: group.parentColor }} /><span className="truncate font-semibold" style={{ color: 'var(--text)' }}>{group.parentName}</span></span>
                <span className="flex shrink-0 items-baseline gap-2"><span className="font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{fmtMoney(group.total, locale)}</span><span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{percentLabel(totalExpense, group.total)}</span></span>
              </div>
              <div className="progress-track" style={{ height: 8 }} aria-hidden="true"><div className="progress-fill" style={{ width: `${percentOf(totalExpense, group.total)}%`, background: group.parentColor }} /></div>
            </div>
          ))}</div>
        )}
      </section>
    ),
    portfolioHealth: (
      <section key="portfolioHealth" className="section-card" aria-labelledby="dashboard-portfolio-health-title">
        <div className="section-card-header">
          <div><h2 id="dashboard-portfolio-health-title" className="section-card-title">{t('dashboard.portfolioHealth.title')}</h2><p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{t('dashboard.portfolioHealth.subtitle')}</p></div>
          <Gauge size={22} style={{ color: 'var(--primary)' }} aria-hidden="true" />
        </div>
        {portfolio?.available ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl p-3" style={{ background: 'var(--surface-hover)' }}><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('dashboard.portfolioHealth.marketValue')}</p><strong className="mt-1 block tabular-nums" style={{ color: 'var(--text)' }}>{fmtMoney(portfolio.marketValue, locale, portfolio.currency || 'TWD')}</strong></div>
              <div className="rounded-xl p-3" style={{ background: 'var(--surface-hover)' }}><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('dashboard.portfolioHealth.cost')}</p><strong className="mt-1 block tabular-nums" style={{ color: 'var(--text)' }}>{fmtMoney(portfolio.totalCost, locale, portfolio.currency || 'TWD')}</strong></div>
            </div>
            <div className="rounded-xl border p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('dashboard.portfolioHealth.unrealizedGross')}</p><strong className="mt-1 block text-xl tabular-nums" style={{ color: portfolio.unrealizedGrossPL >= 0 ? 'var(--pl-gain)' : 'var(--pl-loss)' }}>{portfolio.unrealizedGrossPL >= 0 ? '+' : '−'}{fmtMoney(Math.abs(portfolio.unrealizedGrossPL), locale, portfolio.currency || 'TWD')}</strong></div>
                <strong className="text-lg tabular-nums" style={{ color: portfolio.unrealizedGrossPL >= 0 ? 'var(--pl-gain)' : 'var(--pl-loss)' }}>{portfolio.costReturnRate == null ? '—' : `${portfolio.costReturnRate >= 0 ? '+' : ''}${portfolio.costReturnRate}%`}</strong>
              </div>
            </div>
            {portfolio.largestHolding && <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('dashboard.portfolioHealth.largestHolding', { name: portfolio.largestHolding.name, share: portfolio.largestHolding.share })}</p>}
            {portfolio.pricedHoldingCount < portfolio.holdingCount && <p className="rounded-xl p-3 text-sm" style={{ background: 'var(--danger-bg)', color: 'var(--text-secondary)' }}>{t('dashboard.portfolioHealth.coverage', { priced: portfolio.pricedHoldingCount, total: portfolio.holdingCount })}</p>}
            <p className="rounded-xl border border-dashed p-3 text-xs leading-relaxed" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>{t('dashboard.portfolioHealth.disclaimer')}</p>
          </div>
        ) : (
          <div className="empty-hint py-8">
            <p>{t(`dashboard.portfolioHealth.${portfolio?.unavailableReason || 'noHoldings'}`)}</p>
            <Link href="/stocks/portfolio" className="mt-3 inline-flex min-h-11 items-center gap-1 rounded-lg px-3 font-semibold text-primary hover:bg-primary/10">{t('nav.stocksPortfolio')} <ArrowRight size={15} aria-hidden="true" /></Link>
          </div>
        )}
      </section>
    ),
    incomeRecent: (
      <section key="incomeRecent" className="grid gap-6 xl:col-span-2 xl:grid-cols-[0.8fr_1.2fr]" aria-label={t('dashboard.personalize.modules.incomeRecent')}>
        <div className="section-card">
          <div className="section-card-header"><h2 className="section-card-title">{t('dashboard.sections.incomeCategories')}</h2><span className="section-card-sub">{fmtMoney(totalIncome, locale)}</span></div>
          {incomeRows.length === 0 ? <div className="empty-hint py-10"><p>{t('dashboard.empty.noIncome')}</p></div> : (
            <div className="space-y-4">{incomeRows.map((row: any, index: number) => (
              <div key={`${row.parentId}-${row.categoryId ?? index}`}>
                <div className="mb-2 flex items-center justify-between gap-4 text-sm"><span className="flex min-w-0 items-center gap-2 font-medium" style={{ color: 'var(--text)' }}><span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: row.color || row.parentColor || 'var(--text-muted)' }} /><span className="truncate">{row.parentName && row.parentName !== row.name ? `${row.parentName} › ` : ''}{row.name}</span></span><span className="shrink-0 font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{fmtMoney(row.total, locale)}</span></div>
                <div className="progress-track" aria-hidden="true"><div className="progress-fill" style={{ width: `${percentOf(totalIncome, Number(row.total) || 0)}%`, background: row.color || row.parentColor || 'var(--text-muted)' }} /></div>
              </div>
            ))}</div>
          )}
        </div>
        <div className="section-card">
          <div className="section-card-header"><div><h2 className="section-card-title">{t('dashboard.sections.recentTransactions')}</h2><p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>{t('dashboard.sections.recentCount', { count: recentRows.length })}</p></div><Link href="/finance/transactions" className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold text-primary hover:bg-primary/10">{t('nav.transactions')} <ArrowRight size={15} aria-hidden="true" /></Link></div>
          {recentRows.length === 0 ? <div className="empty-hint py-10"><p>{t('dashboard.empty.noTransactions')}</p></div> : (
            <ul className="space-y-2">{recentRows.map((row: any) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 rounded-xl border p-3 sm:flex-nowrap" style={{ borderColor: 'var(--border)' }}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl" style={{ background: row.type === 'income' ? 'var(--income-bg)' : 'var(--expense-bg)', color: row.type === 'income' ? 'var(--income)' : 'var(--expense)' }}><ReceiptText size={18} aria-hidden="true" /></span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold" style={{ color: 'var(--text)' }}>{row.cat_name || t('dashboard.uncategorized')}</span><span className="block text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>{row.date}</span>{row.note && <span className="block truncate text-xs" style={{ color: 'var(--text-secondary)' }}>{row.note}</span>}</span>
                <span className="w-full text-end text-sm font-bold tabular-nums sm:w-auto sm:shrink-0" style={{ color: row.type === 'income' ? 'var(--income)' : 'var(--expense)' }}>{row.type === 'income' ? '+' : '−'}{fmtMoney(row.amount, locale)}</span>
              </li>
            ))}</ul>
          )}
        </div>
      </section>
    ),
  };

  const visibleModules = layout.moduleOrder.filter(id => !layout.hiddenModules.includes(id));

  return (
    <AppLayout user={user}>
      <div className="dashboard-page mx-auto w-full max-w-[1600px] space-y-6 md:space-y-8">
        <header className="dashboard-page-header flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div className="page-header"><span className="dashboard-eyebrow">{t('dashboard.kpi.net')}</span><h1>{t('dashboard.title')}</h1><p>{t('dashboard.subtitle', { month: dashboardMonth })}</p></div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <DashboardFilters />
            <DashboardPersonalization initialLayout={layout} updatedAt={data.preferences?.updatedAt || 0} />
            <div className="dashboard-query-status inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-xs font-medium" title={t('dashboard.dataStatus.queriedAt', { time: generatedAtLabel })}>
              <span className="dashboard-status-dot" aria-hidden="true" />
              <span>{t('dashboard.dataStatus.queriedAt', { time: generatedAtLabel })}</span>
            </div>
            <Link href="/finance/transactions?action=add" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary-solid px-4 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-dark hover:shadow-md active:scale-[0.98]"><Plus size={17} aria-hidden="true" />{t('features.transactions.add')}</Link>
          </div>
        </header>

        <section className="dashboard-hero relative overflow-hidden rounded-[20px] p-5 text-white shadow-lg sm:p-7 lg:p-8" aria-labelledby="dashboard-overview-title">
          <div className="dashboard-hero-gridline pointer-events-none absolute inset-0" aria-hidden="true" />
          <div className="dashboard-hero-mark pointer-events-none absolute -right-10 -top-14 h-64 w-64 rounded-full" aria-hidden="true" />
          <div className="relative grid gap-7 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
            <div className="min-w-0"><p id="dashboard-overview-title" className="dashboard-hero-label text-sm font-medium text-white/90">{t('dashboard.kpi.net')}</p><h2 className="dashboard-hero-value mt-1 break-all text-3xl font-extrabold tracking-[-0.04em] text-white sm:text-5xl lg:text-6xl">{fmtMoney(net, locale)}</h2><p className="mt-3 text-sm text-white/90">{dashboardMonth}</p></div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                [t('dashboard.overview.income'), fmtMoney(totalIncome, locale), transactionHref(data.yearMonth, 'income')],
                [t('dashboard.overview.expense'), fmtMoney(totalExpense, locale), transactionHref(data.yearMonth, 'expense')],
                comparison?.available && comparison.delta
                  ? [t('dashboard.comparison.netChange'), `${comparison.delta.net >= 0 ? '+' : '−'}${fmtMoney(Math.abs(comparison.delta.net), locale)}`, '/finance/reports']
                  : [t('dashboard.kpi.bankAccounts'), fmtMoney(data.bankBalance, locale), '/finance/accounts'],
              ].map(([label, value, href]) => <Link key={label} href={href} className="group min-w-0 rounded-2xl border border-white/10 bg-white/10 p-4 transition-colors hover:bg-white/16"><span className="flex items-center justify-between gap-2 text-xs font-medium text-white/90">{label}<ArrowUpRight size={15} aria-hidden="true" /></span><strong className="mt-2 block break-all text-lg font-bold text-white tabular-nums">{value}</strong></Link>)}
            </div>
          </div>
        </section>

        <section className="dashboard-signal-rail" aria-labelledby="dashboard-signal-title">
          <div className="dashboard-signal-lead">
            <div className="dashboard-signal-heading">
              <span id="dashboard-signal-title" className="dashboard-signal-kicker">{t('dashboard.attention.title')}</span>
              <span className="dashboard-signal-meta">{t('dashboard.dataStatus.queriedAt', { time: generatedAtLabel })}</span>
            </div>
            {leadAttention ? (
              <Link href={leadAttention.href} className="dashboard-signal-alert group">
                <span className="dashboard-signal-icon dashboard-signal-icon--alert"><LeadAttentionIcon size={18} aria-hidden="true" /></span>
                <span className="dashboard-signal-alert-label">{leadAttention.label}</span>
                <ArrowUpRight size={17} className="dashboard-signal-arrow" aria-hidden="true" />
              </Link>
            ) : (
              <div className="dashboard-signal-clear" role="status">
                <span className="dashboard-signal-icon dashboard-signal-icon--clear"><CheckCircle2 size={18} aria-hidden="true" /></span>
                <span>{t('dashboard.attention.allClear')}</span>
              </div>
            )}
          </div>

          <Link href={cashOutlookActionHref} className="dashboard-signal-cell group" aria-label={`${t('dashboard.cashOutlook.closingBalance')}: ${signalCashValue}`}>
            <span className="dashboard-signal-cell-label"><CalendarRange size={16} aria-hidden="true" />{t('dashboard.cashOutlook.closingBalance')}</span>
            <strong className="dashboard-signal-cell-value">{signalCashValue}</strong>
            <ArrowUpRight size={16} className="dashboard-signal-arrow" aria-hidden="true" />
          </Link>

          <Link href="/stocks/portfolio" className="dashboard-signal-cell group" aria-label={`${t('dashboard.portfolioHealth.unrealizedGross')}: ${signalPortfolioValue}`}>
            <span className="dashboard-signal-cell-label"><Gauge size={16} aria-hidden="true" />{t('dashboard.portfolioHealth.unrealizedGross')}</span>
            <strong className="dashboard-signal-cell-value" data-tone={portfolio?.available && portfolio.unrealizedGrossPL < 0 ? 'loss' : 'gain'}>{signalPortfolioValue}</strong>
            <ArrowUpRight size={16} className="dashboard-signal-arrow" aria-hidden="true" />
          </Link>
        </section>

        <div className="dashboard-module-grid grid gap-6 xl:grid-cols-2">
          {visibleModules.map(id => modules[id])}
        </div>
      </div>
    </AppLayout>
  );
}
