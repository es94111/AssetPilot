'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react';
import { apiGet } from '@/lib/clientApi';
import { useT } from '@/components/i18n/I18nProvider';
import { localeTag } from '@/lib/i18n/localeTag';
import { getCalendarRange, listCalendarDates, shiftCalendarAnchor, type CalendarRange, type CalendarView } from '@/lib/calendarDates';
import type { CalendarEvent } from '@/lib/calendarEvents';

interface CalendarDailyTotal {
  income: number;
  expense: number;
}

interface CalendarPayload {
  anchor: string;
  view: CalendarView;
  range: CalendarRange;
  timezone: string;
  today: string;
  events: CalendarEvent[];
  dailyTotals: Record<string, CalendarDailyTotal>;
}

const KIND_ORDER: CalendarEvent['kind'][] = ['transaction', 'dividend', 'recurring'];

function formatIsoDate(value: string, locale: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat(localeTag(locale), { ...options, timeZone: 'UTC' }).format(new Date(`${value}T12:00:00.000Z`));
}

function transactionTypeLabel(type: string, t: (key: string) => string): string {
  if (type === 'income') return t('features.calendar.eventTypes.income');
  if (type === 'expense') return t('features.calendar.eventTypes.expense');
  return t('features.calendar.eventTypes.transfer');
}

function currencyAmount(amount: number, currency: string, locale: string): string {
  try {
    return new Intl.NumberFormat(localeTag(locale), {
      style: 'currency',
      currency: /^[A-Z]{3}$/.test(currency) ? currency : 'TWD',
      maximumFractionDigits: currency === 'TWD' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString(localeTag(locale))}`;
  }
}

export default function CalendarClient({ initialDate }: { initialDate: string }) {
  const { t, locale } = useT();
  const router = useRouter();
  const [anchor, setAnchor] = useState(initialDate);
  const [view, setView] = useState<CalendarView>('month');
  const [payload, setPayload] = useState<CalendarPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(initialDate);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setPayload(null);
    apiGet(`/api/calendar?date=${encodeURIComponent(anchor)}&view=${view}`)
      .then((data: CalendarPayload) => {
        if (!active) return;
        setPayload(data);
        setSelectedDate((current) => current >= data.range.from && current <= data.range.to ? current : anchor);
      })
      .catch(() => {
        if (active) setError(t('features.calendar.loadFailed'));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [anchor, view, t]);

  const dates = useMemo(() => payload ? listCalendarDates(payload.range) : listCalendarDates(getCalendarRange(anchor, view) || { from: anchor, to: anchor }), [anchor, payload, view]);
  const eventsByDate = useMemo(() => {
    const groups = new Map<string, CalendarEvent[]>();
    for (const event of payload?.events || []) {
      const items = groups.get(event.date) || [];
      items.push(event);
      groups.set(event.date, items);
    }
    return groups;
  }, [payload]);
  const selectedEvents = eventsByDate.get(selectedDate) || [];
  const today = payload?.today || initialDate;
  const title = view === 'month'
    ? formatIsoDate(anchor, locale, { year: 'numeric', month: 'long' })
    : `${formatIsoDate(dates[0] || anchor, locale, { month: 'short', day: 'numeric' })} – ${formatIsoDate(dates.at(-1) || anchor, locale, { year: 'numeric', month: 'short', day: 'numeric' })}`;
  const weekdays = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(2024, 0, 7 + index, 12));
    return new Intl.DateTimeFormat(localeTag(locale), { weekday: 'short', timeZone: 'UTC' }).format(date);
  });

  function move(direction: -1 | 1) {
    const next = shiftCalendarAnchor(anchor, view, direction);
    if (next) setAnchor(next);
  }

  function goToToday() {
    setAnchor(today);
    setSelectedDate(today);
  }

  function addTransaction() {
    router.push(`/finance/transactions?action=add&date=${encodeURIComponent(selectedDate)}`);
  }

  function summaryForDate(date: string): string[] {
    const dayEvents = eventsByDate.get(date) || [];
    const transactionCount = dayEvents.filter((event) => event.kind === 'transaction').length;
    const dividendCount = dayEvents.filter((event) => event.kind === 'dividend').length;
    const recurringCount = dayEvents.filter((event) => event.kind === 'recurring').length;
    return [
      transactionCount ? t('features.calendar.transactionCount', { count: transactionCount }) : '',
      dividendCount ? t('features.calendar.dividendCount', { count: dividendCount }) : '',
      recurringCount ? t('features.calendar.recurringCount', { count: recurringCount }) : '',
    ].filter(Boolean);
  }

  function totalForDate(date: string): CalendarDailyTotal {
    return payload?.dailyTotals?.[date] || { income: 0, expense: 0 };
  }

  function amountSummaryForDate(date: string): string[] {
    const { income, expense } = totalForDate(date);
    return [
      income > 0 ? t('features.calendar.incomeAmount', { amount: currencyAmount(income, 'TWD', locale) }) : '',
      expense > 0 ? t('features.calendar.expenseAmount', { amount: currencyAmount(expense, 'TWD', locale) }) : '',
    ].filter(Boolean);
  }

  function eventTitle(event: CalendarEvent): string {
    if (event.kind === 'transaction') return transactionTypeLabel(event.type, t);
    if (event.kind === 'dividend') return t('features.calendar.dividend');
    return event.type === 'income'
      ? t('features.calendar.recurringIncome')
      : t('features.calendar.recurringExpense');
  }

  function eventDescription(event: CalendarEvent): string {
    if (event.kind === 'dividend') {
      return [event.stockSymbol, event.stockName, event.note].filter(Boolean).join(' · ') || t('features.calendar.dividend');
    }
    const details = [event.categoryName, event.accountName, event.note].filter(Boolean);
    if (event.kind === 'recurring' && event.frequency) details.push(t(`features.recurring.frequencyLabels.${event.frequency}`));
    return details.join(' · ');
  }

  return (
    <section className="space-y-5" aria-labelledby="calendar-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-2" style={{ color: 'var(--primary)' }}>
            <CalendarDays size={20} aria-hidden="true" />
            <h2 id="calendar-heading" className="text-2xl font-bold" style={{ color: 'var(--text)' }}>{t('features.calendar.title')}</h2>
          </div>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{t('features.calendar.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border p-1" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }} role="group" aria-label={t('features.calendar.viewMode')}>
            {(['month', 'week'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={view === mode}
                onClick={() => setView(mode)}
                className="min-h-10 rounded-lg px-3 text-sm font-semibold transition-colors"
                style={{ background: view === mode ? 'var(--primary)' : 'transparent', color: view === mode ? '#fff' : 'var(--text-secondary)' }}
              >
                {t(`features.calendar.${mode}`)}
              </button>
            ))}
          </div>
          <button type="button" onClick={goToToday} className="min-h-11 rounded-xl border px-3 text-sm font-semibold" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
            {t('features.calendar.today')}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border" style={{ background: 'var(--surface-glass)', borderColor: 'var(--glass-border)', boxShadow: 'var(--shadow)' }}>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-3 py-3 sm:px-5" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => move(-1)} aria-label={t('features.calendar.previous')} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-primary" style={{ color: 'var(--text)' }}>
              <ChevronLeft size={19} aria-hidden="true" />
            </button>
            <h3 className="min-w-36 text-center text-lg font-bold" aria-live="polite" style={{ color: 'var(--text)' }}>{title}</h3>
            <button type="button" onClick={() => move(1)} aria-label={t('features.calendar.next')} className="flex min-h-11 min-w-11 items-center justify-center rounded-xl hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-primary" style={{ color: 'var(--text)' }}>
              <ChevronRight size={19} aria-hidden="true" />
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }} aria-live="polite">
            {loading && <RefreshCw size={14} className="animate-spin" aria-hidden="true" />}
            {payload?.timezone || ''}
          </div>
        </div>

        {error && <p role="alert" className="m-4 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">{error}</p>}

        <div className="grid grid-cols-7 border-b" style={{ borderColor: 'var(--border)' }}>
          {weekdays.map((day, index) => (
            <div key={`${day}-${index}`} className="py-2 text-center text-xs font-semibold sm:py-3 sm:text-sm" style={{ color: 'var(--text-secondary)' }}>{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {dates.map((date) => {
            const isCurrentMonth = view === 'week' || date.slice(0, 7) === anchor.slice(0, 7);
            const isSelected = date === selectedDate;
            const dateSummary = summaryForDate(date);
            const amountSummary = amountSummaryForDate(date);
            const dayTotal = totalForDate(date);
            const hasEvents = dateSummary.length > 0;
            const ariaSummary = [...dateSummary, ...amountSummary];
            return (
              <button
                key={date}
                type="button"
                aria-pressed={isSelected}
                aria-label={`${formatIsoDate(date, locale, { dateStyle: 'full' })}${ariaSummary.length ? `, ${ariaSummary.join(', ')}` : ''}`}
                onClick={() => setSelectedDate(date)}
                className="flex min-h-[5.7rem] min-w-0 flex-col items-start border-b border-e p-1.5 text-start transition-colors focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-primary sm:min-h-28 sm:p-2.5"
                style={{ borderColor: 'var(--border)', background: isSelected ? 'var(--primary-light-bg)' : 'transparent', color: isCurrentMonth ? 'var(--text)' : 'var(--text-muted)' }}
              >
                <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold sm:text-sm ${date === today ? 'bg-[var(--primary)] text-white' : ''}`}>
                  {Number(date.slice(8, 10))}
                </span>
                {hasEvents && (
                  <span className="mt-1 flex w-full flex-col gap-0.5 overflow-hidden text-[9px] leading-tight sm:text-[11px]">
                    {dateSummary.map((summary) => <span key={summary} className="truncate rounded px-1 py-0.5" style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}>{summary}</span>)}
                  </span>
                )}
                {(dayTotal.income > 0 || dayTotal.expense > 0) && (
                  <span className="mt-0.5 flex w-full flex-col gap-0.5 overflow-hidden text-[9px] font-semibold leading-tight tabular-nums sm:text-[11px]">
                    {dayTotal.income > 0 && <span className="truncate" style={{ color: 'var(--income)' }}>{'+'}{currencyAmount(dayTotal.income, 'TWD', locale)}</span>}
                    {dayTotal.expense > 0 && <span className="truncate" style={{ color: 'var(--expense)' }}>{'\u2212'}{currencyAmount(dayTotal.expense, 'TWD', locale)}</span>}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <section className="rounded-2xl border p-4 sm:p-5" aria-labelledby="calendar-day-heading" style={{ background: 'var(--surface-glass)', borderColor: 'var(--glass-border)', boxShadow: 'var(--shadow)' }}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 id="calendar-day-heading" className="text-lg font-bold" style={{ color: 'var(--text)' }}>{formatIsoDate(selectedDate, locale, { dateStyle: 'full' })}</h3>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
              {selectedEvents.length ? t('features.calendar.eventCount', { count: selectedEvents.length }) : t('features.calendar.noEvents')}
            </p>
          </div>
          <button type="button" onClick={addTransaction} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-white transition-colors hover:bg-primary-dark focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
            <Plus size={17} aria-hidden="true" />{t('features.calendar.addTransaction')}
          </button>
        </div>

        {selectedEvents.length > 0 ? (
          <div className="space-y-2">
            {KIND_ORDER.flatMap((kind) => selectedEvents.filter((event) => event.kind === kind)).map((event) => (
              <article key={event.id} className="flex flex-col gap-1 rounded-xl border px-3 py-3 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>{eventTitle(event)}</span>
                    <span className="rounded-full px-2 py-0.5 text-[11px] font-medium" style={{ background: 'var(--surface-hover)', color: 'var(--text-secondary)' }}>
                      {event.kind === 'transaction' ? t('features.calendar.transaction') : event.kind === 'dividend' ? t('features.calendar.dividend') : t('features.calendar.readOnlySchedule')}
                    </span>
                  </div>
                  {eventDescription(event) && <p className="mt-1 truncate text-sm" style={{ color: 'var(--text-secondary)' }}>{eventDescription(event)}</p>}
                </div>
                {(event.kind === 'transaction' || event.kind === 'recurring') && event.amount != null && (
                  <span className="shrink-0 text-sm font-semibold tabular-nums" style={{ color: event.type === 'expense' ? 'var(--danger)' : 'var(--text)' }}>
                    {currencyAmount(event.amount, event.currency || 'TWD', locale)}
                  </span>
                )}
                {event.kind === 'dividend' && (Number(event.cashDividend) > 0 || Number(event.stockDividendShares) > 0) && (
                  <span className="shrink-0 text-sm font-semibold tabular-nums" style={{ color: 'var(--text)' }}>
                    {Number(event.cashDividend) > 0 ? currencyAmount(Number(event.cashDividend), event.currency || 'TWD', locale) : ''}
                    {Number(event.stockDividendShares) > 0 ? ` ${Number(event.stockDividendShares).toLocaleString(localeTag(locale))} ${t('features.calendar.shares')}` : ''}
                  </span>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed p-5 text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>{t('features.calendar.noEvents')}</p>
        )}
      </section>
    </section>
  );
}
