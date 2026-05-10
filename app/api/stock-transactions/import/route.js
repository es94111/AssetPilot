import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../../lib/db';
import { uid } from '../../../../lib/userDefaults';
import { normalizeDate } from '../../../../lib/accountHelpers';
import { writeOperationAudit, isValidIso8601Date } from '../../../../lib/auditHelpers';
import { getRequestIpFromHeaders } from '../../../../lib/loginHelpers';
import { makeStockTxHash } from '../../../../lib/stockHelpers';
import { inferStockType } from '../../../../lib/twseFetchNext';

const CSV_IMPORT_MAX_ROWS = 20000;

const importLocks = new Set();
const importProgress = new Map();

function cell(row, ...keys) {
  for (const key of keys) {
    if (row[key] != null && row[key] !== '') return row[key];
  }
  return '';
}

function parseBool(value, fallback = true) {
  const s = String(value || '').trim().toLowerCase();
  if (!s) return fallback;
  return s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === '是';
}

function acquireImportLock(userId) {
  if (importLocks.has(userId)) return false;
  importLocks.add(userId);
  return true;
}

function releaseImportLock(userId) {
  importLocks.delete(userId);
}

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const { rows } = body;

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: '沒有資料' }, { status: 400 });
  }
  if (rows.length > CSV_IMPORT_MAX_ROWS) {
    return NextResponse.json({ error: `單次最多匯入 ${CSV_IMPORT_MAX_ROWS} 筆，請分批上傳` }, { status: 413 });
  }

  if (!acquireImportLock(auth.userId)) {
    return NextResponse.json({ error: 'IMPORT_IN_PROGRESS', message: '您已有匯入進行中，請稍候完成後再試' }, { status: 409 });
  }

  importProgress.set(auth.userId, {
    processed: 0, total: rows.length, phase: 'parsing',
    startedAt: Date.now(), completedAt: null,
  });

  let imported = 0;
  let skipped = 0;
  const errors = [];
  const warnings = [];
  let txStarted = false;
  let failureStage = null;
  const db = getDB();

  try {
    failureStage = 'validating';
    const existing = queryAll(
      `SELECT st.date, st.type, st.shares, st.price, st.account_id, s.symbol
       FROM stock_transactions st JOIN stocks s ON st.stock_id = s.id WHERE st.user_id = ?`,
      [auth.userId]
    );
    const existingHashes = new Set();
    existing.forEach(t => {
      existingHashes.add(makeStockTxHash(t.date, t.symbol, t.type, t.shares, t.price, t.account_id));
    });
    const batchHashes = new Set();

    db.run('BEGIN');
    txStarted = true;
    failureStage = 'writing';

    rows.forEach((row, idx) => {
      const rawDate = cell(row, 'date', '日期');
      const symbol = cell(row, 'symbol', '股票代號');
      const stockName = cell(row, 'name', '股票名稱');
      const stockType = cell(row, 'stockType', 'stock_type', '股票類型');
      const currency = cell(row, 'currency', '幣別') || 'TWD';
      const type = cell(row, 'type', '類型');
      const shares = cell(row, 'shares', '股數');
      const price = cell(row, 'price', '成交價');
      const fee = cell(row, 'fee', '手續費');
      const tax = cell(row, 'tax', '交易稅');
      const realizedPl = cell(row, 'realizedPl', 'realized_pl', '已實現損益');
      const taxAutoCalculated = cell(row, 'taxAutoCalculated', 'tax_auto_calculated', '稅額自動計算');
      const accountName = cell(row, 'accountName', '帳戶');
      const note = cell(row, 'note', '備註');
      if (!rawDate || !symbol || !type || !shares || !price) {
        errors.push({ row: idx + 2, reason: `略過不完整資料（${symbol || '?'}）` });
        skipped++; return;
      }
      const date = isValidIso8601Date(rawDate) ? rawDate : normalizeDate(rawDate);
      if (!date || !isValidIso8601Date(date)) {
        errors.push({ row: idx + 2, reason: '日期格式必須為 YYYY-MM-DD' });
        skipped++; return;
      }
      const shareNum = parseFloat(shares);
      if (!(shareNum > 0) || !Number.isInteger(shareNum)) {
        errors.push({ row: idx + 2, reason: `股數必須為正整數（${symbol}）` });
        skipped++; return;
      }
      const priceNum = parseFloat(price);
      if (!(priceNum > 0)) {
        errors.push({ row: idx + 2, reason: '成交價必須為正數' });
        skipped++; return;
      }

      let stock = queryOne('SELECT * FROM stocks WHERE user_id = ? AND symbol = ?', [auth.userId, symbol]);
      if (!stock) {
        const sid = uid();
        const inferredType = stockType || inferStockType(symbol);
        const fallbackName = (stockName && String(stockName).trim()) || '（未命名）';
        db.run(
          'INSERT INTO stocks (id, user_id, symbol, name, current_price, stock_type, currency, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [sid, auth.userId, symbol, fallbackName, priceNum, inferredType, currency, new Date().toISOString()]
        );
        stock = queryOne('SELECT * FROM stocks WHERE id = ?', [sid]);
      } else if (stock.name === symbol && stockName && stockName !== symbol) {
        db.run('UPDATE stocks SET name = ? WHERE id = ?', [stockName, stock.id]);
      }

      let accountId = '';
      if (accountName) {
        const acc = queryOne('SELECT id FROM accounts WHERE user_id = ? AND name = ?', [auth.userId, accountName]);
        if (acc) accountId = acc.id;
      }

      const txType = (type === '買進' || type === 'buy') ? 'buy' : 'sell';
      const h = makeStockTxHash(date, symbol, txType, shareNum, priceNum, accountId);
      if (existingHashes.has(h) || batchHashes.has(h)) { skipped++; return; }
      batchHashes.add(h);

      db.run(
        'INSERT INTO stock_transactions (id, user_id, stock_id, type, date, shares, price, fee, tax, account_id, note, created_at, realized_pl, tax_auto_calculated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [uid(), auth.userId, stock.id, txType, date, shareNum, priceNum,
         parseFloat(fee || 0), parseFloat(tax || 0), accountId, note || '', Date.now(),
         parseFloat(realizedPl || 0), parseBool(taxAutoCalculated, true) ? 1 : 0]
      );
      imported++;

      if ((idx + 1) % 500 === 0) {
        const cur = importProgress.get(auth.userId);
        if (cur) importProgress.set(auth.userId, { ...cur, processed: idx + 1, phase: 'writing' });
      }
    });

    failureStage = 'finalizing';
    db.run('COMMIT');
    saveDB();

    const completedEntry = importProgress.get(auth.userId) || {};
    importProgress.set(auth.userId, { ...completedEntry, processed: rows.length, phase: 'finalizing', completedAt: Date.now() });
    setTimeout(() => importProgress.delete(auth.userId), 5000);

    writeOperationAudit({
      userId: auth.userId,
      role: 'user',
      action: 'import_stock_transactions',
      ipAddress: getRequestIpFromHeaders(request.headers) || '',
      userAgent: request.headers.get('user-agent') || '',
      result: 'success',
      isAdminOperation: false,
      metadata: { rows: rows.length, imported, skipped, errors: errors.length, warnings: warnings.length },
    });

    return NextResponse.json({ imported, skipped, errors: errors.slice(0, 50), warnings });
  } catch (e) {
    if (txStarted) { try { db.run('ROLLBACK'); } catch (_) { /* noop */ } }
    importProgress.set(auth.userId, {
      processed: 0, total: rows.length, phase: 'finalizing',
      startedAt: Date.now(), completedAt: Date.now(),
    });
    setTimeout(() => importProgress.delete(auth.userId), 5000);

    writeOperationAudit({
      userId: auth.userId,
      role: 'user',
      action: 'import_stock_transactions',
      ipAddress: getRequestIpFromHeaders(request.headers) || '',
      userAgent: request.headers.get('user-agent') || '',
      result: 'failed',
      isAdminOperation: false,
      metadata: { rows: rows.length, failure_stage: failureStage || 'unknown', failure_reason: String(e?.message || e).slice(0, 200) },
    });

    return NextResponse.json(
      { error: '匯入失敗', message: String(e?.message || e), failedAt: failureStage || 'unknown' },
      { status: 500 }
    );
  } finally {
    releaseImportLock(auth.userId);
  }
}
