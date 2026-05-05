'use strict';

const { getDB, queryOne, queryAll, saveDB } = require('./db');
const { normalizeCurrency, convertToTwd } = require('./accountHelpers');
const { uid } = require('./userDefaults');
const userTime = require('./userTime');

function getNextRecurringDate(prevIsoDate, freq) {
  const m = String(prevIsoDate).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (freq === 'daily') {
    const dt = new Date(Date.UTC(y, mo - 1, d));
    dt.setUTCDate(dt.getUTCDate() + 1);
    return dt.toISOString().slice(0, 10);
  }
  if (freq === 'weekly') {
    const dt = new Date(Date.UTC(y, mo - 1, d));
    dt.setUTCDate(dt.getUTCDate() + 7);
    return dt.toISOString().slice(0, 10);
  }
  if (freq === 'monthly') {
    let nm = mo + 1, ny = y;
    if (nm > 12) { nm = 1; ny = y + 1; }
    const lastDay = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
    const day = Math.min(d, lastDay);
    return `${ny}-${String(nm).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  if (freq === 'yearly') {
    const ny = y + 1;
    if (mo === 2 && d === 29) {
      const isLeap = (ny % 4 === 0 && ny % 100 !== 0) || (ny % 400 === 0);
      const day = isLeap ? 29 : 28;
      return `${ny}-02-${String(day).padStart(2, '0')}`;
    }
    return `${ny}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}

function processOneRecurring(r, userId, userTimezone) {
  const db = getDB();
  if (r.category_id) {
    const cat = queryOne('SELECT id FROM categories WHERE id = ? AND user_id = ?', [r.category_id, userId]);
    if (!cat) {
      db.run('UPDATE recurring SET needs_attention = 1, updated_at = ? WHERE id = ?', [Date.now(), r.id]);
      return 0;
    }
  }
  if (r.account_id) {
    const acct = queryOne('SELECT id FROM accounts WHERE id = ? AND user_id = ?', [r.account_id, userId]);
    if (!acct) {
      db.run('UPDATE recurring SET needs_attention = 1, updated_at = ? WHERE id = ?', [Date.now(), r.id]);
      return 0;
    }
  }

  const todayS = userTime.todayInUserTz(userTimezone || 'Asia/Taipei');
  let lastGenerated = r.last_generated;
  let scheduledDate = lastGenerated ? getNextRecurringDate(lastGenerated, r.frequency) : r.start_date;
  let count = 0;

  while (scheduledDate && scheduledDate <= todayS) {
    const now = Date.now();
    const rCurrency = normalizeCurrency(r.currency || 'TWD');
    const rFxRate = String(r.fx_rate || '1');
    const rFxRateNum = Number(rFxRate) > 0 ? Number(rFxRate) : 1;
    const rOriginalAmount = rCurrency === 'TWD'
      ? r.amount
      : Math.round((r.amount / rFxRateNum) * 10000) / 10000;
    const twdAmount = r.amount;

    try {
      db.run(
        `INSERT INTO transactions
         (id, user_id, type, amount, original_amount, currency, fx_rate, fx_fee, twd_amount,
          date, category_id, account_id, note, exclude_from_stats, linked_id,
          source_recurring_id, scheduled_date, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          uid(), userId, r.type,
          r.amount, rOriginalAmount, rCurrency, rFxRate, 0, twdAmount,
          scheduledDate, r.category_id || null, r.account_id || null,
          (r.note || '') + ' (自動)', 0, '',
          r.id, scheduledDate,
          now, now,
        ]
      );
      db.run(
        'UPDATE recurring SET last_generated = ?, updated_at = ? WHERE id = ? AND (last_generated IS NULL OR last_generated < ?)',
        [scheduledDate, now, r.id, scheduledDate]
      );
      count++;
    } catch (e) {
      if (/UNIQUE constraint failed/i.test(String(e?.message || e))) {
        db.run(
          'UPDATE recurring SET last_generated = ?, updated_at = ? WHERE id = ? AND (last_generated IS NULL OR last_generated < ?)',
          [scheduledDate, now, r.id, scheduledDate]
        );
      } else {
        console.error('[004-recurring] INSERT failed for', r.id, scheduledDate, e);
        throw e;
      }
    }

    lastGenerated = scheduledDate;
    scheduledDate = getNextRecurringDate(lastGenerated, r.frequency);
  }

  return count;
}

function processRecurringForUser(userId, opts = {}) {
  const maxSync = opts.maxSync != null ? opts.maxSync : 30;
  let generated = 0;
  let bgScheduled = false;

  const userRow = queryOne('SELECT timezone FROM users WHERE id = ?', [userId]);
  const userTimezone = (userRow && userRow.timezone) || 'Asia/Taipei';

  const recs = queryAll(
    'SELECT * FROM recurring WHERE user_id = ? AND is_active = 1 AND needs_attention = 0',
    [userId]
  );

  for (const r of recs) {
    if (generated >= maxSync) {
      if (!bgScheduled) {
        bgScheduled = true;
        setImmediate(() => {
          try { processRecurringForUser(userId, { maxSync: Infinity }); }
          catch (e) { console.error('[004-recurring] bg resume failed for', userId, e); }
        });
      }
      break;
    }
    try {
      generated += processOneRecurring(r, userId, userTimezone);
    } catch (e) {
      console.error('[004-recurring] processOneRecurring failed for', r.id, e);
    }
  }

  if (generated > 0) saveDB();
  return generated;
}

module.exports = { getNextRecurringDate, processOneRecurring, processRecurringForUser };
