import { addDaysToIsoDate, listRecurringDatesInWindow } from './recurringSchedule';
import { isValidIanaTimezone, partsInTz } from './userTime';
import { isCalendarIsoDate, type CalendarRange } from './calendarDates';

export type CalendarEventKind = 'transaction' | 'dividend' | 'recurring';

export interface CalendarEvent {
  id: string;
  date: string;
  kind: CalendarEventKind;
  type: string;
  note: string;
  amount?: number;
  currency?: string;
  categoryName?: string | null;
  accountName?: string | null;
  stockSymbol?: string | null;
  stockName?: string | null;
  cashDividend?: number;
  stockDividendShares?: number;
  frequency?: string;
}

export interface CalendarEventInput {
  range: CalendarRange;
  transactions: Array<Record<string, unknown>>;
  dividends: Array<Record<string, unknown>>;
  recurringSchedules: Array<Record<string, unknown>>;
}

export interface CalendarDailyTotal {
  income: number;
  expense: number;
}

export type CalendarDailyTotalRow = Record<string, unknown>;

function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : value == null ? '' : String(value);
}

export function getTodayInTimezone(timezone: string, nowMs = Date.now()): string {
  const safeTimezone = isValidIanaTimezone(timezone) ? timezone : 'Asia/Taipei';
  const parts = partsInTz(safeTimezone, nowMs);
  return `${String(parts.year).padStart(4, '0')}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function buildCalendarEvents(input: CalendarEventInput): CalendarEvent[] {
  const { from, to } = input.range;
  if (!isCalendarIsoDate(from) || !isCalendarIsoDate(to) || from > to) return [];

  const events: CalendarEvent[] = [];
  for (const row of input.transactions) {
    const date = text(row.date);
    if (!isCalendarIsoDate(date) || date < from || date > to) continue;
    events.push({
      id: `transaction:${text(row.id)}`,
      date,
      kind: 'transaction',
      type: text(row.type),
      note: text(row.note),
      amount: safeNumber(row.amount),
      currency: text(row.currency) || 'TWD',
      categoryName: row.category_name == null ? null : text(row.category_name),
      accountName: row.account_name == null ? null : text(row.account_name),
    });
  }

  for (const row of input.dividends) {
    const date = text(row.date);
    if (!isCalendarIsoDate(date) || date < from || date > to) continue;
    events.push({
      id: `dividend:${text(row.id)}`,
      date,
      kind: 'dividend',
      type: 'dividend',
      note: text(row.note),
      currency: text(row.currency) || 'TWD',
      stockSymbol: row.symbol == null ? null : text(row.symbol),
      stockName: row.stock_name == null ? null : text(row.stock_name),
      cashDividend: safeNumber(row.cash_dividend),
      stockDividendShares: safeNumber(row.stock_dividend_shares),
    });
  }

  const dayBeforeWindow = addDaysToIsoDate(from, -1);
  if (dayBeforeWindow) {
    for (const schedule of input.recurringSchedules) {
      if (safeNumber(schedule.is_active) !== 1) continue;
      const frequency = text(schedule.frequency);
      const dates = listRecurringDatesInWindow({
        startDate: text(schedule.start_date),
        lastGenerated: text(schedule.last_generated) || null,
        frequency,
        afterDate: dayBeforeWindow,
        throughDate: to,
        maxOccurrences: 100,
      });
      for (const date of dates) {
        const currency = text(schedule.currency) || 'TWD';
        const fxRate = safeNumber(schedule.fx_rate) || 1;
        const storedAmount = safeNumber(schedule.amount);
        events.push({
          id: `recurring:${text(schedule.id)}:${date}`,
          date,
          kind: 'recurring',
          type: text(schedule.type),
          note: text(schedule.note),
          amount: currency === 'TWD' ? storedAmount : storedAmount / fxRate,
          currency,
          categoryName: schedule.category_name == null ? null : text(schedule.category_name),
          accountName: schedule.account_name == null ? null : text(schedule.account_name),
          frequency,
        });
      }
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
}

/**
 * 依日期加總「實際交易」的收入／支出金額（台幣），語意與其他畫面（如 Dashboard）
 * 的統計口徑一致：僅計 type 為 income/expense（排除轉帳），且排除「不計入統計」
 * 的交易。股利與固定收支排程（預計金額）不併入，維持既有的筆數徽章。
 * 呼叫端應以已套用上述過濾條件的 SQL（GROUP BY date, type）彙總後傳入 rows。
 */
export function buildCalendarDailyTotals(range: CalendarRange, rows: CalendarDailyTotalRow[]): Record<string, CalendarDailyTotal> {
  const { from, to } = range;
  const totals: Record<string, CalendarDailyTotal> = {};
  if (!isCalendarIsoDate(from) || !isCalendarIsoDate(to) || from > to) return totals;

  for (const row of rows) {
    const date = text(row.date);
    if (!isCalendarIsoDate(date) || date < from || date > to) continue;
    const type = text(row.type);
    if (type !== 'income' && type !== 'expense') continue;
    const amount = safeNumber(row.total);
    if (!totals[date]) totals[date] = { income: 0, expense: 0 };
    totals[date][type] += amount;
  }
  return totals;
}
