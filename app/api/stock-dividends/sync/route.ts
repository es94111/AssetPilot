// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../../lib/db';
import { uid } from '../../../../lib/userDefaults';

const DIVIDEND_CACHE_TTL = 30 * 60 * 1000;
const dividendCache = {};

function convertRocDate(rocStr) {
  const m = rocStr.match(/(\d+)年(\d+)月(\d+)日/);
  if (!m) return '';
  const year = parseInt(m[1]) + 1911;
  return `${year}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
}

async function fetchTwseDividendList(startDate, endDate) {
  const key = `${startDate}_${endDate}`;
  const now = Date.now();
  if (dividendCache[key] && (now - dividendCache[key].timestamp) < DIVIDEND_CACHE_TTL) {
    return dividendCache[key].data;
  }
  try {
    const url = `https://www.twse.com.tw/rwd/zh/exRight/TWT49U?response=json&startDate=${startDate}&endDate=${endDate}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.stat !== 'OK' || !json.data) return [];
    const records = json.data.map(row => ({
      dateRoc: row[0],
      date: convertRocDate(row[0]),
      symbol: row[1],
      name: row[2],
      valuePerShare: parseFloat(String(row[5]).replace(/,/g, '')) || 0,
      type: row[6],
      detailKey: row[11],
    }));
    dividendCache[key] = { data: records, timestamp: now };
    return records;
  } catch (e) {
    console.error('TWSE TWT49U 查詢失敗:', e.message);
    return [];
  }
}

async function fetchTwseDividendDetail(symbol, dateStr8) {
  const key = `detail_${symbol}_${dateStr8}`;
  const now = Date.now();
  if (dividendCache[key] && (now - dividendCache[key].timestamp) < DIVIDEND_CACHE_TTL) {
    return dividendCache[key].data;
  }
  try {
    const url = `https://www.twse.com.tw/rwd/zh/exRight/TWT49UDetail?response=json&STK_NO=${symbol}&T1=${dateStr8}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.stat !== 'ok' || !json.data || json.data.length === 0) return null;
    const row = json.data[0];
    const cashMatch = String(row[2]).match(/([\d.]+)/);
    const stockMatch = String(row[4]).match(/([\d.]+)/);
    const result = {
      symbol: row[0], name: row[1],
      cashDividendPerShare: cashMatch ? parseFloat(cashMatch[1]) : 0,
      stockDividendPer1000: stockMatch ? parseFloat(stockMatch[1]) : 0,
    };
    dividendCache[key] = { data: result, timestamp: now };
    return result;
  } catch (e) {
    console.error('TWSE TWT49UDetail 查詢失敗:', e.message);
    return null;
  }
}

function calcSharesOnDate(txs, targetDate) {
  let shares = 0;
  for (const t of txs) {
    if (t.date > targetDate) break;
    if (t.type === 'buy') shares += t.shares;
    else shares -= t.shares;
  }
  return shares;
}

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const delay = ms => new Promise(r => setTimeout(r, ms));

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = new URL(request.url);
    const yearParam = searchParams.get('year') ? parseInt(searchParams.get('year'), 10) : null;
    if (yearParam !== null && (!Number.isInteger(yearParam) || yearParam < 2010 || yearParam > 2099)) {
      return NextResponse.json({ error: 'year 參數必須為 2010-2099' }, { status: 400 });
    }

    const stocks = queryAll('SELECT * FROM stocks WHERE user_id = ?', [auth.userId]);
    if (stocks.length === 0) return NextResponse.json({ synced: 0, skipped: 0, errors: [] });

    const symbolSet = new Set(stocks.map(s => s.symbol));
    const stockHoldingPeriods = {};
    stocks.forEach(s => {
      const txs = queryAll(
        'SELECT * FROM stock_transactions WHERE stock_id = ? AND user_id = ? ORDER BY date, created_at',
        [s.id, auth.userId]
      );
      if (txs.length === 0) return;
      const periods = [];
      let shares = 0, periodStart = null;
      txs.forEach(t => {
        if (t.type === 'buy') {
          if (shares === 0) periodStart = t.date;
          shares += t.shares;
        } else {
          shares -= t.shares;
          if (shares <= 0) {
            if (periodStart) periods.push({ start: periodStart, end: t.date });
            shares = 0; periodStart = null;
          }
        }
      });
      if (shares > 0 && periodStart) periods.push({ start: periodStart, end: null });
      if (periods.length > 0) stockHoldingPeriods[s.symbol] = { stock: s, txs, periods };
    });

    if (Object.keys(stockHoldingPeriods).length === 0) {
      return NextResponse.json({ synced: 0, skipped: 0, errors: [], message: '尚無交易紀錄' });
    }

    const today = todayStr();
    let minYear, maxYear;
    if (yearParam !== null) {
      minYear = yearParam; maxYear = yearParam;
    } else {
      minYear = parseInt(today.slice(0, 4)); maxYear = minYear;
      Object.values(stockHoldingPeriods).forEach(({ periods }) => {
        periods.forEach(p => {
          const sy = parseInt(p.start.slice(0, 4));
          if (sy < minYear) minYear = sy;
          if (p.end) {
            const ey = parseInt(p.end.slice(0, 4));
            if (ey > maxYear) maxYear = ey;
          }
        });
      });
      maxYear = Math.min(maxYear, parseInt(today.slice(0, 4)));
    }

    let allDividends = [];
    for (let y = minYear; y <= maxYear; y++) {
      const sd = `${y}0101`;
      const ed = (y === maxYear) ? today.replace(/-/g, '') : `${y}1231`;
      const divs = await fetchTwseDividendList(sd, ed);
      allDividends = allDividends.concat(divs);
      if (y < maxYear) await delay(2000);
    }

    const relevantDivs = allDividends.filter(d => symbolSet.has(d.symbol));
    const seenKeys = new Set();
    const uniqueDivs = relevantDivs.filter(d => {
      const key = d.detailKey || `${d.symbol},${d.date}`;
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    const db = getDB();
    let synced = 0, skipped = 0;
    const errors = [];

    for (const div of uniqueDivs) {
      const holding = stockHoldingPeriods[div.symbol];
      if (!holding) { skipped++; continue; }
      const stock = holding.stock;

      const inHoldingPeriod = holding.periods.some(p => {
        const afterStart = div.date >= p.start;
        const beforeEnd = p.end === null || div.date <= p.end;
        return afterStart && beforeEnd;
      });
      if (!inHoldingPeriod) { skipped++; continue; }

      const divMonth = div.date.slice(0, 7);
      const existing = queryOne(
        "SELECT id FROM stock_dividends WHERE user_id = ? AND stock_id = ? AND (date = ? OR (date LIKE ? AND note LIKE '%TWSE自動同步%'))",
        [auth.userId, stock.id, div.date, divMonth + '%']
      );
      if (existing) { skipped++; continue; }

      const sharesHeld = calcSharesOnDate(holding.txs, div.date);
      if (sharesHeld <= 0) { skipped++; continue; }

      let cashPerShare = 0, stockPer1000 = 0;
      if (div.type === '息') {
        cashPerShare = div.valuePerShare;
      } else {
        const dateStr8 = div.date.replace(/-/g, '');
        await delay(500);
        const detail = await fetchTwseDividendDetail(div.symbol, dateStr8);
        if (detail) {
          cashPerShare = detail.cashDividendPerShare;
          stockPer1000 = detail.stockDividendPer1000;
        } else {
          if (div.type === '權') { skipped++; errors.push(`${div.symbol} ${div.date} 無法取得除權明細`); continue; }
          cashPerShare = div.valuePerShare;
        }
      }

      const cashDividend = Math.round(sharesHeld * cashPerShare);
      const stockDividendShares = stockPer1000 > 0 ? Math.round(sharesHeld * stockPer1000 / 1000 * 100) / 100 : 0;
      if (cashDividend === 0 && stockDividendShares === 0) { skipped++; continue; }

      const divId = uid();
      const divNote = `TWSE自動同步（每股$${cashPerShare}${stockPer1000 > 0 ? `, 每千股配${stockPer1000}股` : ''}）`;
      db.run(
        'INSERT INTO stock_dividends (id, user_id, stock_id, date, cash_dividend, stock_dividend_shares, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [divId, auth.userId, stock.id, div.date, cashDividend, stockDividendShares, divNote, Date.now()]
      );
      if (stockDividendShares > 0) {
        const synthNote = `[SYNTH] 股票股利配發 | ${divNote}`;
        db.run(
          'INSERT INTO stock_transactions (id,user_id,stock_id,date,type,shares,price,fee,tax,account_id,note,created_at,tax_auto_calculated) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)',
          [uid(), auth.userId, stock.id, div.date, 'buy', stockDividendShares, 0, 0, 0, null, synthNote, Date.now(), 1]
        );
      }
      synced++;
    }

    if (synced > 0) saveDB();
    return NextResponse.json({ synced, skipped, errors: errors.slice(0, 10) });
  } catch (e) {
    console.error('股利同步失敗:', e.message);
    return NextResponse.json({ error: '同步失敗：' + e.message }, { status: 500 });
  }
}
