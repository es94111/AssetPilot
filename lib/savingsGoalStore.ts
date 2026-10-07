// lib/savingsGoalStore.ts — 目標儲蓄與還款計畫的伺服器端讀寫（DB 相依；不得被 'use client' 元件 import）。
//
// 進度計算一律委派 lib/savingsGoal.ts 的純函式，本檔只負責把資料列轉成純函式的輸入：
// - 綁定帳戶的目標：以該帳戶目前餘額為「已存」（非 TWD 帳戶換算為 TWD 等值，與儀表板銀行餘額一致）。
// - 綁定分類的目標：以建立日起該分類（含子分類）的支出累計為「已存」，語意與預算「已用金額」一致。
// 兩個來源都以 TWD 為基準幣別，故目標金額無需額外幣別欄位。

import Decimal from 'decimal.js';
import { queryAll, queryOne } from './db';
import { getExchangeRateToTwdAsDecimal, normalizeCurrency } from './accountHelpers';
import {
  addMonthsClamped,
  buildAmortizationSchedule,
  buildGoalReminders,
  computeGoalProgress,
  computeRepaymentProgress,
  type AmortizationSchedule,
  type GoalReminder,
  type RepaymentProgress,
  type SavingsGoalProgress,
} from './savingsGoal';

export interface SavingsGoalRow {
  id: string;
  user_id: string;
  name: string;
  target_amount: number | string | null;
  target_date: string;
  start_date: string;
  account_id: string | null;
  category_id: string | null;
  created_at: number | string | null;
  updated_at: number | string | null;
}

export interface RepaymentPlanRow {
  id: string;
  user_id: string;
  name: string;
  principal: number | string | null;
  annual_rate: number | string | null;
  periods: number | string | null;
  start_date: string;
  account_id: string | null;
  created_at: number | string | null;
  updated_at: number | string | null;
}

function asRows<T>(rows: Array<Record<string, string | number | null>>): T[] {
  return rows as unknown as T[];
}

function asRow<T>(row: Record<string, string | number | null> | null): T | null {
  return row as unknown as T | null;
}

/** 綁定分類的目標：展開一層子分類，與 app/api/budgets 的「已用金額」語意一致。 */
function resolveCategoryIds(userId: string, categoryId: string): string[] {
  const category = asRow<{ parent_id: string | null }>(queryOne(
    'SELECT parent_id FROM categories WHERE id = ? AND user_id = ?',
    [categoryId, userId],
  ));
  if (!category) return [];
  const isParent = !category.parent_id || category.parent_id === '';
  if (!isParent) return [categoryId];
  const children = asRows<{ id: string }>(queryAll(
    'SELECT id FROM categories WHERE parent_id = ? AND user_id = ?',
    [categoryId, userId],
  ));
  return [categoryId, ...children.map(child => child.id)];
}

/** 目標「已存」金額（TWD）：依綁定來源（帳戶餘額／分類支出累計）計算。 */
export function getGoalContributedAmount(userId: string, goal: SavingsGoalRow, today: string): number {
  if (goal.account_id) {
    const account = asRow<{ initial_balance: number | string | null; currency: string | null }>(queryOne(
      'SELECT initial_balance, currency FROM accounts WHERE id = ? AND user_id = ?',
      [goal.account_id, userId],
    ));
    if (!account) return 0;
    const currency = normalizeCurrency(account.currency);
    const transactions = asRows<{
      type: string | null;
      amount: number | string | null;
      original_amount: number | string | null;
      currency: string | null;
    }>(queryAll(
      'SELECT type, amount, original_amount, currency FROM transactions WHERE account_id = ? AND user_id = ? AND date <= ?',
      [goal.account_id, userId, today],
    ));
    let balance = new Decimal(String(account.initial_balance ?? 0));
    const exchangeRate = new Decimal(getExchangeRateToTwdAsDecimal(userId, currency));
    for (const transaction of transactions) {
      const transactionCurrency = normalizeCurrency(transaction.currency);
      let value: Decimal;
      if (transactionCurrency === currency) {
        const originalAmount = new Decimal(String(transaction.original_amount ?? 0));
        value = originalAmount.gt(0)
          ? originalAmount
          : new Decimal(String(transaction.amount ?? 0));
      } else {
        const amountTwd = new Decimal(String(transaction.amount ?? 0));
        value = currency === 'TWD' || !exchangeRate.gt(0)
          ? amountTwd
          : amountTwd.div(exchangeRate).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      }
      if (transaction.type === 'income' || transaction.type === 'transfer_in') balance = balance.plus(value);
      else if (transaction.type === 'expense' || transaction.type === 'transfer_out') balance = balance.minus(value);
    }
    // Savings contribution cannot be negative (e.g. a bound credit-card account).
    return Decimal.max(0, balance)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
      .times(exchangeRate)
      .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
      .toNumber();
  }
  if (goal.category_id) {
    const categoryIds = resolveCategoryIds(userId, goal.category_id);
    if (categoryIds.length === 0) return 0;
    const row = queryOne(
      `SELECT COALESCE(SUM(twd_amount), 0) AS total FROM transactions
       WHERE user_id = ? AND type = 'expense' AND exclude_from_stats = 0
         AND date >= ? AND date <= ? AND category_id IN (${categoryIds.map(() => '?').join(',')})`,
      [userId, goal.start_date, today, ...categoryIds],
    ) as { total: string | number | null } | null;
    return Math.round(Number(row?.total) || 0);
  }
  return 0;
}

export interface SavingsGoalView extends SavingsGoalProgress {
  id: string;
  name: string;
  startDate: string;
  accountId: string | null;
  categoryId: string | null;
  createdAt: number;
  updatedAt: number;
}

export function listSavingsGoals(userId: string): SavingsGoalRow[] {
  return asRows<SavingsGoalRow>(queryAll(
    'SELECT id, user_id, name, target_amount, target_date, start_date, account_id, category_id, created_at, updated_at FROM savings_goals WHERE user_id = ? ORDER BY created_at ASC, id ASC',
    [userId],
  ));
}

export function buildSavingsGoalView(userId: string, goal: SavingsGoalRow, today: string): SavingsGoalView {
  const progress = computeGoalProgress({
    targetAmount: Number(goal.target_amount) || 0,
    targetDate: goal.target_date,
    startDate: goal.start_date,
    contributedAmount: getGoalContributedAmount(userId, goal, today),
    today,
  });
  return {
    ...progress,
    id: goal.id,
    name: goal.name,
    startDate: goal.start_date,
    accountId: goal.account_id || null,
    categoryId: goal.category_id || null,
    createdAt: Number(goal.created_at) || 0,
    updatedAt: Number(goal.updated_at) || 0,
  };
}

export function listSavingsGoalViews(userId: string, today: string): SavingsGoalView[] {
  return listSavingsGoals(userId).map(goal => buildSavingsGoalView(userId, goal, today));
}

/** 儀表板提醒卡片用：只回傳進度落後的目標（逾期者優先、缺口大者在前）。 */
export function listGoalReminders(userId: string, today: string, limit = 3): GoalReminder[] {
  const views = listSavingsGoalViews(userId, today);
  return buildGoalReminders(views.map(view => ({
    id: view.id,
    name: view.name,
    progress: view,
  })), limit);
}

export interface RepaymentPlanView extends RepaymentProgress {
  id: string;
  name: string;
  startDate: string;
  accountId: string | null;
  principal: number;
  annualRatePercent: number;
  periods: number;
  monthlyPayment: number;
  totalPayment: number;
  totalInterest: number;
  scheduleValid: boolean;
  scheduleError: string | null;
  createdAt: number;
  updatedAt: number;
}

/** 單一計畫另附完整攤還表；清單端點只回摘要，避免回應隨期數膨脹。 */
export interface RepaymentPlanDetail extends RepaymentPlanView {
  schedule: AmortizationSchedule;
}

export function buildRepaymentPlanView(plan: RepaymentPlanRow, today: string): RepaymentPlanView {
  const planPrincipal = new Decimal(String(plan.principal ?? 0));
  const principal = planPrincipal.isFinite() ? planPrincipal.toNumber() : 0;
  const annualRatePercent = Number(plan.annual_rate) || 0;
  const periods = Number(plan.periods) || 0;
  const base = {
    id: plan.id,
    name: plan.name,
    startDate: plan.start_date,
    accountId: plan.account_id || null,
    principal,
    annualRatePercent,
    periods,
    createdAt: Number(plan.created_at) || 0,
    updatedAt: Number(plan.updated_at) || 0,
  };

  try {
    const schedule = buildAmortizationSchedule({ principal, annualRatePercent, periods });
    const progress = computeRepaymentProgress({ startDate: plan.start_date, today, schedule });
    return {
      ...progress,
      ...base,
      principal: schedule.principal,
      annualRatePercent: schedule.annualRatePercent,
      periods: schedule.periods,
      monthlyPayment: schedule.monthlyPayment,
      totalPayment: schedule.totalPayment,
      totalInterest: schedule.totalInterest,
      scheduleValid: true,
      scheduleError: null,
    };
  } catch (error) {
    // A pre-validation stored row must not break the whole list response. Keep the plan
    // editable and visible, but do not fabricate payment/progress values for an invalid schedule.
    return {
      elapsedPeriods: 0,
      remainingPeriods: Math.max(0, periods),
      elapsedPrincipal: 0,
      remainingBalance: Math.max(0, principal),
      elapsedInterest: 0,
      remainingInterest: 0,
      nextDueDate: plan.start_date || null,
      nextPaymentAmount: 0,
      finalDueDate: periods > 0 ? addMonthsClamped(plan.start_date, periods - 1) : plan.start_date,
      scheduleComplete: false,
      progressPercent: 0,
      ...base,
      monthlyPayment: 0,
      totalPayment: 0,
      totalInterest: 0,
      scheduleValid: false,
      scheduleError: error instanceof Error ? error.message : 'Invalid amortization schedule',
    };
  }
}

export function buildRepaymentPlanDetail(plan: RepaymentPlanRow, today: string): RepaymentPlanDetail {
  const schedule = buildAmortizationSchedule({
    principal: Number(plan.principal) || 0,
    annualRatePercent: Number(plan.annual_rate) || 0,
    periods: Number(plan.periods) || 0,
  });
  return { ...buildRepaymentPlanView(plan, today), schedule };
}

export function listRepaymentPlans(userId: string): RepaymentPlanRow[] {
  return asRows<RepaymentPlanRow>(queryAll(
    'SELECT id, user_id, name, principal, annual_rate, periods, start_date, account_id, created_at, updated_at FROM repayment_plans WHERE user_id = ? ORDER BY created_at ASC, id ASC',
    [userId],
  ));
}

export function listRepaymentPlanViews(userId: string, today: string): RepaymentPlanView[] {
  return listRepaymentPlans(userId).map(plan => buildRepaymentPlanView(plan, today));
}

export function findRepaymentPlanRow(userId: string, id: string): RepaymentPlanRow | null {
  return asRow<RepaymentPlanRow>(queryOne(
    'SELECT id, user_id, name, principal, annual_rate, periods, start_date, account_id, created_at, updated_at FROM repayment_plans WHERE id = ? AND user_id = ?',
    [id, userId],
  ));
}

export function findSavingsGoalRow(userId: string, id: string): SavingsGoalRow | null {
  return asRow<SavingsGoalRow>(queryOne(
    'SELECT id, user_id, name, target_amount, target_date, start_date, account_id, category_id, created_at, updated_at FROM savings_goals WHERE id = ? AND user_id = ?',
    [id, userId],
  ));
}
