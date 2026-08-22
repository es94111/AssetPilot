import { todayInUserTz } from './userTime';

export type LineTransactionType = 'income' | 'expense';

type ParsedDate = { date: string; text: string };

export interface ParsedLineRecord {
  type: LineTransactionType;
  amount: number;
  currency: string;
  date: string;
  note: string;
}

export function normalizeLineText(text: string): string {
  return text.replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeCurrencyCode(value: string | undefined, fallbackCurrency: string): string {
  const code = String(value || fallbackCurrency || 'TWD').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(code) ? code : 'TWD';
}

function normalizeLineDate(value: string): string {
  const input = String(value || '').trim();
  let candidate = '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) {
    candidate = input;
  } else if (/^\d{8}$/.test(input)) {
    candidate = `${input.slice(0, 4)}-${input.slice(4, 6)}-${input.slice(6, 8)}`;
  } else if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(input)) {
    const [year, month, day] = input.split('/');
    candidate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  } else {
    return '';
  }

  const [year, month, day] = candidate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() + 1 === month
    && date.getUTCDate() === day
    ? candidate
    : '';
}

function previousDate(date: string): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

function parseLineDateToken(raw: string, timezone: string): ParsedDate {
  let text = normalizeLineText(raw);
  const today = todayInUserTz(timezone);
  if (/(今天|今日)/.test(text)) {
    return { date: today, text: text.replace(/今天|今日/g, '').trim() };
  }
  if (/(昨日|昨天)/.test(text)) {
    return { date: previousDate(today), text: text.replace(/昨日|昨天/g, '').trim() };
  }

  const match = text.match(/\b(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{8})\b/);
  if (!match) return { date: today, text };
  text = text.replace(match[1], '').trim();
  return { date: normalizeLineDate(match[1]), text };
}

export function parseLineDateInput(input: string, timezone: string): string | null {
  const text = normalizeLineText(input);
  if (!text) return null;
  const parsed = parseLineDateToken(text, timezone);
  return parsed.text === '' && parsed.date ? parsed.date : null;
}

function parseCurrency(text: string, fallbackCurrency: string): { currency: string; text: string } {
  const match = text.match(/\b(TWD|USD|JPY|CNY|EUR|HKD)\b/i);
  if (!match) return { currency: normalizeCurrencyCode(undefined, fallbackCurrency), text };
  return {
    currency: normalizeCurrencyCode(match[1], fallbackCurrency),
    text: text.replace(match[0], '').trim(),
  };
}

export function parseLineRecordCommand(input: string, timezone: string, fallbackCurrency = 'TWD'): ParsedLineRecord | null {
  const normalized = normalizeLineText(input);
  const dateParsed = parseLineDateToken(normalized, timezone);
  let text = dateParsed.text;
  let type: LineTransactionType | null = null;
  let amountText = '';

  const signed = text.match(/^([+-])\s*(\d+(?:\.\d+)?)/);
  if (signed) {
    type = signed[1] === '+' ? 'income' : 'expense';
    amountText = signed[2];
    text = text.slice(signed[0].length).trim();
  } else {
    const explicit = text.match(/^(支出|花費|收入|入帳|expense|income)\s*(\d+(?:\.\d+)?)/i);
    if (!explicit) return null;
    type = /收入|入帳|income/i.test(explicit[1]) ? 'income' : 'expense';
    amountText = explicit[2];
    text = text.slice(explicit[0].length).trim();
  }

  const amount = Number(amountText);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const parsedCurrency = parseCurrency(text, fallbackCurrency);
  return {
    type,
    amount,
    currency: parsedCurrency.currency,
    date: dateParsed.date,
    note: parsedCurrency.text || (type === 'expense' ? 'LINE 支出' : 'LINE 收入'),
  };
}

export function parseLineRecordDetail(
  input: string,
  type: LineTransactionType,
  timezone: string,
  fallbackCurrency = 'TWD',
): ParsedLineRecord | null {
  const normalized = normalizeLineText(input);
  const dateParsed = parseLineDateToken(normalized, timezone);
  let text = dateParsed.text;
  const amountMatch = text.match(/^(\d+(?:\.\d+)?)/);
  if (!amountMatch) return null;

  const amount = Number(amountMatch[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  text = text.slice(amountMatch[0].length).trim();

  const parsedCurrency = parseCurrency(text, fallbackCurrency);
  return {
    type,
    amount,
    currency: parsedCurrency.currency,
    date: dateParsed.date,
    note: parsedCurrency.text || (type === 'expense' ? 'LINE 支出' : 'LINE 收入'),
  };
}
