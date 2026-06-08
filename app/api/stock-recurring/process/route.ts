// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryOne, queryAll, saveDB } from '../../../../lib/db';
import { getStockSettings, calcStockFee } from '../../../../lib/stockHelpers';
import { fetchTwseStockDay, fetchTpexStockDay } from '../../../../lib/twseFetchNext';
import crypto from 'crypto';

function uid() { return crypto.randomUUID().replace(/-/g, ''); }

function todayStr() { return new Date().toISOString().slice(0, 10); }

function getNextRecurringDate(prevIsoDate, freq) {
  const m = String(prevIsoDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10), mo = parseInt(m[2], 10), d = parseInt(m[3], 10);
  if (freq === 'daily') {
    const dt = new Date(Date.UTC(y, mo - 1, d)); dt.setUTCDate(dt.getUTCDate() + 1);
    return dt.toISOString().slice(0, 10);
  }
  if (freq === 'weekly') {
    const dt = new Date(Date.UTC(y, mo - 1, d)); dt.setUTCDate(dt.getUTCDate() + 7);
    return dt.toISOString().slice(0, 10);
  }
  if (freq === 'monthly') {
    let nm = mo + 1, ny = y;
    if (nm > 12) { nm = 1; ny++; }
    const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
    const day = Math.min(d, lastDay);
    return `${ny}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  if (freq === 'yearly') {
    const ny = y + 1;
    if (mo === 2 && d === 29) {
      const isLeap = (ny % 4 === 0 && ny % 100 !== 0) || ny % 400 === 0;
      return `${ny}-02-${isLeap ? '29' : '28'}`;
    }
    return `${ny}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}

const twseHolidayCache = { set: null, timestamp: 0, lastFailedAt: 0 };
const TWSE_HOLIDAY_CACHE_TTL = 24 * 60 * 60 * 1000;
const TWSE_HOLIDAY_FAILURE_BACKOFF = 5 * 60 * 1000;
let twseHolidayInflight = null;

async function fetchTwseHolidaySet() {
  const now = Date.now();
  if (twseHolidayCache.set && (now - twseHolidayCache.timestamp) < TWSE_HOLIDAY_CACHE_TTL) return twseHolidayCache.set;
  if ((now - twseHolidayCache.lastFailedAt) < TWSE_HOLIDAY_FAILURE_BACKOFF) return twseHolidayCache.set || new Set();
  if (twseHolidayInflight) return twseHolidayInflight;
  twseHolidayInflight = (async () => {
    try {
      const res = await fetch('https://openapi.twse.com.tw/v1/holidaySchedule/holidaySchedule', { headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) { twseHolidayCache.lastFailedAt = Date.now(); return twseHolidayCache.set || new Set(); }
      const list = await res.json();
      const set = new Set();
      list.forEach(item => {
        if (/開始交易|最後交易/.test(item.Name || '')) return;
        const rocDate = String(item.Date || '');
        if (!/^\d{7}$/.test(rocDate)) return;
        const y = parseInt(rocDate.slice(0, 3), 10) + 1911;
        set.add(`${y}-${rocDate.slice(3, 5)}-${rocDate.slice(5, 7)}`);
      });
      twseHolidayCache.set = set; twseHolidayCache.timestamp = Date.now(); twseHolidayCache.lastFailedAt = 0;
      return set;
    } catch (e) {
      twseHolidayCache.lastFailedAt = Date.now();
      return twseHolidayCache.set || new Set();
    } finally { twseHolidayInflight = null; }
  })();
  return twseHolidayInflight;
}

function nextTwseTradingDay(dateStr, holidaySet) {
  let cur = dateStr, safety = 60;
  while (safety-- > 0) {
    const [y, m, d] = cur.split('-').map(Number);
    const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (dow !== 0 && dow !== 6 && !(holidaySet && holidaySet.has(cur))) break;
    const nx = new Date(Date.UTC(y, m - 1, d + 1));
    cur = nx.toISOString().slice(0, 10);
  }
  return cur;
}

async function processStockRecurring(userId) {
  const recs = queryAll('SELECT * FROM stock_recurring WHERE user_id = ? AND is_active = 1', [userId]);
  if (recs.length === 0) return { generated: 0, skipped: 0, postponed: 0 };
  const settings = getStockSettings(userId);
  const todayS = todayStr();
  const holidaySet = await fetchTwseHolidaySet();
  const db = getDB();
  let generated = 0, skipped = 0, postponed = 0, touched = false;

  for (const r of recs) {
    let scheduledDate = r.last_generated ? getNextRecurringDate(r.last_generated, r.frequency) : r.start_date;
    while (scheduledDate && scheduledDate <= todayS) {
      const actualDate = nextTwseTradingDay(scheduledDate, holidaySet);
      if (actualDate > todayS) break;
      if (actualDate !== scheduledDate) postponed++;
      let price = 0;
      try {
        const stockRow = queryOne('SELECT id, symbol, current_price FROM stocks WHERE id = ? AND user_id = ?', [r.stock_id, userId]);
        if (stockRow?.symbol) {
          const ymd = String(actualDate).replace(/-/g, '');
          let info = await fetchTwseStockDay(stockRow.symbol, ymd);
          if (!info?.found || !(info.closingPrice > 0)) info = await fetchTpexStockDay(stockRow.symbol, ymd);
          price = (info?.found && info.closingPrice > 0) ? info.closingPrice : Number(stockRow.current_price || 0);
        }
      // nosemgrep: javascript.lang.security.audit.unsafe-formatstring.unsafe-formatstring -- 第一參數為已插值的字串字面值（無 %s 等格式符），e.message 為獨立參數，非格式字串注入
      } catch (e) { console.warn(`[stock-recurring] price query failed (${r.id}, ${actualDate}):`, e.message); }

      if (!(price > 0)) {
        db.run('UPDATE stock_recurring SET last_generated = ? WHERE id = ?', [scheduledDate, r.id]);
        touched = true; skipped++;
        scheduledDate = getNextRecurringDate(scheduledDate, r.frequency); continue;
      }
      const shares = Math.floor(Number(r.amount) / price);
      if (!(shares >= 1)) {
        db.run('UPDATE stock_recurring SET last_generated = ? WHERE id = ?', [scheduledDate, r.id]);
        touched = true; skipped++;
        scheduledDate = getNextRecurringDate(scheduledDate, r.frequency); continue;
      }
      const amount = shares * price;
      const fee = calcStockFee(amount, shares, settings);
      const noteParts = [r.note || '', '定期定額自動'];
      if (actualDate !== scheduledDate) noteParts.push(`原排程 ${scheduledDate} 順延`);
      try {
        db.run(
          'INSERT INTO stock_transactions (id,user_id,stock_id,date,type,shares,price,fee,tax,account_id,note,created_at,tax_auto_calculated,recurring_plan_id,period_start_date) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT DO NOTHING',
          [uid(), userId, r.stock_id, actualDate, 'buy', shares, price, fee, 0, r.account_id || '', noteParts.filter(Boolean).join(' | '), Date.now(), 1, r.id, scheduledDate]
        );
        if (db.getRowsModified() > 0) generated++; else skipped++;
      } catch (e) { console.warn('[stock-recurring] INSERT failed:', e.message); skipped++; }
      db.run('UPDATE stock_recurring SET last_generated = ? WHERE id = ?', [scheduledDate, r.id]);
      touched = true;
      scheduledDate = getNextRecurringDate(scheduledDate, r.frequency);
    }
  }
  if (touched) saveDB();
  return { generated, skipped, postponed };
}

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  try {
    const result = await processStockRecurring(auth.userId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: '排程處理失敗：' + e.message }, { status: 500 });
  }
}
