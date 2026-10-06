export type CalendarView = 'month' | 'week';

export interface CalendarRange {
  from: string;
  to: string;
}

interface IsoDateParts {
  year: number;
  month: number;
  day: number;
}

function parseIsoDate(value: unknown): IsoDateParts | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(2000, 0, 1));
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

function isoDate(date: Date): string | null {
  const year = date.getUTCFullYear();
  if (year < 0 || year > 9999) return null;
  return `${String(year).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

export function isCalendarIsoDate(value: unknown): value is string {
  return parseIsoDate(value) !== null;
}

export function addCalendarDays(value: string, days: number): string | null {
  const parts = parseIsoDate(value);
  if (!parts || !Number.isInteger(days)) return null;
  const date = new Date(Date.UTC(2000, 0, 1));
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

export function getCalendarRange(anchor: string, view: CalendarView): CalendarRange | null {
  const parts = parseIsoDate(anchor);
  if (!parts || (view !== 'month' && view !== 'week')) return null;

  if (view === 'week') {
    const selectedDay = new Date(Date.UTC(2000, 0, 1));
    selectedDay.setUTCFullYear(parts.year, parts.month - 1, parts.day);
    const start = new Date(selectedDay);
    start.setUTCDate(start.getUTCDate() - selectedDay.getUTCDay());
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    const from = isoDate(start);
    const to = isoDate(end);
    return from && to ? { from, to } : null;
  }

  const firstDay = new Date(Date.UTC(2000, 0, 1));
  firstDay.setUTCFullYear(parts.year, parts.month - 1, 1);
  const start = new Date(firstDay);
  start.setUTCDate(start.getUTCDate() - firstDay.getUTCDay());
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 41);
  const from = isoDate(start);
  const to = isoDate(end);
  return from && to ? { from, to } : null;
}

export function listCalendarDates(range: CalendarRange): string[] {
  const start = parseIsoDate(range.from);
  const end = parseIsoDate(range.to);
  if (!start || !end || range.from > range.to) return [];

  const dates: string[] = [];
  let current = range.from;
  while (current <= range.to && dates.length < 43) {
    dates.push(current);
    const next = addCalendarDays(current, 1);
    if (!next) break;
    current = next;
  }
  return dates;
}

export function shiftCalendarAnchor(anchor: string, view: CalendarView, direction: -1 | 1): string | null {
  const parts = parseIsoDate(anchor);
  if (!parts) return null;
  const date = new Date(Date.UTC(2000, 0, 1));
  date.setUTCFullYear(parts.year, parts.month - 1, view === 'month' ? 1 : parts.day);
  date.setUTCDate(date.getUTCDate() + (view === 'month' ? 0 : 7) * direction);
  if (view === 'month') date.setUTCMonth(date.getUTCMonth() + direction);
  return isoDate(date);
}
