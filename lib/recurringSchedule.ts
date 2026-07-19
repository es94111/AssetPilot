export type RecurringFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

export function getNextRecurringDate(prevIsoDate: string, freq: string): string | null {
  const match = String(prevIsoDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) return null;

  if (freq === 'daily' || freq === 'weekly') {
    const date = new Date(Date.UTC(year, month - 1, day));
    date.setUTCDate(date.getUTCDate() + (freq === 'daily' ? 1 : 7));
    return date.toISOString().slice(0, 10);
  }
  if (freq === 'monthly') {
    const nextMonthDate = new Date(Date.UTC(year, month, 1));
    const nextYear = nextMonthDate.getUTCFullYear();
    const nextMonth = nextMonthDate.getUTCMonth() + 1;
    const lastDay = new Date(Date.UTC(nextYear, nextMonth, 0)).getUTCDate();
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(Math.min(day, lastDay)).padStart(2, '0')}`;
  }
  if (freq === 'yearly') {
    const nextYear = year + 1;
    const leapDay = month === 2 && day === 29;
    const isNextYearLeap = (nextYear % 4 === 0 && nextYear % 100 !== 0) || nextYear % 400 === 0;
    const nextDay = leapDay && !isNextYearLeap ? 28 : day;
    return `${nextYear}-${String(month).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
  }
  return null;
}

export function addDaysToIsoDate(isoDate: string, days: number): string | null {
  const match = String(isoDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match || !Number.isInteger(days)) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (
    date.getUTCFullYear() !== Number(match[1])
    || date.getUTCMonth() !== Number(match[2]) - 1
    || date.getUTCDate() !== Number(match[3])
  ) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function listRecurringDatesInWindow(input: {
  startDate: string;
  lastGenerated?: string | null;
  frequency: string;
  afterDate: string;
  throughDate: string;
  maxOccurrences?: number;
}): string[] {
  if (!addDaysToIsoDate(input.afterDate, 0) || !addDaysToIsoDate(input.throughDate, 0)) return [];
  const maxOccurrences = Math.max(1, Math.min(input.maxOccurrences ?? 400, 10_000));
  let nextDate = input.lastGenerated
    ? getNextRecurringDate(input.lastGenerated, input.frequency)
    : addDaysToIsoDate(input.startDate, 0);
  let advances = 0;

  while (nextDate && nextDate <= input.afterDate && advances < 10_000) {
    nextDate = getNextRecurringDate(nextDate, input.frequency);
    advances += 1;
  }
  if (advances >= 10_000) return [];

  const dates: string[] = [];
  while (nextDate && nextDate <= input.throughDate && dates.length < maxOccurrences) {
    dates.push(nextDate);
    nextDate = getNextRecurringDate(nextDate, input.frequency);
  }
  return dates;
}
