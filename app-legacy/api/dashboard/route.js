import { NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import { queryAll, queryOne } from '../../../lib/db';
import { todayInUserTz, monthInUserTz } from '../../../lib/userTime';
import { buildCategoryAggregateNodes } from '../../../lib/dashboardHelpers';

export async function GET(request) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const ymRaw = String(searchParams.get('yearMonth') || '');
  const validYm = /^\d{4}-(0[1-9]|1[0-2])$/.test(ymRaw);
  const month = validYm ? ymRaw : monthInUserTz(auth.userTimezone);
  const todayS = todayInUserTz(auth.userTimezone);

  const income = queryOne(
    "SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type='income' AND date LIKE ? AND exclude_from_stats = 0",
    [auth.userId, month + '%']
  )?.total || 0;
  const expense = queryOne(
    "SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type='expense' AND date LIKE ? AND exclude_from_stats = 0",
    [auth.userId, month + '%']
  )?.total || 0;
  const todayExpense = queryOne(
    "SELECT COALESCE(SUM(amount),0) as total FROM transactions WHERE user_id = ? AND type='expense' AND date = ? AND exclude_from_stats = 0",
    [auth.userId, todayS]
  )?.total || 0;

  const catRows = queryAll(`
    SELECT t.category_id, t.amount,
           c.name as cat_name, c.color as cat_color,
           c.parent_id as cat_parent_id,
           p.name as cat_parent_name, p.color as cat_parent_color
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories p ON c.parent_id = p.id
    WHERE t.user_id = ? AND t.type = 'expense' AND t.date LIKE ? AND t.exclude_from_stats = 0
  `, [auth.userId, month + '%']);
  const catBreakdown = buildCategoryAggregateNodes(catRows);

  const incomeCatRows = queryAll(`
    SELECT t.category_id, t.amount,
           c.name as cat_name, c.color as cat_color,
           c.parent_id as cat_parent_id,
           p.name as cat_parent_name, p.color as cat_parent_color
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories p ON c.parent_id = p.id
    WHERE t.user_id = ? AND t.type = 'income' AND t.date LIKE ? AND t.exclude_from_stats = 0
  `, [auth.userId, month + '%']);
  const incomeCatBreakdown = buildCategoryAggregateNodes(incomeCatRows);

  const recent = queryAll(`
    SELECT t.*, c.name as cat_name, c.color as cat_color
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND t.type IN ('income','expense') AND t.exclude_from_stats = 0 AND t.date LIKE ?
    ORDER BY t.date DESC, t.created_at DESC LIMIT 5
  `, [auth.userId, month + '%']);

  return NextResponse.json({ yearMonth: month, income, expense, net: income - expense, todayExpense, catBreakdown, incomeCatBreakdown, recent });
}
