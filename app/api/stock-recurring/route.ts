// @ts-nocheck
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { requireAuth } from '../../../lib/apiHelpers';
import { getDB, queryOne, queryAll, saveDB } from '../../../lib/db';

function uid() { return crypto.randomUUID().replace(/-/g, ''); }

function normalizeDate(dateStr) {
  const s = String(dateStr || '').trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const rows = queryAll(
    `SELECT sr.*, s.symbol, s.name as stock_name
     FROM stock_recurring sr
     LEFT JOIN stocks s ON sr.stock_id = s.id
     WHERE sr.user_id = ?
     ORDER BY sr.start_date DESC, sr.created_at DESC`,
    [auth.userId]
  );
  return NextResponse.json(rows.map(r => ({
    ...r, stockId: r.stock_id, accountId: r.account_id, startDate: r.start_date,
    isActive: !!r.is_active, lastGenerated: r.last_generated, stockName: r.stock_name,
  })));
}

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const { stockId, amount, frequency, startDate: rawStartDate, accountId, note } = body;
  const startDate = normalizeDate(rawStartDate);
  const nAmount = Number(amount);
  const validFreq = ['daily', 'weekly', 'monthly', 'yearly'];
  if (!stockId || !(nAmount > 0) || !startDate || !validFreq.includes(frequency)) {
    return NextResponse.json({ error: '欄位格式不正確' }, { status: 400 });
  }
  const stock = queryOne('SELECT id FROM stocks WHERE id = ? AND user_id = ?', [stockId, auth.userId]);
  if (!stock) return NextResponse.json({ error: '股票不存在' }, { status: 400 });

  const id = uid();
  getDB().run(
    'INSERT INTO stock_recurring (id, user_id, stock_id, amount, frequency, start_date, account_id, note, is_active, last_generated, created_at) VALUES (?,?,?,?,?,?,?,?,1,NULL,?)',
    [id, auth.userId, stockId, nAmount, frequency, startDate, accountId || '', note || '', Date.now()]
  );
  saveDB();
  return NextResponse.json({ id });
}
