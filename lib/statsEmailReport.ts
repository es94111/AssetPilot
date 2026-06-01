// @ts-nocheck

import { queryAll, queryOne } from './db';
import * as userTime from './userTime';

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatAmount(value, currency = 'TWD') {
  const n = Number(value) || 0;
  return `${currency} ${Math.round(n).toLocaleString('zh-TW')}`;
}

function total(sql, params) {
  return Number(queryOne(sql, params)?.total) || 0;
}

function ymdFromParts(parts) {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function addDays(ymd, delta) {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + delta));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function lastDayOfMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const date = new Date(Date.UTC(y, m, 0));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function previousMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 2, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function periodFor(freq, tz, nowMs = Date.now()) {
  const today = ymdFromParts(userTime.partsInTz(tz || 'Asia/Taipei', nowMs));
  if (freq === 'weekly') {
    const parts = userTime.partsInTz(tz || 'Asia/Taipei', nowMs);
    const daysSinceMon = (parts.weekday + 6) % 7;
    const end = addDays(today, -daysSinceMon - 1);
    const start = addDays(end, -6);
    return { kind: 'weekly', start, end, label: `上週（${start} ~ ${end}）` };
  }
  if (freq === 'monthly') {
    const prev = previousMonth(userTime.monthInUserTz(tz || 'Asia/Taipei', nowMs));
    return { kind: 'monthly', start: `${prev}-01`, end: lastDayOfMonth(prev), label: `上月（${prev}）` };
  }
  const yesterday = addDays(today, -1);
  return { kind: 'daily', start: yesterday, end: yesterday, label: `昨日（${yesterday}）` };
}

function pctChange(current, prev) {
  const c = Number(current) || 0;
  const p = Number(prev) || 0;
  if (p === 0) return c === 0 ? 0 : null;
  return ((c - p) / Math.abs(p)) * 100;
}

function buildDailyBreakdown(userId, start, end) {
  const rows = queryAll(`
    SELECT date,
           COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0) AS income,
           COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0) AS expense
    FROM transactions
    WHERE user_id = ? AND date >= ? AND date <= ? AND exclude_from_stats = 0
    GROUP BY date
    ORDER BY date
  `, [userId, start, end]);
  return rows.map(row => {
    const income = Number(row.income) || 0;
    const expense = Number(row.expense) || 0;
    const d = new Date(`${row.date}T00:00:00Z`);
    return { date: row.date, weekday: d.getUTCDay(), income, expense, net: income - expense };
  });
}

function buildStockSummary(userId) {
  const stocks = queryAll('SELECT * FROM stocks WHERE user_id = ?', [userId]);
  let stockHoldings = 0;
  let stockCostTwd = 0;
  let stockMarketValueTwd = 0;
  let stalestPriceAsOf = null;

  for (const stock of stocks) {
    const txs = queryAll(
      'SELECT * FROM stock_transactions WHERE user_id = ? AND stock_id = ? ORDER BY date, created_at',
      [userId, stock.id]
    );
    let shares = 0;
    let cost = 0;
    for (const tx of txs) {
      const txShares = Number(tx.shares) || 0;
      const gross = txShares * (Number(tx.price) || 0);
      if (tx.type === 'buy') {
        shares += txShares;
        cost += gross + (Number(tx.fee) || 0) + (Number(tx.tax) || 0);
      } else if (tx.type === 'sell' && shares > 0) {
        const ratio = Math.min(1, txShares / shares);
        cost -= cost * ratio;
        shares -= txShares;
      }
    }
    if (shares <= 0) continue;
    stockHoldings += 1;
    stockCostTwd += cost;
    stockMarketValueTwd += shares * (Number(stock.current_price) || 0);
    if (stock.updated_at && (!stalestPriceAsOf || String(stock.updated_at) < String(stalestPriceAsOf))) {
      stalestPriceAsOf = stock.updated_at;
    }
  }

  const stockUnrealizedPL = stockMarketValueTwd - stockCostTwd;
  return {
    stockHoldings,
    stockCostTwd: Math.round(stockCostTwd),
    stockMarketValueTwd: Math.round(stockMarketValueTwd),
    stockUnrealizedPL: Math.round(stockUnrealizedPL),
    stockReturnPct: stockCostTwd > 0 ? (stockUnrealizedPL / stockCostTwd) * 100 : null,
    stalestPriceAsOf,
  };
}

export function buildUserStatsReport(userId, freq = 'daily', userTimezone = 'Asia/Taipei') {
  const tz = userTimezone || 'Asia/Taipei';
  const month = userTime.monthInUserTz(tz);
  const prevMonth = previousMonth(month);
  const period = periodFor(freq, tz);
  const comparePeriod = freq === 'daily'
    ? periodFor('daily', tz, Date.parse(`${period.start}T12:00:00Z`))
    : freq === 'weekly'
      ? { start: addDays(period.start, -7), end: addDays(period.end, -7), label: '對比上週' }
      : { start: `${previousMonth(prevMonth)}-01`, end: lastDayOfMonth(previousMonth(prevMonth)), label: '對比上月' };

  const income = total("SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE user_id = ? AND type = 'income' AND date LIKE ? AND exclude_from_stats = 0", [userId, `${month}%`]);
  const expense = total("SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE user_id = ? AND type = 'expense' AND date LIKE ? AND exclude_from_stats = 0", [userId, `${month}%`]);
  const prevIncome = total("SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE user_id = ? AND type = 'income' AND date >= ? AND date <= ? AND exclude_from_stats = 0", [userId, comparePeriod.start, comparePeriod.end]);
  const prevExpense = total("SELECT COALESCE(SUM(amount),0) AS total FROM transactions WHERE user_id = ? AND type = 'expense' AND date >= ? AND date <= ? AND exclude_from_stats = 0", [userId, comparePeriod.start, comparePeriod.end]);

  const accounts = queryAll('SELECT id, initial_balance, currency, exclude_from_total FROM accounts WHERE user_id = ?', [userId]);
  const balanceByCurrency = {};
  for (const account of accounts) {
    if (account.exclude_from_total) continue;
    const currency = account.currency || 'TWD';
    const txTotal = total('SELECT COALESCE(SUM(CASE WHEN type = \'income\' THEN amount ELSE -amount END),0) AS total FROM transactions WHERE user_id = ? AND account_id = ?', [userId, account.id]);
    balanceByCurrency[currency] = (balanceByCurrency[currency] || 0) + (Number(account.initial_balance) || 0) + txTotal;
  }

  const topCategories = queryAll(`
    SELECT COALESCE(pc.name, c.name, '未分類') AS name,
           COALESCE(pc.color, c.color, '#94a3b8') AS color,
           COALESCE(SUM(t.amount), 0) AS total
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN categories pc ON c.parent_id = pc.id
    WHERE t.user_id = ? AND t.type = 'expense' AND t.date LIKE ? AND t.exclude_from_stats = 0
    GROUP BY COALESCE(pc.name, c.name, '未分類'), COALESCE(pc.color, c.color, '#94a3b8')
    ORDER BY total DESC
    LIMIT 5
  `, [userId, `${month}%`]);

  const recentTransactions = queryAll(`
    SELECT t.*, c.name AS cat_name, c.color AS cat_color
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.user_id = ? AND t.date >= ? AND t.date <= ? AND t.exclude_from_stats = 0
    ORDER BY t.date DESC, t.created_at DESC
    LIMIT 8
  `, [userId, period.start, period.end]);

  const dailyBreakdown = buildDailyBreakdown(userId, period.start, period.end);
  const net = income - expense;
  const stock = buildStockSummary(userId);

  return {
    month,
    period,
    compareLabel: comparePeriod.label || (freq === 'daily' ? '對比前日' : freq === 'weekly' ? '對比上週' : '對比上月'),
    balanceByCurrency,
    income,
    expense,
    net,
    incomeChangePct: pctChange(income, prevIncome),
    expenseChangePct: pctChange(expense, prevExpense),
    netChangePct: pctChange(net, prevIncome - prevExpense),
    savingsRate: income > 0 ? Math.max(0, Math.min(1, net / income)) : 0,
    topCategories,
    topCategoriesMax: topCategories.reduce((max, c) => Math.max(max, Number(c.total) || 0), 0),
    recentTransactions,
    dailyBreakdown,
    ...stock,
  };
}

function changePill(pct, kind, label) {
  if (pct === null || pct === undefined) return `<span style="font-size:11px;color:#64748b">${escapeHtml(label)} --</span>`;
  const rounded = Math.round(pct * 10) / 10;
  const good = kind === 'good-down' ? rounded <= 0 : rounded >= 0;
  const color = rounded === 0 ? '#64748b' : good ? '#16a34a' : '#dc2626';
  return `<span style="font-size:11px;color:${color}">${escapeHtml(label)} ${rounded > 0 ? '+' : ''}${rounded}%</span>`;
}

export function renderStatsEmailHtml(displayName, email, stats) {
  const name = escapeHtml(displayName || String(email || '').split('@')[0] || '使用者');
  const COLOR_BORDER = '#e2e8f0';
  const COLOR_MUTED = '#64748b';
  const COLOR_INK = '#0f172a';
  const COLOR_GREEN = '#16a34a';
  const COLOR_RED = '#dc2626';

  const kpi = (label, value, color, pill) => `<td width="33%" style="padding:0 5px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${COLOR_BORDER};border-radius:12px;background:#fff"><tr><td style="padding:16px 12px;text-align:center"><div style="font-size:11px;color:${COLOR_MUTED};font-weight:700;letter-spacing:.08em">${escapeHtml(label)}</div><div style="font-size:20px;color:${color};font-weight:800;margin-top:6px">${escapeHtml(value)}</div><div style="margin-top:8px">${pill}</div></td></tr></table></td>`;
  const balanceRows = Object.entries(stats.balanceByCurrency).map(([currency, value]) => `<tr><td style="padding:10px 14px;border-bottom:1px solid ${COLOR_BORDER};color:${COLOR_MUTED};font-weight:700">${escapeHtml(currency)}</td><td style="padding:10px 14px;border-bottom:1px solid ${COLOR_BORDER};text-align:right;font-weight:800;color:${COLOR_INK}">${escapeHtml(formatAmount(value, currency))}</td></tr>`).join('') || `<tr><td colspan="2" style="padding:14px;text-align:center;color:#94a3b8">尚無帳戶</td></tr>`;
  const categoryRows = stats.topCategories.map((c, idx) => {
    const pct = stats.topCategoriesMax > 0 ? Math.round((Number(c.total) || 0) / stats.topCategoriesMax * 100) : 0;
    const color = /^#[0-9a-f]{3,8}$/i.test(c.color || '') ? c.color : '#94a3b8';
    return `<tr><td style="padding:11px 14px;border-bottom:1px solid ${COLOR_BORDER}"><table role="presentation" width="100%" style="table-layout:fixed"><tr><td width="60%" style="color:${COLOR_INK}">${idx + 1}. ${escapeHtml(c.name)}</td><td width="40%" style="text-align:right;font-weight:800">${escapeHtml(formatAmount(c.total))}</td></tr></table><div style="height:6px;background:#f1f5f9;border-radius:999px;margin-top:6px"><div style="height:6px;width:${pct}%;background:${color};border-radius:999px"></div></div></td></tr>`;
  }).join('') || `<tr><td style="padding:14px;text-align:center;color:#94a3b8">本月尚無支出紀錄</td></tr>`;
  const txRows = stats.recentTransactions.map(t => {
    const isIncome = t.type === 'income';
    return `<tr><td style="padding:10px 14px;border-bottom:1px solid ${COLOR_BORDER}"><div style="font-weight:700;color:${COLOR_INK}">${escapeHtml(t.cat_name || '未分類')}</div><div style="font-size:12px;color:#94a3b8">${escapeHtml(t.date)} ${escapeHtml(t.note || '')}</div></td><td style="padding:10px 14px;border-bottom:1px solid ${COLOR_BORDER};text-align:right;font-weight:800;color:${isIncome ? COLOR_GREEN : COLOR_RED}">${isIncome ? '+' : '-'}${escapeHtml(formatAmount(t.amount))}</td></tr>`;
  }).join('') || `<tr><td colspan="2" style="padding:14px;text-align:center;color:#94a3b8">${escapeHtml(stats.period.label)}沒有交易</td></tr>`;
  const stockBlock = stats.stockHoldings > 0 ? `<h2 style="font-size:16px;margin:24px 0 10px;color:${COLOR_INK}">股票投資</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid ${COLOR_BORDER};border-radius:12px"><tr><td style="padding:16px"><table role="presentation" width="100%"><tr><td width="55%" style="padding:8px 0;color:${COLOR_MUTED}">總成本</td><td width="45%" style="text-align:right;font-weight:800">${escapeHtml(formatAmount(stats.stockCostTwd))}</td></tr><tr><td style="padding:8px 0;color:${COLOR_MUTED}">市值</td><td style="text-align:right;font-weight:800">${escapeHtml(formatAmount(stats.stockMarketValueTwd))}</td></tr><tr><td style="padding:8px 0;color:${COLOR_MUTED}">未實現損益</td><td style="text-align:right;font-weight:800;color:${stats.stockUnrealizedPL >= 0 ? COLOR_GREEN : COLOR_RED}">${stats.stockUnrealizedPL >= 0 ? '+' : ''}${escapeHtml(formatAmount(stats.stockUnrealizedPL))}</td></tr><tr><td style="padding:8px 0;color:${COLOR_MUTED}">報酬率</td><td style="text-align:right;font-weight:800;color:${(stats.stockReturnPct || 0) >= 0 ? COLOR_GREEN : COLOR_RED}">${stats.stockReturnPct == null ? '--' : `${stats.stockReturnPct >= 0 ? '+' : ''}${stats.stockReturnPct.toFixed(2)}%`}</td></tr></table></td></tr></table>` : '';

  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${COLOR_INK}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;background:#ffffff;border-radius:18px;overflow:hidden"><tr><td bgcolor="#4f46e5" style="padding:28px 24px;color:#ffffff;background-color:#4f46e5;background:#4f46e5 linear-gradient(135deg,#4f46e5,#7c3aed,#a855f7)"><div style="font-size:14px;opacity:.9">AssetPilot 資產統計報表</div><h1 style="margin:8px 0 0;font-size:26px;line-height:1.25">${name}，這是 ${escapeHtml(stats.month)} 的資產摘要</h1><div style="margin-top:8px;font-size:13px;opacity:.9">${escapeHtml(stats.period.label)}</div></td></tr><tr><td style="padding:22px 18px"><table role="presentation" width="100%"><tr>${kpi('本月收入', formatAmount(stats.income), COLOR_GREEN, changePill(stats.incomeChangePct, 'good-up', stats.compareLabel))}${kpi('本月支出', formatAmount(stats.expense), COLOR_RED, changePill(stats.expenseChangePct, 'good-down', stats.compareLabel))}${kpi('本月淨額', formatAmount(stats.net), stats.net >= 0 ? COLOR_INK : COLOR_RED, changePill(stats.netChangePct, 'good-up', stats.compareLabel))}</tr></table><h2 style="font-size:16px;margin:24px 0 10px;color:${COLOR_INK}">帳戶餘額</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${COLOR_BORDER};border-radius:12px;overflow:hidden">${balanceRows}</table><h2 style="font-size:16px;margin:24px 0 10px;color:${COLOR_INK}">本月支出 Top 5</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${COLOR_BORDER};border-radius:12px;overflow:hidden">${categoryRows}</table><h2 style="font-size:16px;margin:24px 0 10px;color:${COLOR_INK}">${escapeHtml(stats.period.label)}交易</h2><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid ${COLOR_BORDER};border-radius:12px;overflow:hidden">${txRows}</table>${stockBlock}</td></tr></table></td></tr></table></body></html>`;
}
