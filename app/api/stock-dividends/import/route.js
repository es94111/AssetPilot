import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../../lib/db';
import { uid } from '../../../../lib/userDefaults';
import { normalizeDate } from '../../../../lib/accountHelpers';
import { writeOperationAudit, isValidIso8601Date } from '../../../../lib/auditHelpers';
import { getRequestIpFromHeaders } from '../../../../lib/loginHelpers';
import { makeDividendHash } from '../../../../lib/stockHelpers';
import { inferStockType } from '../../../../lib/twseFetchNext';

const CSV_IMPORT_MAX_ROWS = 20000;

export const importLocks = new Set();
export const importProgress = new Map();

function acquireImportLock(userId) {
  if (importLocks.has(userId)) return false;
  importLocks.add(userId);
  return true;
}

function releaseImportLock(userId) {
  importLocks.delete(userId);
}

export async function POST(request) {
  const auth = requireAuth(request);
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
  let txStarted = false;
  let failureStage = null;
  const db = getDB();

  try {
    failureStage = 'validating';
    const existing = queryAll(
      `SELECT sd.date, sd.cash_dividend, sd.stock_dividend_shares, s.symbol
       FROM stock_dividends sd JOIN stocks s ON sd.stock_id = s.id WHERE sd.user_id = ?`,
      [auth.userId]
    );
    const existingHashes = new Set();
    existing.forEach(d => {
      existingHashes.add(makeDividendHash(d.date, d.symbol, d.cash_dividend, d.stock_dividend_shares));
    });
    const batchHashes = new Set();

    const securityAccounts = queryAll(
      "SELECT id, name FROM accounts WHERE user_id = ? AND (account_type = 'securities' OR icon = 'fa-chart-line' OR LOWER(name) LIKE '%證券%')",
      [auth.userId]
    );

    db.run('BEGIN');
    txStarted = true;
    failureStage = 'writing';

    rows.forEach((row, idx) => {
      const { date: rawDate, symbol, name: stockName, cashDividend, stockDividend, accountName, note } = row;
      if (!rawDate || !symbol) {
        errors.push({ row: idx + 2, reason: `略過不完整資料（${symbol || '?'}）` });
        skipped++; return;
      }
      const date = isValidIso8601Date(rawDate) ? rawDate : normalizeDate(rawDate);
      if (!date || !isValidIso8601Date(date)) {
        errors.push({ row: idx + 2, reason: '日期格式必須為 YYYY-MM-DD' });
        skipped++; return;
      }
      const cash = parseFloat(cashDividend || 0);
      const stock_d = parseFloat(stockDividend || 0);
      if (!cash && !stock_d) {
        errors.push({ row: idx + 2, reason: `現金股利與股票股利至少填一項（${symbol} ${date}）` });
        skipped++; return;
      }
      if (cash > 0 && !accountName) {
        errors.push({ row: idx + 2, reason: '現金股利 > 0 時必填帳戶' });
        skipped++; return;
      }

      let stock = queryOne('SELECT * FROM stocks WHERE user_id = ? AND symbol = ?', [auth.userId, symbol]);
      if (!stock) {
        const sid = uid();
        const inferredType = inferStockType(symbol);
        const fallbackName = (stockName && String(stockName).trim()) || '（未命名）';
        db.run(
          'INSERT INTO stocks (id, user_id, symbol, name, current_price, stock_type, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [sid, auth.userId, symbol, fallbackName, 0, inferredType, new Date().toISOString()]
        );
        stock = queryOne('SELECT * FROM stocks WHERE id = ?', [sid]);
      } else if (stock.name === symbol && stockName && stockName !== symbol) {
        db.run('UPDATE stocks SET name = ? WHERE id = ?', [stockName, stock.id]);
      }

      const h = makeDividendHash(date, symbol, cash, stock_d);
      if (existingHashes.has(h) || batchHashes.has(h)) { skipped++; return; }
      batchHashes.add(h);

      let accountId = '';
      if (accountName) {
        const acc = queryOne('SELECT id FROM accounts WHERE user_id = ? AND name = ?', [auth.userId, accountName]);
        if (acc) accountId = acc.id;
      }

      if (stock_d > 0) {
        let synthAccountId = accountId;
        if (!synthAccountId) {
          const lastBuy = queryOne(
            "SELECT account_id FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND type = 'buy' AND account_id IS NOT NULL AND account_id != '' ORDER BY date DESC LIMIT 1",
            [auth.userId, stock.id]
          );
          if (lastBuy && lastBuy.account_id) {
            synthAccountId = lastBuy.account_id;
          } else if (securityAccounts.length === 1) {
            synthAccountId = securityAccounts[0].id;
          } else if (securityAccounts.length > 1) {
            errors.push({ row: idx + 2, reason: '純股票股利合成交易無法判定所屬帳戶，請於 CSV 帳戶欄位明示' });
            skipped++;
            return;
          }
        }
        const synthNote = '[SYNTH] 股票股利配發 ' + (note || '');
        db.run(
          'INSERT INTO stock_transactions (id, user_id, stock_id, type, date, shares, price, fee, tax, account_id, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [uid(), auth.userId, stock.id, 'buy', date, stock_d, 0, 0, 0, synthAccountId || '', synthNote, Date.now()]
        );
      }

      db.run(
        'INSERT INTO stock_dividends (id, user_id, stock_id, date, cash_dividend, stock_dividend_shares, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [uid(), auth.userId, stock.id, date, cash, stock_d, note || '', Date.now()]
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
      action: 'import_stock_dividends',
      ipAddress: getRequestIpFromHeaders(request.headers) || '',
      userAgent: request.headers.get('user-agent') || '',
      result: 'success',
      isAdminOperation: false,
      metadata: { rows: rows.length, imported, skipped, errors: errors.length, warnings: 0 },
    });

    return NextResponse.json({ imported, skipped, errors: errors.slice(0, 50), warnings: [] });
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
      action: 'import_stock_dividends',
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
