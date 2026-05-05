import { NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import { queryAll } from '../../../lib/db';
import { todayInUserTz, monthInUserTz } from '../../../lib/userTime';
import { buildCategoryAggregateNodes } from '../../../lib/dashboardHelpers';

export async function GET(request) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || '';
  let from = searchParams.get('from') || '';
  let to = searchParams.get('to') || '';
  const txType = type || 'expense';

  if (from && to && String(from) > String(to)) {
    return NextResponse.json({ error: '起始日不可晚於結束日' }, { status: 400 });
  }

  const month = monthInUserTz(auth.userTimezone);
  const today = todayInUserTz(auth.userTimezone);

  if (!from && !to) {
    from = month + '-01';
    const [y, m] = month.split('-').map(Number);
    const last = new Date(y, m, 0);
    to = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
  } else if (from && !to) {
    to = today;
  } else if (!from && to) {
    from = String(to).slice(0, 7) + '-01';
  }

  const txs = queryAll(`
    SELECT t.*, c.name as cat_name, c.color as cat_color, c.parent_id as cat_parent_id,
           p.name as cat_parent_name, p.color as cat_parent_color
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories p ON c.parent_id = p.id
    WHERE t.user_id = ? AND t.type = ? AND t.date >= ? AND t.date <= ? AND t.exclude_from_stats = 0
    ORDER BY t.date
  `, [auth.userId, txType, from, to]);

  const catMap = {};
  txs.forEach(t => {
    const amount = Number(t.amount) || 0;
    const name = t.cat_name || '未分類';
    const color = t.cat_color || '#94a3b8';
    if (!catMap[name]) catMap[name] = { total: 0, color };
    catMap[name].total += amount;
  });

  const categoryBreakdown = buildCategoryAggregateNodes(txs);

  const dailyMap = {};
  const monthlyMap = {};
  txs.forEach(t => {
    dailyMap[t.date] = (dailyMap[t.date] || 0) + Number(t.amount);
    const mo = t.date.slice(0, 7);
    monthlyMap[mo] = (monthlyMap[mo] || 0) + Number(t.amount);
  });

  return NextResponse.json({
    periodStart: from,
    periodEnd: to,
    catMap,
    categoryBreakdown,
    dailyMap,
    monthlyMap,
    total: txs.reduce((s, t) => s + Number(t.amount), 0),
  });
}
