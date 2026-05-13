import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../lib/db';
import { normalizeCurrency, convertToTwd, normalizeDate } from '../../../lib/accountHelpers';
import { uid } from '../../../lib/userDefaults';
import { todayInUserTz, isValidIsoDate } from '../../../lib/userTime';
import { computeTwdAmount } from '../../../lib/moneyDecimal';

type TransactionType = 'income' | 'expense' | 'transfer_in' | 'transfer_out';
type SortField = 'date' | 'amount' | 'account' | 'category' | 'type';
type SortDir = 'ASC' | 'DESC';

interface TransactionRow {
  id: string;
  user_id: string;
  type: TransactionType | string;
  amount: number;
  currency: string | null;
  original_amount: number | null;
  fx_rate: string | number | null;
  fx_fee: number | null;
  twd_amount: number | null;
  date: string;
  category_id: string | null;
  account_id: string | null;
  to_account_id: string | null;
  note: string | null;
  exclude_from_stats: number | null;
  linked_id: string | null;
  source_recurring_id: string | null;
  source_recurring_name?: string | null;
  scheduled_date: string | null;
  created_at: string | number | null;
  updated_at: string | number | null;
  [key: string]: unknown;
}

interface TransactionListItem extends TransactionRow {
  categoryId: string | null;
  accountId: string | null;
  toAccountId: string | null;
  currency: string;
  originalAmount: number;
  fxRate: string;
  fxFee: number;
  twdAmount: number;
  excludeFromStats: boolean;
  linkedId: string;
  sourceRecurringId: string | null;
  sourceRecurringName: string | null;
  scheduledDate: string | null;
  createdAt: string | number | null;
  updatedAt: string | number | null;
  attachmentCount: number;
  firstAttachmentId: string | null;
}

interface TransactionListResponse {
  data: TransactionListItem[];
  items: TransactionListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  sort: string;
}

interface CreateTransactionRequest {
  type?: string;
  amount?: number | string;
  originalAmount?: number | string;
  currency?: string;
  fxRate?: number | string | null;
  fxFee?: number | string | null;
  date?: string | null;
  categoryId?: string | null;
  accountId?: string | null;
  note?: string | null;
  excludeFromStats?: boolean;
}

const SORT_REGEX = /^(date|amount|account|category|type)_(asc|desc)$/;
const TRANSACTION_TYPES = new Set(['income', 'expense', 'transfer_in', 'transfer_out']);

function asRows<T>(rows: Array<Record<string, string | number | null>>): T[] {
  return rows as unknown as T[];
}

function asRow<T>(row: Record<string, string | number | null> | null): T | null {
  return row as unknown as T | null;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const type = searchParams.get('type') || '';
  const categoryId = searchParams.get('categoryId') || '';
  const accountId = searchParams.get('accountId') || '';
  const page = searchParams.get('page') || '1';
  const keyword = String(searchParams.get('keyword') || '').trim();

  const limitRaw = parseInt(searchParams.get('limit') || '', 10);
  const pageSize = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 20;
  if (pageSize > 500) {
    return NextResponse.json({ error: '每頁最多 500 筆', code: 'PageSizeOutOfRange' }, { status: 400 });
  }

  const sortStr = String(searchParams.get('sort') || 'date_desc').toLowerCase();
  const sortMatch = SORT_REGEX.exec(sortStr);
  if (searchParams.get('sort') && !sortMatch) {
    return NextResponse.json({ error: 'sort 參數格式無效', code: 'ValidationError', field: 'sort' }, { status: 400 });
  }
  const sortField = (sortMatch ? sortMatch[1] : 'date') as SortField;
  const sortDir: SortDir = sortMatch && sortMatch[2] === 'asc' ? 'ASC' : 'DESC';

  const needJoinAcc = sortField === 'account';
  const needJoinCat = sortField === 'category';
  let baseTable = 'transactions t';
  if (needJoinAcc) baseTable += ' LEFT JOIN accounts acc ON acc.id = t.account_id';
  if (needJoinCat) baseTable += ' LEFT JOIN categories cat ON cat.id = t.category_id';
  baseTable += ' LEFT JOIN recurring r ON r.id = t.source_recurring_id AND r.user_id = t.user_id';

  const today = todayInUserTz(auth.userTimezone);
  let where = 't.user_id = ?';
  const params: Array<string | number | null> = [auth.userId];

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
      const childRows = asRows<{ id: string }>(queryAll(
        `SELECT id FROM categories WHERE user_id = ? AND parent_id IN (${placeholders})`,
        [auth.userId, ...requested]
      ));
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
  const total = Number(asRow<{ cnt: number }>(queryOne(countSql, params))?.cnt) || 0;

  let orderClause = '';
  if (sortField === 'date') orderClause = `ORDER BY t.date ${sortDir}, t.created_at DESC`;
  else if (sortField === 'amount') orderClause = `ORDER BY t.amount ${sortDir}, t.date DESC`;
  else if (sortField === 'type') orderClause = `ORDER BY t.type ${sortDir}, t.date DESC`;
  else if (sortField === 'account') orderClause = `ORDER BY acc.name ${sortDir}, t.date DESC`;
  else if (sortField === 'category') orderClause = `ORDER BY cat.name ${sortDir}, t.date DESC`;

  const pageNum = parseInt(page, 10) || 1;
  const offset = (pageNum - 1) * pageSize;
  const selectCols = `t.*,
    COALESCE(NULLIF(r.note, ''), '（未命名配方）') AS source_recurring_name,
    (SELECT COUNT(*) FROM transaction_attachments ta WHERE ta.transaction_id = t.id AND ta.user_id = t.user_id) AS attachment_count,
    (SELECT ta.id FROM transaction_attachments ta WHERE ta.transaction_id = t.id AND ta.user_id = t.user_id ORDER BY ta.created_at ASC LIMIT 1) AS first_attachment_id`;
  const sql = `SELECT ${selectCols} FROM ${baseTable} WHERE ${where} ${orderClause} LIMIT ${pageSize} OFFSET ${offset}`;
  const items = asRows<TransactionRow>(queryAll(sql, params)).map((r): TransactionListItem => ({
    ...r,
    categoryId: r.category_id,
    accountId: r.account_id,
    toAccountId: r.to_account_id || null,
    currency: normalizeCurrency(r.currency),
    originalAmount: Number(r.original_amount) > 0 ? Number(r.original_amount) : Number(r.amount) || 0,
    fxRate: String(r.fx_rate || '1'),
    fxFee: Number(r.fx_fee) || 0,
    twdAmount: Number(r.twd_amount) || Number(r.amount) || 0,
    excludeFromStats: r.exclude_from_stats === 1,
    linkedId: r.linked_id || '',
    sourceRecurringId: r.source_recurring_id || null,
    sourceRecurringName: r.source_recurring_id ? (r.source_recurring_name || null) : null,
    scheduledDate: r.scheduled_date || null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    attachmentCount: Number(r.attachment_count) || 0,
    firstAttachmentId: typeof r.first_attachment_id === 'string' ? r.first_attachment_id : null,
  }));

  const response: TransactionListResponse = {
    data: items,
    items,
    total,
    page: pageNum,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
    sort: `${sortField}_${sortDir.toLowerCase()}`,
  };

  return NextResponse.json(response);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({})) as CreateTransactionRequest;
  const { type, amount, categoryId, accountId, note, excludeFromStats } = body;
  const rawDate = body.date;

  const date = (rawDate == null || String(rawDate).trim() === '')
    ? todayInUserTz(auth.userTimezone)
    : normalizeDate(rawDate);
  if (!date) return NextResponse.json({ error: '日期格式無效' }, { status: 400 });
  if (!isValidIsoDate(date)) return NextResponse.json({ error: '日期格式無效', code: 'ValidationError', field: 'date' }, { status: 400 });
  if (!type || !TRANSACTION_TYPES.has(type)) {
    return NextResponse.json({ error: '交易類型無效' }, { status: 400 });
  }

  if (categoryId) {
    const catOwned = queryOne('SELECT id FROM categories WHERE id = ? AND user_id = ?', [categoryId, auth.userId]);
    if (!catOwned) return NextResponse.json({ error: '分類不存在或無權限' }, { status: 400 });
    const catRow = asRow<{ parent_id: string | null }>(queryOne('SELECT parent_id FROM categories WHERE id = ? AND user_id = ?', [categoryId, auth.userId]));
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
    converted = convertToTwd(Number(body.originalAmount ?? amount), body.currency || 'TWD', body.fxRate, auth.userId);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '金額格式錯誤' }, { status: 400 });
  }

  const fxFee = Math.max(0, Number(body.fxFee) || 0);
  const twdAmountInt = computeTwdAmount(
    Math.round(converted.originalAmount * 100) / 100,
    converted.fxRate,
    fxFee
  );

  const id = uid();
  const now = Date.now();
  const db = getDB();
  db.run(
    'INSERT INTO transactions (id, user_id, type, amount, currency, original_amount, fx_rate, fx_fee, twd_amount, date, category_id, account_id, note, exclude_from_stats, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, auth.userId, type, twdAmountInt, converted.currency, converted.originalAmount, converted.fxRate, fxFee, twdAmountInt, date, categoryId || null, accountId || null, note || '', excludeFromStats ? 1 : 0, now, now]
  );
  saveDB();
  return NextResponse.json({ id, twdAmount: twdAmountInt, updatedAt: now }, { status: 201 });
}
