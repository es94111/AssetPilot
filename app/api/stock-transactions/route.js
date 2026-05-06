import { NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../lib/db';
import { uid } from '../../../lib/userDefaults';
import { normalizeDate } from '../../../lib/accountHelpers';
import {
  getStockSettings,
  calcStockTax,
  getSharesAtDate,
  validateChainConstraint,
} from '../../../lib/stockHelpers';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const stockId = searchParams.get('stockId') || '';
  const page = searchParams.get('page') || '';
  const pageSize = searchParams.get('pageSize') || '';
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const sortBy = searchParams.get('sortBy') || '';
  const sortDir = searchParams.get('sortDir') || '';

  let whereSql = 'WHERE st.user_id = ?';
  const params = [auth.userId];
  if (stockId) { whereSql += ' AND st.stock_id = ?'; params.push(stockId); }
  if (dateFrom) { whereSql += ' AND st.date >= ?'; params.push(normalizeDate(dateFrom)); }
  if (dateTo) { whereSql += ' AND st.date <= ?'; params.push(normalizeDate(dateTo)); }

  const validSortCols = {
    date: 'st.date', type: 'st.type', symbol: 's.symbol',
    shares: 'st.shares', price: 'st.price', fee: 'st.fee', tax: 'st.tax',
    subtotal: '(st.shares * st.price)',
  };
  const dir = sortDir === 'asc' ? 'ASC' : 'DESC';
  const sortCol = validSortCols[sortBy] || 'st.date';
  const orderSql = ` ORDER BY ${sortCol} ${dir}, st.created_at DESC`;

  if (page && pageSize) {
    const p = Math.max(1, parseInt(page));
    const ps = Math.max(1, Math.min(9999, parseInt(pageSize)));
    const countRow = queryOne(`SELECT COUNT(*) as cnt FROM stock_transactions st ${whereSql}`, params);
    const total = countRow ? countRow.cnt : 0;
    const totalPages = Math.ceil(total / ps);
    const dataSql = `SELECT st.*, s.symbol, s.name as stock_name FROM stock_transactions st LEFT JOIN stocks s ON st.stock_id = s.id ${whereSql}${orderSql} LIMIT ? OFFSET ?`;
    const data = queryAll(dataSql, [...params, ps, (p - 1) * ps]);
    return NextResponse.json({ data, total, page: p, totalPages });
  }

  const sql = `SELECT st.*, s.symbol, s.name as stock_name FROM stock_transactions st LEFT JOIN stocks s ON st.stock_id = s.id ${whereSql}${orderSql}`;
  return NextResponse.json(queryAll(sql, params));
}

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const { stockId, type, shares, price, fee, tax, accountId, note } = body;
  const date = normalizeDate(body.date);

  if (!stockId || !date || !type || !shares || !price) {
    return NextResponse.json({ error: '必填欄位未填' }, { status: 400 });
  }
  if (!['buy', 'sell'].includes(type)) {
    return NextResponse.json({ error: '交易類型無效' }, { status: 400 });
  }
  if (!(Number(shares) > 0)) return NextResponse.json({ error: '股數必須為正數' }, { status: 400 });
  if (!Number.isInteger(Number(shares))) return NextResponse.json({ error: '股數必須為整數' }, { status: 400 });
  if (!(Number(price) > 0)) return NextResponse.json({ error: '價格必須為正數' }, { status: 400 });
  if (Number(fee) < 0 || Number(tax) < 0) {
    return NextResponse.json({ error: '手續費/稅費不可為負' }, { status: 400 });
  }

  const stock = queryOne('SELECT id FROM stocks WHERE id = ? AND user_id = ?', [stockId, auth.userId]);
  if (!stock) return NextResponse.json({ error: '股票不存在' }, { status: 400 });

  if (accountId) {
    const acc = queryOne('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [accountId, auth.userId]);
    if (!acc) return NextResponse.json({ error: '帳戶不存在或無權限' }, { status: 400 });
  }

  if (type === 'sell') {
    const sharesAt = getSharesAtDate(auth.userId, stockId, date);
    if (sharesAt < Number(shares)) {
      return NextResponse.json({ error: `賣出股數不可超過 ${date} 當下持有 (${sharesAt} 股)` }, { status: 400 });
    }
    const chain = validateChainConstraint(auth.userId, stockId, date, 'sell', Number(shares));
    if (!chain.ok) {
      return NextResponse.json(
        { error: `此交易會造成 ${chain.conflictDate} 持有量為負 (預期 ${chain.expectedShares} 股)` },
        { status: 400 }
      );
    }
  }

  const taxAutoCalc = (body.tax === undefined || body.tax === null || body.tax === '') ? 1 : 0;
  const id = uid();
  const db = getDB();
  db.run(
    'INSERT INTO stock_transactions (id,user_id,stock_id,date,type,shares,price,fee,tax,account_id,note,created_at,tax_auto_calculated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, auth.userId, stockId, date, type, shares, price, fee || 0, tax || 0, accountId || '', note || '', Date.now(), taxAutoCalc]
  );
  saveDB();

  return NextResponse.json({ id }, { status: 201 });
}
