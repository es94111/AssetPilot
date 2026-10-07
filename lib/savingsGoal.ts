// lib/savingsGoal.ts — 目標儲蓄與還款計畫純計算（decimal.js；無 DB／無 Next.js 相依）。
//
// 金額一律以 decimal.js 計算並在輸出邊界四捨五入（half-up），避免浮點誤差累積；
// 本檔同時被伺服器路由與 Web 用戶端（攤還表預覽）import，兩端不可能分歧。
//
// 日期語意：本檔只處理 'YYYY-MM-DD' 當地自然日字串（由呼叫端以 users.timezone
// 轉出，見 lib/userTime.ts）；模組本身不依賴任何時區 API。

import Decimal from 'decimal.js';

// 期數上限（50 年）。避免使用者輸入過大值造成回應爆量或計算失控。
export const MAX_REPAYMENT_PERIODS = 600;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

function toDayMs(dateStr: string): number {
  const match = DATE_RE.exec(String(dateStr || ''));
  if (!match) return NaN;
  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(5, 7));
  const day = Number(dateStr.slice(8, 10));
  const ms = Date.UTC(year, month - 1, day);
  return Number.isFinite(ms) ? ms : NaN;
}

function fromDayMs(ms: number): string {
  const date = new Date(ms);
  return `${String(date.getUTCFullYear()).padStart(4, '0')}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

/** 驗證 'YYYY-MM-DD' 且為真實存在的日曆日（含閏年、月底天數）。 */
export function isValidGoalDate(value: unknown): boolean {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12 || day < 1) return false;
  const year = Number(value.slice(0, 4));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

/** to − from 的天數差（整數；to 較早時為負）。 */
export function daysBetween(from: string, to: string): number {
  const start = toDayMs(from);
  const end = toDayMs(to);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.round((end - start) / DAY_MS);
}

/** 日期加減月數；月底溢位時夾到該月最後一天（1/31 + 1 月 → 2/28）。 */
export function addMonthsClamped(dateStr: string, months: number): string {
  const ms = toDayMs(dateStr);
  if (!Number.isFinite(ms)) return dateStr;
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(year, month + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return fromDayMs(Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(day, lastDay)));
}

function money(value: Decimal): number {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

function percent(value: Decimal): number {
  return value.toDecimalPlaces(1, Decimal.ROUND_HALF_UP).toNumber();
}

// ───────────────────────── 請求驗證（與路由共用，測試直接呼叫） ─────────────────────────

/** 目標金額上限：10 億（避免誤輸入天文數字造成後續計算與顯示負擔）。 */
export const MAX_TARGET_AMOUNT = 1_000_000_000;

export interface SavingsGoalRequest {
  name: string;
  targetAmount: number;
  targetDate: string;
  accountId: string | null;
  categoryId: string | null;
}

export type ValidationFailure = { error: string; field: string };

export function parseSavingsGoalRequest(body: unknown): ValidationFailure | SavingsGoalRequest {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const name = String(input.name ?? '').trim();
  if (!name) return { error: '目標名稱為必填', field: 'name' };
  if (name.length > 60) return { error: '目標名稱不得超過 60 字', field: 'name' };

  const targetAmount = Number(input.targetAmount);
  if (!Number.isInteger(targetAmount) || targetAmount < 1 || targetAmount > MAX_TARGET_AMOUNT) {
    return { error: `目標金額必須為 1–${MAX_TARGET_AMOUNT} 的正整數`, field: 'targetAmount' };
  }
  if (!isValidGoalDate(input.targetDate)) {
    return { error: '目標日期格式無效（需為 YYYY-MM-DD）', field: 'targetDate' };
  }

  const accountId = input.accountId ? String(input.accountId) : null;
  const categoryId = input.categoryId ? String(input.categoryId) : null;
  if (accountId && categoryId) return { error: '綁定帳戶與分類僅能擇一', field: 'categoryId' };
  return { name, targetAmount, targetDate: String(input.targetDate), accountId, categoryId };
}

export interface RepaymentPlanRequest {
  name: string;
  principal: number;
  annualRatePercent: number;
  periods: number;
  startDate: string;
  accountId: string | null;
}

export function parseRepaymentPlanRequest(body: unknown): ValidationFailure | RepaymentPlanRequest {
  const input = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>;
  const name = String(input.name ?? '').trim();
  if (!name) return { error: '計畫名稱為必填', field: 'name' };
  if (name.length > 60) return { error: '計畫名稱不得超過 60 字', field: 'name' };

  const principal = Number(input.principal);
  if (!Number.isInteger(principal) || principal < 1 || principal > MAX_TARGET_AMOUNT) {
    return { error: `本金必須為 1–${MAX_TARGET_AMOUNT} 的正整數`, field: 'principal' };
  }

  // 年利率以百分比表示，允許到小數 4 位（例：2.3456%）。
  const annualRatePercent = Number(input.annualRatePercent ?? 0);
  if (!Number.isFinite(annualRatePercent) || annualRatePercent < 0 || annualRatePercent > 100) {
    return { error: '年利率必須介於 0–100 之間', field: 'annualRatePercent' };
  }

  const periods = Number(input.periods);
  if (!Number.isInteger(periods) || periods < 1 || periods > MAX_REPAYMENT_PERIODS) {
    return { error: `期數必須為 1–${MAX_REPAYMENT_PERIODS} 的整數`, field: 'periods' };
  }

  if (!isValidGoalDate(input.startDate)) {
    return { error: '首次應繳日格式無效（需為 YYYY-MM-DD）', field: 'startDate' };
  }

  return {
    name,
    principal,
    annualRatePercent: new Decimal(annualRatePercent).toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber(),
    periods,
    startDate: String(input.startDate),
    accountId: input.accountId ? String(input.accountId) : null,
  };
}

// ───────────────────────── 儲蓄目標進度 ─────────────────────────

export interface SavingsGoalProgressInput {
  /** 目標金額（使用者基準幣別，恆 ≥ 0） */
  targetAmount: number;
  /** 目標日期 'YYYY-MM-DD' */
  targetDate: string;
  /** 起算日 'YYYY-MM-DD'（目標建立當日）；早於此日的累積不列入進度 */
  startDate: string;
  /** 目前已存金額（由呼叫端依綁定來源計算） */
  contributedAmount: number;
  /** 使用者當地今日 'YYYY-MM-DD' */
  today: string;
}

export interface SavingsGoalProgress {
  targetDate: string;
  targetAmount: number;
  contributedAmount: number;
  /** 尚缺金額（已達成時為 0） */
  remainingAmount: number;
  /** 已存／目標 百分比（0–100，1 位小數） */
  progressPercent: number;
  /** 依時間比例「此刻應達」金額 */
  expectedAmount: number;
  /** 落後缺口（未落後時為 0） */
  shortfallAmount: number;
  /** 目前進度低於時間比例要求 */
  behind: boolean;
  achieved: boolean;
  /** 已逾目標日期但尚未達成 */
  overdue: boolean;
  /** 距目標日期剩餘天數（已逾期時為 0） */
  daysRemaining: number;
  /** 剩餘所需日均金額（剩餘期間為 0 天時為 0） */
  requiredDailyAmount: number;
  /** 依目前平均速度的預估達成日；無法預估（速度為 0）時為 null */
  projectedCompletionDate: string | null;
}

export function computeGoalProgress(input: SavingsGoalProgressInput): SavingsGoalProgress {
  const target = new Decimal(input.targetAmount || 0);
  const contributed = new Decimal(input.contributedAmount || 0);
  const totalDays = Math.max(1, daysBetween(input.startDate, input.targetDate));
  const elapsedDays = Math.min(Math.max(daysBetween(input.startDate, input.today), 0), totalDays);
  const daysRemaining = Math.max(0, daysBetween(input.today, input.targetDate));

  const expected = target.times(elapsedDays).div(totalDays);
  const remaining = Decimal.max(0, target.minus(contributed));
  const achieved = target.gt(0) && contributed.gte(target);
  const behind = !achieved && contributed.lt(expected);
  const shortfall = behind ? expected.minus(contributed) : new Decimal(0);
  const progressPercent = target.gt(0)
    ? Decimal.min(100, contributed.div(target).times(100))
    : (achieved ? new Decimal(100) : new Decimal(0));

  const requiredDaily = daysRemaining > 0 ? remaining.div(daysRemaining) : new Decimal(0);

  // 預估達成日：以「已存 ÷ 已過天數」為目前日均速度外推。
  let projectedCompletionDate: string | null = null;
  if (achieved) {
    projectedCompletionDate = input.today;
  } else if (elapsedDays > 0 && contributed.gt(0)) {
    const pace = contributed.div(elapsedDays);
    if (pace.gt(0)) {
      const daysToFinish = remaining.div(pace).ceil().toNumber();
      projectedCompletionDate = fromDayMs(toDayMs(input.today) + daysToFinish * DAY_MS);
    }
  }

  return {
    targetDate: input.targetDate,
    targetAmount: money(target),
    contributedAmount: money(contributed),
    remainingAmount: money(remaining),
    progressPercent: percent(progressPercent),
    expectedAmount: money(expected),
    shortfallAmount: money(shortfall),
    behind,
    achieved,
    overdue: !achieved && daysBetween(input.today, input.targetDate) < 0,
    daysRemaining,
    requiredDailyAmount: money(requiredDaily),
    projectedCompletionDate,
  };
}

// ───────────────────────── 還款計畫攤還表 ─────────────────────────

export interface AmortizationInput {
  /** 本金（基準幣別，恆 > 0） */
  principal: number;
  /** 年利率（百分比，0 = 零利率） */
  annualRatePercent: number;
  /** 期數（月） */
  periods: number;
}

export interface AmortizationPayment {
  period: number;
  payment: number;
  principal: number;
  interest: number;
  remainingBalance: number;
}

export interface AmortizationSchedule {
  principal: number;
  periods: number;
  annualRatePercent: number;
  /** 每月應繳（本息平均攤還；最後一期清償餘額可能略有差異） */
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  payments: AmortizationPayment[];
}

/**
 * 本息平均攤還（annuity）攤還表。
 *
 * 每期先以餘額計息（四捨五入至分），其餘為本金；最後一期本金等於當時餘額，
 * 因此「各期本金加總 = 原始本金」與「最後一期後餘額 = 0」恆成立，浮點誤差不殘留。
 */
export function buildAmortizationSchedule(input: AmortizationInput): AmortizationSchedule {
  const principal = new Decimal(input.principal || 0);
  const annualRatePercent = new Decimal(input.annualRatePercent || 0);
  // 以原始輸入驗證（不用 Math.trunc 後的值），否則 2.5 期會被靜默截斷成 2 期。
  const periods = Number(input.periods);

  if (!principal.isFinite() || principal.lte(0)) {
    throw new Error('buildAmortizationSchedule: principal 必須大於 0');
  }
  if (!annualRatePercent.isFinite() || annualRatePercent.lt(0)) {
    throw new Error('buildAmortizationSchedule: annualRatePercent 不得為負');
  }
  if (!Number.isInteger(periods) || periods < 1 || periods > MAX_REPAYMENT_PERIODS) {
    throw new Error(`buildAmortizationSchedule: periods 必須為 1–${MAX_REPAYMENT_PERIODS} 的整數`);
  }

  const monthlyRate = annualRatePercent.div(100).div(12);
  let monthlyPayment: Decimal;
  if (monthlyRate.isZero()) {
    monthlyPayment = principal.div(periods).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  } else {
    const growth = monthlyRate.plus(1).pow(periods);
    monthlyPayment = principal.times(monthlyRate).times(growth)
      .div(growth.minus(1))
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  }

  const payments: AmortizationPayment[] = [];
  let balance = principal;
  let totalPayment = new Decimal(0);
  let totalInterest = new Decimal(0);

  for (let period = 1; period <= periods; period += 1) {
    const interest = balance.times(monthlyRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    // 最後一期清償全部剩餘本金；其餘期數以月付金扣除利息為本金，並夾在餘額內防禦性收斂。
    const principalPart = period === periods
      ? balance
      : Decimal.min(monthlyPayment.minus(interest), balance);
    const payment = period === periods ? principalPart.plus(interest) : monthlyPayment;
    balance = balance.minus(principalPart);
    totalPayment = totalPayment.plus(payment);
    totalInterest = totalInterest.plus(interest);
    payments.push({
      period,
      payment: money(payment),
      principal: money(principalPart),
      interest: money(interest),
      remainingBalance: money(balance),
    });
  }

  return {
    principal: money(principal),
    periods,
    annualRatePercent: annualRatePercent.toDecimalPlaces(4, Decimal.ROUND_HALF_UP).toNumber(),
    monthlyPayment: money(monthlyPayment),
    totalPayment: money(totalPayment),
    totalInterest: money(totalInterest),
    payments,
  };
}

export interface RepaymentProgressInput {
  /** 首次應繳日 'YYYY-MM-DD' */
  startDate: string;
  today: string;
  schedule: AmortizationSchedule;
}

export interface RepaymentProgress {
  /** 已到期期數（依首次應繳日推算，上限為總期數） */
  paidPeriods: number;
  remainingPeriods: number;
  /** 已到期期數對應的本金累計 */
  paidPrincipal: number;
  /** 目前剩餘本金 */
  remainingBalance: number;
  /** 已到期期數對應的利息累計 */
  paidInterest: number;
  remainingInterest: number;
  /** 下期應繳日（已到期滿時為 null） */
  nextDueDate: string | null;
  nextPaymentAmount: number;
  finalDueDate: string;
  completed: boolean;
  progressPercent: number;
}

/** 依「首次應繳日 + 每月一期」推算目前已到期的期數與剩餘本金。 */
export function computeRepaymentProgress(input: RepaymentProgressInput): RepaymentProgress {
  const { schedule } = input;
  const periods = schedule.periods;

  let paidPeriods = 0;
  for (let period = 1; period <= periods; period += 1) {
    const dueDate = addMonthsClamped(input.startDate, period - 1);
    if (dueDate <= input.today) paidPeriods = period;
    else break;
  }

  const completed = paidPeriods >= periods;
  const paidPrincipal = schedule.payments
    .slice(0, paidPeriods)
    .reduce((sum, row) => sum.plus(row.principal), new Decimal(0));
  const paidInterest = schedule.payments
    .slice(0, paidPeriods)
    .reduce((sum, row) => sum.plus(row.interest), new Decimal(0));
  const remainingBalance = new Decimal(schedule.principal).minus(paidPrincipal);
  const remainingInterest = new Decimal(schedule.totalInterest).minus(paidInterest);

  return {
    paidPeriods,
    remainingPeriods: periods - paidPeriods,
    paidPrincipal: money(paidPrincipal),
    remainingBalance: money(Decimal.max(0, remainingBalance)),
    paidInterest: money(paidInterest),
    remainingInterest: money(Decimal.max(0, remainingInterest)),
    nextDueDate: completed ? null : addMonthsClamped(input.startDate, paidPeriods),
    nextPaymentAmount: completed ? 0 : schedule.payments[paidPeriods].payment,
    finalDueDate: addMonthsClamped(input.startDate, periods - 1),
    completed,
    progressPercent: periods > 0 ? percent(new Decimal(paidPeriods).div(periods).times(100)) : 0,
  };
}

// ───────────────────────── 儀表板提醒 ─────────────────────────

export interface GoalReminderSource {
  id: string;
  name: string;
  progress: SavingsGoalProgress;
}

export interface GoalReminder {
  id: string;
  name: string;
  progressPercent: number;
  shortfallAmount: number;
  daysRemaining: number;
  targetDate: string;
  overdue: boolean;
}

/**
 * 挑出「進度落後」的目標作為儀表板提醒：逾期者優先，其餘依落後缺口由大到小。
 * 已達成或進度正常的目標不會列入。
 */
export function buildGoalReminders(goals: GoalReminderSource[], limit = 3): GoalReminder[] {
  return goals
    .filter(goal => goal.progress.behind)
    .sort((a, b) => {
      if (a.progress.overdue !== b.progress.overdue) return a.progress.overdue ? -1 : 1;
      if (b.progress.shortfallAmount !== a.progress.shortfallAmount) {
        return b.progress.shortfallAmount - a.progress.shortfallAmount;
      }
      return a.name.localeCompare(b.name);
    })
    .slice(0, Math.max(0, limit))
    .map(goal => ({
      id: goal.id,
      name: goal.name,
      progressPercent: goal.progress.progressPercent,
      shortfallAmount: goal.progress.shortfallAmount,
      daysRemaining: goal.progress.daysRemaining,
      targetDate: goal.progress.targetDate,
      overdue: goal.progress.overdue,
    }));
}
