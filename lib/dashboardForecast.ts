import { addDaysToIsoDate, listRecurringDatesInWindow } from './recurringSchedule.ts';
import Decimal from 'decimal.js';

export function getScheduledAccountImpactTwd(input: {
  amountTwd: number;
  fxFeeTwd?: number;
  recurringCurrency: string;
  storedFxRate: number;
  accountCurrency: string;
  currentAccountRate: number;
}): number | null {
  const amountTwd = new Decimal(Number(input.amountTwd) || 0);
  const feeTwd = new Decimal(Math.max(0, Number(input.fxFeeTwd) || 0));
  const recurringCurrency = String(input.recurringCurrency || 'TWD').trim().toUpperCase();
  const accountCurrency = String(input.accountCurrency || 'TWD').trim().toUpperCase();
  const storedFxRate = new Decimal(Number(input.storedFxRate));
  const currentAccountRate = new Decimal(Number(input.currentAccountRate));
  if (amountTwd.isNegative() || !currentAccountRate.isFinite() || currentAccountRate.lessThanOrEqualTo(0)) return null;
  if (recurringCurrency !== 'TWD' && (!storedFxRate.isFinite() || storedFxRate.lessThanOrEqualTo(0))) return null;

  const mainInAccountCurrency = recurringCurrency === accountCurrency
    ? (recurringCurrency === 'TWD'
      ? amountTwd
      : amountTwd.dividedBy(storedFxRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP))
    : amountTwd.dividedBy(currentAccountRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const feeInAccountCurrency = accountCurrency === 'TWD'
    ? feeTwd
    : feeTwd.dividedBy(currentAccountRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return mainInAccountCurrency.plus(feeInAccountCurrency).times(currentAccountRate).toNumber();
}

export interface ScheduledCashInput {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  frequency: string;
  startDate: string;
  lastGenerated?: string | null;
  note: string;
  included: boolean;
}

export interface ScheduledCashEvent {
  scheduleId: string;
  type: 'income' | 'expense';
  amount: number;
  date: string;
  note: string;
}

export interface ScheduledCashOutlook {
  available: boolean;
  unavailableReason: 'invalidDate' | 'noBankAccounts' | 'noSchedules' | 'noCoveredSchedules' | null;
  today: string;
  windowStart: string | null;
  windowEnd: string | null;
  windowDays: number;
  startingBalance: number;
  scheduledIncome: number;
  scheduledExpense: number;
  projectedClosingBalance: number;
  lowestProjectedBalance: number;
  lowestBalanceDate: string | null;
  firstShortfallDate: string | null;
  firstShortfallBalance: number | null;
  activeScheduleCount: number;
  includedScheduleCount: number;
  uncoveredScheduleCount: number;
  occurrenceCount: number;
  upcomingEvents: ScheduledCashEvent[];
}

export function buildScheduledCashOutlook(input: {
  today: string;
  windowDays?: number;
  startingBalance: number;
  bankAccountCount: number;
  schedules: ScheduledCashInput[];
}): ScheduledCashOutlook {
  const windowDays = Math.max(1, Math.min(Math.trunc(input.windowDays ?? 30), 366));
  const windowStart = addDaysToIsoDate(input.today, 1);
  const windowEnd = addDaysToIsoDate(input.today, windowDays);
  const activeScheduleCount = input.schedules.length;
  const includedSchedules = input.schedules.filter(schedule => schedule.included);
  const base = {
    today: input.today,
    windowStart,
    windowEnd,
    windowDays,
    startingBalance: Number(input.startingBalance) || 0,
    activeScheduleCount,
    includedScheduleCount: includedSchedules.length,
    uncoveredScheduleCount: activeScheduleCount - includedSchedules.length,
  };

  if (!windowStart || !windowEnd) {
    return {
      ...base,
      available: false,
      unavailableReason: 'invalidDate',
      scheduledIncome: 0,
      scheduledExpense: 0,
      projectedClosingBalance: base.startingBalance,
      lowestProjectedBalance: base.startingBalance,
      lowestBalanceDate: null,
      firstShortfallDate: null,
      firstShortfallBalance: null,
      occurrenceCount: 0,
      upcomingEvents: [],
    };
  }

  const events = includedSchedules.flatMap(schedule =>
    listRecurringDatesInWindow({
      startDate: schedule.startDate,
      lastGenerated: schedule.lastGenerated,
      frequency: schedule.frequency,
      afterDate: input.today,
      throughDate: windowEnd,
      maxOccurrences: windowDays + 2,
    }).map(date => ({
      scheduleId: schedule.id,
      type: schedule.type,
      amount: Math.max(0, Number(schedule.amount) || 0),
      date,
      note: schedule.note,
    }))
  ).filter(event => event.amount > 0);
  events.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type) || a.note.localeCompare(b.note) || a.scheduleId.localeCompare(b.scheduleId));

  const scheduledIncome = events.filter(event => event.type === 'income').reduce((sum, event) => sum + event.amount, 0);
  const scheduledExpense = events.filter(event => event.type === 'expense').reduce((sum, event) => sum + event.amount, 0);
  const dailyNet = new Map<string, number>();
  for (const event of events) {
    const signed = event.type === 'income' ? event.amount : -event.amount;
    dailyNet.set(event.date, (dailyNet.get(event.date) || 0) + signed);
  }

  let balance = base.startingBalance;
  let lowestProjectedBalance = balance;
  let lowestBalanceDate: string | null = null;
  let firstShortfallDate: string | null = balance < 0 ? input.today : null;
  let firstShortfallBalance: number | null = balance < 0 ? balance : null;
  for (const [date, net] of Array.from(dailyNet.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    balance += net;
    if (balance < lowestProjectedBalance) {
      lowestProjectedBalance = balance;
      lowestBalanceDate = date;
    }
    if (!firstShortfallDate && balance < 0) {
      firstShortfallDate = date;
      firstShortfallBalance = balance;
    }
  }

  const unavailableReason = input.bankAccountCount <= 0
    ? 'noBankAccounts'
    : activeScheduleCount === 0
      ? 'noSchedules'
      : includedSchedules.length === 0
        ? 'noCoveredSchedules'
        : null;

  return {
    ...base,
    available: unavailableReason === null,
    unavailableReason,
    scheduledIncome,
    scheduledExpense,
    projectedClosingBalance: balance,
    lowestProjectedBalance,
    lowestBalanceDate,
    firstShortfallDate,
    firstShortfallBalance,
    occurrenceCount: events.length,
    upcomingEvents: events.slice(0, 100),
  };
}
