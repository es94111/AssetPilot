import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../../lib/db';
import { normalizeDate } from '../../../../lib/accountHelpers';
import { uid } from '../../../../lib/userDefaults';
import { writeOperationAudit, makeTxHash, isValidIso8601Date } from '../../../../lib/auditHelpers';
import { getRequestIpFromHeaders } from '../../../../lib/loginHelpers';

const CSV_IMPORT_MAX_ROWS = 20000;
const HASH_SEP = '\x01';

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
  const { rows, autoCreate } = body;
  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ error: '無有效資料' }, { status: 400 });
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

  const updateProgress = (processed, phase) => {
    const cur = importProgress.get(auth.userId);
    if (cur) importProgress.set(auth.userId, { ...cur, processed, phase });
  };

  let imported = 0;
  let skipped = 0;
  const errors = [];
  const warnings = [];
  const createdCats = [];
  const createdAccs = [];
  const unknownColumnsSet = new Set();
  const KNOWN_COLUMNS = new Set(['date', 'type', 'category', 'amount', 'account', 'note']);
  let txStarted = false;
  let failureStage = null;

  const ipAddress = getRequestIpFromHeaders(request.headers);
  const userAgent = request.headers.get('user-agent') || '';
  const userRow = queryOne('SELECT is_admin FROM users WHERE id = ?', [auth.userId]);
  const userRole = userRow?.is_admin ? 'admin' : 'user';

  try {
    if (rows.length > 0 && rows[0] && typeof rows[0] === 'object') {
      Object.keys(rows[0]).forEach(k => {
        if (!KNOWN_COLUMNS.has(k)) unknownColumnsSet.add(k);
      });
    }
    if (unknownColumnsSet.size > 0) {
      console.log(JSON.stringify({ event: 'csv_unknown_columns', userId: auth.userId, action: 'import_transactions', columns: [...unknownColumnsSet] }));
    }

    updateProgress(0, 'validating');

    const categories = queryAll('SELECT * FROM categories WHERE user_id = ?', [auth.userId]);
    const accounts = queryAll('SELECT * FROM accounts WHERE user_id = ?', [auth.userId]);
    const catMap = {};
    categories.forEach(c => {
      if (c.parent_id) {
        const parent = categories.find(p => p.id === c.parent_id);
        if (parent) catMap[parent.name + ' > ' + c.name] = c;
      }
      if (!catMap[c.name]) catMap[c.name] = c;
    });
    const accMap = {};
    accounts.forEach(a => { accMap[a.name] = a; });

    const existingTx = queryAll(
      'SELECT date, type, category_id, amount, account_id, note FROM transactions WHERE user_id = ?',
      [auth.userId]
    );
    const existingHashes = new Set();
    existingTx.forEach(t => {
      existingHashes.add(makeTxHash(t.date, t.type, t.category_id, t.amount, t.account_id, t.note));
    });
    const batchHashes = new Set();

    const db = getDB();
    db.run('BEGIN');
    txStarted = true;
    failureStage = 'auto_create';

    if (autoCreate) {
      const maxOrder = queryOne('SELECT COALESCE(MAX(sort_order),0) as m FROM categories WHERE user_id = ?', [auth.userId])?.m || 0;
      let orderCounter = maxOrder;
      const defaultColors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
      let colorIdx = 0;
      rows.forEach(row => {
        const { type, category, account } = row;
        let dbType = 'expense';
        if (type === '收入') dbType = 'income';
        else if (type === '轉出' || type === '轉入') dbType = null;
        else if (type === '支出') dbType = 'expense';
        if (dbType && category && !catMap[category]) {
          const catId = uid();
          orderCounter++;
          const color = defaultColors[colorIdx % defaultColors.length];
          colorIdx++;
          db.run('INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order) VALUES (?,?,?,?,?,0,?)',
            [catId, auth.userId, category, dbType, color, orderCounter]);
          catMap[category] = { id: catId, name: category, type: dbType };
          createdCats.push(category);
        }
        if (account && !accMap[account]) {
          const accId = uid();
          db.run("INSERT INTO accounts (id, user_id, name, initial_balance, icon, currency) VALUES (?,?,?,0,'fa-wallet','TWD')",
            [accId, auth.userId, account]);
          accMap[account] = { id: accId, name: account };
          createdAccs.push(account);
        }
      });
    }

    failureStage = 'writing';
    updateProgress(0, 'writing');

    const now = Date.now();
    const parsedRows = [];
    rows.forEach((row, idx) => {
      const { date: rawDate, type, category, amount, account, note } = row;
      const date = (typeof rawDate === 'string' && isValidIso8601Date(rawDate)) ? rawDate : normalizeDate(rawDate);
      const amt = parseFloat(amount);
      if (!date || !isValidIso8601Date(date)) {
        errors.push({ row: idx + 2, reason: '日期格式必須為 YYYY-MM-DD' });
        skipped++;
        return;
      }
      if (!Number.isFinite(amt) || amt <= 0) {
        errors.push({ row: idx + 2, reason: '金額無效' });
        skipped++;
        return;
      }
      let dbType = 'expense';
      if (type === '收入') dbType = 'income';
      else if (type === '轉出') dbType = 'transfer_out';
      else if (type === '轉入') dbType = 'transfer_in';
      else if (type === '支出') dbType = 'expense';
      else {
        errors.push({ row: idx + 2, reason: `未知類型「${type}」` });
        skipped++;
        return;
      }
      let catId = '';
      if (dbType !== 'transfer_out' && dbType !== 'transfer_in') {
        const cat = catMap[category];
        if (cat) catId = cat.id;
      }
      let accId = '';
      const acc = accMap[account];
      if (acc) accId = acc.id;
      const noteStr = note || '';
      const h = makeTxHash(date, dbType, catId, amt, accId, noteStr);
      if (existingHashes.has(h) || batchHashes.has(h)) {
        skipped++;
        return;
      }
      batchHashes.add(h);
      parsedRows.push({ idx, dbType, date, amt, catId, accId, note: noteStr });
    });

    updateProgress(0, 'pairing');
    const groupMap = new Map();
    parsedRows.forEach(p => {
      if (p.dbType === 'transfer_out' || p.dbType === 'transfer_in') {
        const key = `${p.date}|${p.amt}`;
        if (!groupMap.has(key)) groupMap.set(key, { outs: [], ins: [] });
        const grp = groupMap.get(key);
        const txId = uid();
        p.txId = txId;
        if (p.dbType === 'transfer_out') grp.outs.push({ idx: p.idx, txId });
        else grp.ins.push({ idx: p.idx, txId });
      } else {
        p.txId = uid();
      }
    });
    const linkedIdMap = new Map();
    groupMap.forEach(grp => {
      const pairs = Math.min(grp.outs.length, grp.ins.length);
      for (let i = 0; i < pairs; i++) {
        linkedIdMap.set(grp.outs[i].txId, grp.ins[i].txId);
        linkedIdMap.set(grp.ins[i].txId, grp.outs[i].txId);
      }
      for (let i = pairs; i < grp.outs.length; i++) {
        warnings.push({ row: grp.outs[i].idx + 2, type: 'unpaired_transfer', reason: '未找到對應轉入' });
      }
      for (let i = pairs; i < grp.ins.length; i++) {
        warnings.push({ row: grp.ins[i].idx + 2, type: 'unpaired_transfer', reason: '未找到對應轉出' });
      }
    });

    updateProgress(0, 'writing');
    parsedRows.forEach((p, i) => {
      const linked = linkedIdMap.get(p.txId) || '';
      db.run(
        'INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,date,category_id,account_id,note,linked_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [p.txId, auth.userId, p.dbType, p.amt, 'TWD', p.amt, 1, p.date, p.catId, p.accId, p.note, linked, now, now]
      );
      imported++;
      if ((i + 1) % 500 === 0) updateProgress(i + 1, 'writing');
    });

    failureStage = 'finalizing';
    updateProgress(parsedRows.length, 'finalizing');
    db.run('COMMIT');
    saveDB();

    const completedEntry = importProgress.get(auth.userId) || {};
    importProgress.set(auth.userId, { ...completedEntry, processed: parsedRows.length, phase: 'finalizing', completedAt: Date.now() });
    setTimeout(() => importProgress.delete(auth.userId), 5000);

    writeOperationAudit({
      userId: auth.userId, role: userRole, action: 'import_transactions',
      ipAddress, userAgent, result: 'success', isAdminOperation: false,
      metadata: { rows: rows.length, imported, skipped, errors: errors.length, warnings: warnings.length, unknown_columns: [...unknownColumnsSet] },
    });

    return NextResponse.json({
      imported, skipped,
      errors: errors.slice(0, 50),
      warnings,
      created: { categories: createdCats, accounts: createdAccs },
      unknownColumns: [...unknownColumnsSet],
    });
  } catch (e) {
    if (txStarted) { try { getDB().run('ROLLBACK'); } catch (_) {} }
    importProgress.set(auth.userId, { processed: 0, total: rows.length, phase: 'finalizing', startedAt: Date.now(), completedAt: Date.now() });
    setTimeout(() => importProgress.delete(auth.userId), 5000);
    writeOperationAudit({
      userId: auth.userId, role: userRole, action: 'import_transactions',
      ipAddress, userAgent, result: 'failed', isAdminOperation: false,
      metadata: { rows: rows.length, failure_stage: failureStage || 'unknown', failure_reason: String(e?.message || e).slice(0, 200) },
    });
    return NextResponse.json({ error: '匯入失敗', message: String(e?.message || e), failedAt: failureStage || 'unknown' }, { status: 500 });
  } finally {
    releaseImportLock(auth.userId);
  }
}
