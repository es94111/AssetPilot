import { NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../lib/db';
import { normalizeCurrency, convertToTwd, normalizeDate } from '../../../lib/accountHelpers';
import { uid } from '../../../lib/userDefaults';
import { todayInUserTz, isValidIsoDate } from '../../../lib/userTime';
import moneyDecimal from '../../../lib/moneyDecimal';

const SORT_REGEX = /^(date|amount|account|category|type)_(asc|desc)$/;

export async function GET(request) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const type = searchParams.get('type') || '';
  const categoryId = searchParams.get('categoryId') || '';
  const accountId = searchParams.get('accountId') || '';
  const page = searchParams.get('page') || '1';
  const keyword = String(searchParams.get('keyword') || '').trim();

  const limitRaw = parseInt(searchParams.get('limit'), 10);
  const pageSize = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 20;
  if (pageSize > 500) {
    return NextResponse.json({ error: '每頁最多 500 筆', code: 'PageSizeOutOfRange' }, { status: 400 });
  }

  const sortStr = String(searchParams.get('sort') || 'date_desc').toLowerCase();
  const sortMatch = SORT_REGEX.exec(sortStr);
  if (searchParams.get('sort') && !sortMatch) {
    return NextResponse.json({ error: 'sort 參數格式無效', code: 'ValidationError', field: 'sort' }, { status: 400 });
  }
  const sortField = sortMatch ? sortMatch[1] : 'date';
  const sortDir = sortMatch && sortMatch[2] === 'asc' ? 'ASC' : 'DESC';

  const needJoinAcc = sortField === 'account';
  const needJoinCat = sortField === 'category';
  let baseTable = 'transactions t';
  if (needJoinAcc) baseTable += ' LEFT JOIN accounts acc ON acc.id = t.account_id';
  if (needJoinCat) baseTable += ' LEFT JOIN categories cat ON cat.id = t.category_id';
  baseTable += ' LEFT JOIN recurring r ON r.id = t.source_recurring_id AND r.user_id = t.user_id';

  const today = todayInUserTz(auth.userTimezone);
  let where = 't.user_id = ?';
  const params = [auth.userId];

  if (dateFrom) { where += ' AND t.date >= ?'; params.push(dateFrom); }
  if (dateTo) { where += ' AND t.date <= ?'; params.push(dateTo); }
  if (type && type !== 'all') {
    if (type === 'transfer') {
      where += " AND (t.type = 'transfer_out' OR t.type = 'transfer_in')";
    } else if (type === 'future') {
      where += ' AND t.date > ?';
      params.push(today);
    } else {
      where += ' AND t.type = ?'; params.push(type);
    }
  }
  if (categoryId && categoryId !== 'all') {
    const requested = String(categoryId).split(',').map(s => s.trim()).filter(Boolean);
    if (requested.length > 0) {
      const placeholders = requested.map(() => '?').join(',');
      const childRows = queryAll(
        `SELECT id FROM categories WHERE user_id = ? AND parent_id IN (${placeholders})`,
        [auth.userId, ...requested]
      );
      const expanded = new Set(requested);
      childRows.forEach(r => expanded.add(r.id));
      const ids = [...expanded];
      const idPh = ids.map(() => '?').join(',');
      where += ` AND t.category_id IN (${idPh})`;
      params.push(...ids);
    }
  }
  if (accountId && accountId !== 'all') { where += ' AND t.account_id = ?'; params.push(accountId); }
  if (keyword) { where += ' AND LOWER(t.note) LIKE LOWER(?)'; params.push(`%${keyword}%`); }

  const countSql = `SELECT COUNT(*) as cnt FROM ${baseTable} WHERE ${where}`;
  const total = queryOne(countSql, params)?.cnt || 0;

  let orderClause;
  if (sortField === 'date') orderClause = `ORDER BY t.date ${sortDir}, t.created_at DESC`;
  else if (sortField === 'amount') orderClause = `ORDER BY t.amount ${sortDir}, t.date DESC`;
  else if (sortField === 'type') orderClause = `ORDER BY t.type ${sortDir}, t.date DESC`;
  else if (sortField === 'account') orderClause = `ORDER BY acc.name ${sortDir}, t.date DESC`;
  else if (sortField === 'category') orderClause = `ORDER BY cat.name ${sortDir}, t.date DESC`;

  const pageNum = parseInt(page) || 1;
  const offset = (pageNum - 1) * pageSize;
  const selectCols = "t.*, COALESCE(NULLIF(r.note, ''), '（未命名配方）') AS source_recurring_name";
  const sql = `SELECT ${selectCols} FROM ${baseTable} WHERE ${where} ${orderClause} LIMIT ${pageSize} OFFSET ${offset}`;
  const items = queryAll(sql, params).map(r => ({
    ...r,
    categoryId: r.category_id,
    accountId: r.account_id,
    toAccountId: r.to_account_id || null,
    currency: normalizeCurrency(r.currency),
    originalAmount: Number(r.original_amount) > 0 ? Number(r.original_amount) : Number(r.amount) || 0,
    fxRate: Number(r.fx_rate) > 0 ? Number(r.fx_rate) : 1,
    fxFee: Number(r.fx_fee) || 0,
    twdAmount: Number(r.twd_amount) || Number(r.amount) || 0,
    excludeFromStats: r.exclude_from_stats === 1,
    linkedId: r.linked_id || '',
    sourceRecurringId: r.source_recurring_id || null,
    sourceRecurringName: r.source_recurring_id ? (r.source_recurring_name || null) : null,
    scheduledDate: r.scheduled_date || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));

  return NextResponse.json({
    data: items,
    items,
    total,
    page: pageNum,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    sort: `${sortField}_${sortDir.toLowerCase()}`,
  });
}

export async function POST(request) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const { type, amount, categoryId, accountId, note, excludeFromStats } = body;
  const rawDate = body.date;

  const date = (rawDate == null || String(rawDate).trim() === '')
    ? todayInUserTz(auth.userTimezone)
    : normalizeDate(rawDate);
  if (!date) return NextResponse.json({ error: '日期格式無效' }, { status: 400 });
  if (!isValidIsoDate(date)) return NextResponse.json({ error: '日期格式無效', code: 'ValidationError', field: 'date' }, { status: 400 });
  if (!['income', 'expense', 'transfer_in', 'transfer_out'].includes(type)) {
    return NextResponse.json({ error: '交易類型無效' }, { status: 400 });
  }

  if (categoryId) {
    const catOwned = queryOne('SELECT id FROM categories WHERE id = ? AND user_id = ?', [categoryId, auth.userId]);
    if (!catOwned) return NextResponse.json({ error: '分類不存在或無權限' }, { status: 400 });
    const catRow = queryOne('SELECT parent_id FROM categories WHERE id = ? AND user_id = ?', [categoryId, auth.userId]);
    if (catRow && !catRow.parent_id) {
      return NextResponse.json({ error: '交易必須指派至子分類，不能直接掛在父分類底下' }, { status: 400 });
    }
  }
  if (accountId) {
    const accOwned = queryOne('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [accountId, auth.userId]);
    if (!accOwned) return NextResponse.json({ error: '帳戶不存在或無權限' }, { status: 400 });
  }

  const numAmt = Number(body.originalAmount ?? amount);
  if (!Number.isFinite(numAmt) || numAmt <= 0) {
    return NextResponse.json({ error: '金額必須大於 0', code: 'ValidationError', field: 'amount' }, { status: 400 });
  }

  let converted;
  try {
    converted = convertToTwd(body.originalAmount ?? amount, body.currency, body.fxRate, auth.userId);
  } catch (e) {
    return NextResponse.json({ error: e.message || '金額格式錯誤' }, { status: 400 });
  }

  const fxFee = Math.max(0, Number(body.fxFee) || 0);
  const totalTwd = converted.twdAmount + fxFee;
  const twdAmountInt = moneyDecimal.computeTwdAmount(
    Math.round(converted.originalAmount * 100) / 100,
    String(converted.fxRate || 1),
    fxFee
  );

  const id = uid();
  const now = Date.now();
  const db = getDB();
  db.run(
    'INSERT INTO transactions (id, user_id, type, amount, currency, original_amount, fx_rate, fx_fee, twd_amount, date, category_id, account_id, note, exclude_from_stats, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, auth.userId, type, totalTwd, converted.currency, converted.originalAmount, converted.fxRate, fxFee, twdAmountInt, date, categoryId, accountId, note || '', excludeFromStats ? 1 : 0, now, now]
  );
  saveDB();
  return NextResponse.json({ id, twdAmount: twdAmountInt, updatedAt: now }, { status: 201 });
}
