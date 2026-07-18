export interface DashboardDriver {
  type: 'income' | 'expense';
  name: string;
  color: string;
  amount: number;
  share: number;
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
