// lib/webPushEvents.ts — 推播事件的偵測（issue #257）
//
// 三種事件：
//   bill_due         信用卡帳單到期：使用者已設定「每月結帳日」的信用卡，
//                    當期帳單於使用者當地時區的結帳日當天且尚有未繳消費時推播。
//   budget_exceeded  預算超標：當月該預算的已用金額（同 lib/api/budgets 的算法，
//                    含父分類底下所有子分類）超過預算金額。
//   dividend         股利發放：股利紀錄日期為使用者當地「今天」時推播。
//
// 每種事件都收斂成 lib/webPushCore.ts 的 PushEvent，event_key 由事件本身決定
// （帳單週期／預算年月／股利列 id），因此重複偵測不會重複推播。

import { queryAll, queryOne } from './db';
import { creditCardStatementCycle, categoryFromAccountType, normalizeStatementClosingDay } from './accountHelpers';
import { isValidIanaTimezone, partsInTz } from './userTime';
import { dispatchPushEvent, type PushDispatchResult } from './webPush';
import {
  defaultPushPreferences,
  yearMonthOf,
  type BillDueEvent,
  type BudgetExceededEvent,
  type DividendEvent,
  type PushEvent,
  type PushPreferences,
} from './webPushCore';
import { getUserPushPreferences } from './webPush';

/** 事件來源資料列（欄位皆為 DB 原樣的字串／數字）。 */
type Row = Record<string, string | number | null>;

function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function text(value: unknown): string {
  return value == null ? '' : String(value);
}

// ── 帳單到期 ──

export interface BillDueCandidate {
  accountId: string;
  accountName: string;
  cycleStart: string;
  cycleEnd: string;
  amount: number;
  currency: string;
}

/**
 * 找出「今天結帳且當期有消費」的信用卡。
 *
 * 純函式：只依傳入的帳戶列與當地今天計算，方便單元測試。
 * 當期未繳金額沿用 /api/accounts 的定義：本期區間內該卡的 expense 合計
 * （不額外套用 exclude_from_stats 篩選），尚未扣掉本期的繳款；有消費才提醒。
 */
export function findDueBills(accounts: Row[], today: string): BillDueCandidate[] {
  const out: BillDueCandidate[] = [];
  for (const account of accounts) {
    const category = text(account.category) || categoryFromAccountType(text(account.account_type));
    if (category !== 'credit_card') continue;
    if (num(account.is_active) === 0) continue;
    const closingDay = normalizeStatementClosingDay(account.statement_closing_day);
    if (closingDay == null) continue;
    const cycle = creditCardStatementCycle(closingDay, today);
    // 只有「今天正好是結帳日」才提醒；結帳日當天才看得到本期完整金額。
    if (!cycle || cycle.end !== today) continue;
    const amount = Math.round(num(account.cycle_spending) * 100) / 100;
    if (amount <= 0) continue;
    out.push({
      accountId: text(account.id),
      accountName: text(account.name),
      cycleStart: cycle.start,
      cycleEnd: cycle.end,
      amount,
      currency: text(account.currency) || 'TWD',
    });
  }
  return out;
}

/** 讀取帳單候選所需的帳戶列與其當期消費金額。 */
function loadBillDueCandidates(userId: string, today: string): BillDueCandidate[] {
  const accounts = queryAll(
    'SELECT id, name, currency, category, account_type, is_active, statement_closing_day FROM accounts WHERE user_id = ? AND is_active != 0',
    [userId],
  ) as unknown as Row[];

  const withSpending = accounts.map((account) => {
    const closingDay = normalizeStatementClosingDay(account.statement_closing_day);
    const cycle = closingDay == null ? null : creditCardStatementCycle(closingDay, today);
    if (!cycle || cycle.end !== today) return { ...account, cycle_spending: 0 };
    const row = queryOne(
      `SELECT COALESCE(SUM(CASE WHEN original_amount > 0 THEN original_amount ELSE amount END), 0) AS total
       FROM transactions
       WHERE user_id = ? AND account_id = ? AND type = 'expense' AND date >= ? AND date <= ?`,
      [userId, text(account.id), cycle.start, cycle.end],
    );
    return { ...account, cycle_spending: num(row?.total) };
  });

  return findDueBills(withSpending as unknown as Row[], today);
}

// ── 預算超標 ──

export interface BudgetCandidate {
  budgetId: string;
  categoryName: string;
  yearMonth: string;
  budgetAmount: number;
  usedAmount: number;
}

/**
 * 找出當月已超標的預算。
 * 分類名稱在 category_id 為 null 時顯示為「總預算」（i18n 由呼叫端組文案）。
 * 預算金額 <= 0 一律略過（不會有超標的語意）。
 */
export function findExceededBudgets(
  rows: Array<{ budget: Row; used: number; categoryName: string }>,
): BudgetCandidate[] {
  const out: BudgetCandidate[] = [];
  for (const { budget, used, categoryName } of rows) {
    const budgetAmount = num(budget.amount);
    if (budgetAmount <= 0) continue;
    if (used <= budgetAmount) continue;
    out.push({
      budgetId: text(budget.id),
      categoryName,
      yearMonth: text(budget.year_month),
      budgetAmount,
      usedAmount: Math.round(used * 100) / 100,
    });
  }
  return out;
}

/**
 * 讀取當月預算並計算已用金額。
 * 已用金額算法與 app/api/budgets/route.ts 一致：父分類預算含所有子分類的支出。
 */
function loadBudgetCandidates(userId: string, yearMonth: string): BudgetCandidate[] {
  const budgets = queryAll('SELECT * FROM budgets WHERE user_id = ? AND year_month = ?', [
    userId,
    yearMonth,
  ]) as unknown as Row[];
  if (budgets.length === 0) return [];

  const month = `${yearMonth}%`;
  const rows = budgets.map((budget) => {
    const categoryId = text(budget.category_id);
    let sql =
      "SELECT COALESCE(SUM(twd_amount),0) AS used FROM transactions WHERE user_id = ? AND type='expense' AND date LIKE ? AND exclude_from_stats = 0";
    const params: Array<string | number | null> = [userId, month];
    let categoryName = '';
    if (categoryId) {
      const cat = queryOne('SELECT name, parent_id FROM categories WHERE id = ? AND user_id = ?', [
        categoryId,
        userId,
      ]);
      categoryName = text(cat?.name);
      const isParent = !cat?.parent_id || cat?.parent_id === '';
      if (isParent) {
        const children = queryAll('SELECT id FROM categories WHERE parent_id = ? AND user_id = ?', [
          categoryId,
          userId,
        ]) as unknown as Row[];
        const allIds = [categoryId, ...children.map((c) => text(c.id))];
        sql += ` AND category_id IN (${allIds.map(() => '?').join(',')})`;
        params.push(...allIds);
      } else {
        sql += ' AND category_id = ?';
        params.push(categoryId);
      }
    }
    const used = num(queryOne(sql, params)?.used);
    return { budget, used, categoryName };
  });

  return findExceededBudgets(rows);
}

// ── 股利發放 ──

export interface DividendCandidate {
  dividendId: string;
  symbol: string;
  stockName: string;
  date: string;
  cashDividend: number;
  stockDividendShares: number;
  currency: string;
}

/**
 * 篩出「發放日為指定日期且確實有金額或股數」的股利。
 * 純函式：呼叫端負責以使用者時區算出 today。
 */
export function findTodayDividends(rows: Row[], today: string): DividendCandidate[] {
  const out: DividendCandidate[] = [];
  for (const row of rows) {
    const date = text(row.date);
    if (date !== today) continue;
    const cashDividend = num(row.cash_dividend);
    const stockDividendShares = num(row.stock_dividend_shares);
    if (cashDividend <= 0 && stockDividendShares <= 0) continue;
    out.push({
      dividendId: text(row.id),
      symbol: text(row.symbol),
      stockName: text(row.stock_name),
      date,
      cashDividend,
      stockDividendShares,
      currency: text(row.currency) || 'TWD',
    });
  }
  return out;
}

function loadDividendCandidates(userId: string, today: string): DividendCandidate[] {
  const rows = queryAll(
    `SELECT sd.id, sd.date, sd.cash_dividend, sd.stock_dividend_shares, s.symbol, s.name AS stock_name, s.currency
     FROM stock_dividends sd
     LEFT JOIN stocks s ON s.id = sd.stock_id
     WHERE sd.user_id = ? AND sd.date = ?`,
    [userId, today],
  ) as unknown as Row[];
  return findTodayDividends(rows, today);
}

// ── 統一入口 ──

export interface PushEventScanResult {
  preferences: PushPreferences;
  events: PushEvent[];
}

/**
 * 掃描某位使用者在「當地今天」應推播的事件（純讀取，不發送、不寫入）。
 * 已關閉的種類直接略過，連查詢都不做。
 */
export function scanPushEvents(
  userId: string,
  timezone: string,
  now: number = Date.now(),
  preferences?: PushPreferences,
): PushEventScanResult {
  const prefs = preferences ?? getUserPushPreferences(userId);
  const tz = isValidIanaTimezone(timezone) ? timezone : 'Asia/Taipei';
  const parts = partsInTz(tz, now);
  const today = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  const events: PushEvent[] = [];

  if (prefs.bill_due) {
    for (const candidate of loadBillDueCandidates(userId, today)) {
      events.push({ category: 'bill_due', ...candidate } satisfies BillDueEvent);
    }
  }
  if (prefs.budget_exceeded) {
    const yearMonth = yearMonthOf(partsInTz(tz, now));
    for (const candidate of loadBudgetCandidates(userId, yearMonth)) {
      events.push({ category: 'budget_exceeded', ...candidate } satisfies BudgetExceededEvent);
    }
  }
  if (prefs.dividend) {
    for (const candidate of loadDividendCandidates(userId, today)) {
      events.push({ category: 'dividend', ...candidate } satisfies DividendEvent);
    }
  }

  return { preferences: prefs, events };
}

/**
 * 掃描並發送（冪等）。回傳逐事件的結果供使用者操作觸發的維護流程記錄。
 * 任何單一事件失敗都不影響其他事件。
 *
 * 每個請求都掃描會浪費查詢（三種事件每天只會變動一次），故加冷卻時間；
 * 真正防重複的是 web_push_send_log 的 UNIQUE 條件，冷卻僅為效能最佳化。
 */
const DISPATCH_COOLDOWN_MS = 60 * 1000;
const lastDispatchAt = new Map<string, number>();

export async function dispatchDuePushEvents(
  userId: string,
  timezone: string,
  now: number = Date.now(),
): Promise<{ preferences: PushPreferences; results: PushDispatchResult[] }> {
  const key = String(userId);
  if (now - Number(lastDispatchAt.get(key) || 0) < DISPATCH_COOLDOWN_MS) {
    return { preferences: getUserPushPreferences(userId), results: [] };
  }
  lastDispatchAt.set(key, now);

  const { preferences, events } = scanPushEvents(userId, timezone, now);
  const results: PushDispatchResult[] = [];
  for (const event of events) {
    try {
      results.push(await dispatchPushEvent(userId, event));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[web-push] dispatch failed', { userId, category: event.category, message });
      results.push({
        status: 'failed',
        delivered: 0,
        expired: 0,
        failed: 0,
        reason: message,
      });
    }
  }
  return { preferences, results };
}

export { defaultPushPreferences };
