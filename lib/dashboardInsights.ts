export interface DashboardDriver {
  type: 'income' | 'expense';
  name: string;
  color: string;
  amount: number;
  share: number;
}

export interface DashboardComparisonWindow {
  currentStart: string;
  currentEnd: string;
  previousStart: string;
  previousEnd: string;
  mode: 'monthToDate' | 'fullMonth';
}

export interface DashboardComparisonCategory {
  type: 'income' | 'expense';
  categoryId: string | null;
  name: string;
  color: string;
  amount: number;
}

export interface DashboardChangeDriver {
  type: 'income' | 'expense';
  categoryId: string | null;
  name: string;
  color: string;
  current: number;
  previous: number;
  delta: number;
  netContribution: number;
  isNew: boolean;
}

function daysInMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function formatDate(year: number, month: number, day: number) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function getDashboardComparisonWindow(
  selectedMonth: string,
  today: string
): DashboardComparisonWindow | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(selectedMonth) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  const todayMonth = today.slice(0, 7);
  if (selectedMonth > todayMonth) return null;

  const [year, month] = selectedMonth.split('-').map(Number);
  const previousDate = new Date(Date.UTC(year, month - 2, 1));
  const previousYear = previousDate.getUTCFullYear();
  const previousMonth = previousDate.getUTCMonth() + 1;
  const currentEndDay = selectedMonth === todayMonth
    ? Math.min(Number(today.slice(8, 10)), daysInMonth(year, month))
    : daysInMonth(year, month);
  const previousEndDay = selectedMonth === todayMonth
    ? Math.min(currentEndDay, daysInMonth(previousYear, previousMonth))
    : daysInMonth(previousYear, previousMonth);

  return {
    currentStart: formatDate(year, month, 1),
    currentEnd: formatDate(year, month, currentEndDay),
    previousStart: formatDate(previousYear, previousMonth, 1),
    previousEnd: formatDate(previousYear, previousMonth, previousEndDay),
    mode: selectedMonth === todayMonth ? 'monthToDate' : 'fullMonth',
  };
}

export function buildDashboardChangeDrivers(
  currentRows: DashboardComparisonCategory[],
  previousRows: DashboardComparisonCategory[],
  limit = 3
): DashboardChangeDriver[] {
  const byKey = new Map<string, DashboardChangeDriver>();
  const addRows = (rows: DashboardComparisonCategory[], side: 'current' | 'previous') => {
    for (const row of rows) {
      const key = `${row.type}:${row.categoryId ?? `name:${row.name}`}`;
      const existing = byKey.get(key) || {
        type: row.type,
        categoryId: row.categoryId,
        name: row.name,
        color: row.color,
        current: 0,
        previous: 0,
        delta: 0,
        netContribution: 0,
        isNew: false,
      };
      existing[side] += Number(row.amount) || 0;
      byKey.set(key, existing);
    }
  };
  addRows(currentRows, 'current');
  addRows(previousRows, 'previous');

  return Array.from(byKey.values())
    .map(driver => {
      const delta = driver.current - driver.previous;
      return {
        ...driver,
        delta,
        netContribution: driver.type === 'income' ? delta : -delta,
        isNew: driver.previous === 0 && driver.current !== 0,
      };
    })
    .filter(driver => driver.delta !== 0)
    .sort((a, b) =>
      Math.abs(b.netContribution) - Math.abs(a.netContribution)
      || a.type.localeCompare(b.type)
      || a.name.localeCompare(b.name)
    )
    .slice(0, Math.max(0, limit));
}

export function getHoldingMarketContribution(totalShares: number, currentPrice: number) {
  if (!Number.isFinite(totalShares) || totalShares <= 0) return { marketValue: 0, unpriced: false };
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return { marketValue: 0, unpriced: true };
  return { marketValue: totalShares * currentPrice, unpriced: false };
}

export function buildDashboardDrivers(
  expenseGroups: Array<{ parentName: string; parentColor: string; total: number }>,
  incomeGroups: Array<{ parentName: string; parentColor: string; total: number }>,
  totalExpense: number,
  totalIncome: number,
  limit = 3
): DashboardDriver[] {
  const toDriver = (
    type: DashboardDriver['type'],
    group: { parentName: string; parentColor: string; total: number },
    typeTotal: number
  ): DashboardDriver => ({
    type,
    name: group.parentName,
    color: group.parentColor,
    amount: Number(group.total) || 0,
    share: typeTotal > 0 ? Math.round(((Number(group.total) || 0) / typeTotal) * 1000) / 10 : 0,
  });

  return [
    ...expenseGroups.map(group => toDriver('expense', group, totalExpense)),
    ...incomeGroups.map(group => toDriver('income', group, totalIncome)),
  ]
    .filter(driver => driver.amount > 0)
    .sort((a, b) => b.amount - a.amount || a.type.localeCompare(b.type) || a.name.localeCompare(b.name))
    .slice(0, Math.max(0, limit));
}
