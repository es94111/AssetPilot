import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../../lib/db';
import { normalizeDate } from '../../../../lib/accountHelpers';
import { uid } from '../../../../lib/userDefaults';
import { writeOperationAudit, makeTxHash, isValidIso8601Date } from '../../../../lib/auditHelpers';
import { getRequestIpFromHeaders } from '../../../../lib/loginHelpers';

const CSV_IMPORT_MAX_ROWS = 20000;
const HASH_SEP = '\x01';

import { importLocks, importProgress } from '@/lib/transactionImportState';

type ImportPhase = 'parsing' | 'validating' | 'auto_create' | 'writing' | 'pairing' | 'finalizing';
type TransactionType = 'income' | 'expense' | 'transfer_out' | 'transfer_in';
type ImportTransactionRow = Record<string, unknown>;

interface ImportTransactionsRequest {
  rows?: ImportTransactionRow[];
  autoCreate?: boolean;
}

interface ImportError {
  row: number;
  reason: string;
}

interface ImportWarning extends ImportError {
  type: string;
}

interface TransactionImportResult {
  imported: number;
  skipped: number;
  errors: ImportError[];
  warnings: ImportWarning[];
  created: { categories: string[]; accounts: string[] };
  unknownColumns: string[];
}

interface CategoryLookupRow {
  id: string;
  name: string;
  type: string;
  parent_id?: string | null;
}

interface AccountLookupRow {
  id: string;
  name: string;
}

interface ExistingTransactionRow {
  date: string;
  type: string;
  category_id: string | null;
  amount: number | string;
  account_id: string | null;
  note: string | null;
}

interface ParsedTransactionImportRow {
  idx: number;
  dbType: TransactionType;
  date: string;
  amt: number;
  catId: string;
  accId: string;
  note: string;
  currency: string;
  originalAmount: number;
  fxRate: string;
  twdAmount: number;
  fxFee: number;
  transferToAccountId: string;
  tags: string;
  excludeFromStats: 0 | 1;
  txId?: string;
}

interface TransferGroup {
  outs: Array<{ idx: number; txId: string }>;
  ins: Array<{ idx: number; txId: string }>;
}

function asRows<T>(rows: Array<Record<string, string | number | null>>): T[] {
  return rows as unknown as T[];
}

function asRow<T>(row: Record<string, string | number | null> | null): T | null {
  return row as unknown as T | null;
}

function cell(row: ImportTransactionRow, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] != null && row[key] !== '') return row[key];
  }
  return '';
}

function parseBool(value: unknown): boolean {
  const s = String(value || '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === '是';
}

function acquireImportLock(userId: string): boolean {
  if (importLocks.has(userId)) return false;
  importLocks.add(userId);
  return true;
}

function releaseImportLock(userId: string): void {
  importLocks.delete(userId);
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({})) as ImportTransactionsRequest;
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

  const updateProgress = (processed: number, phase: ImportPhase) => {
    const cur = importProgress.get(auth.userId);
    if (cur) importProgress.set(auth.userId, { ...cur, processed, phase });
  };

  let imported = 0;
  let skipped = 0;
  const errors: ImportError[] = [];
  const warnings: ImportWarning[] = [];
  const createdCats: string[] = [];
  const createdAccs: string[] = [];
  const unknownColumnsSet = new Set<string>();
  const KNOWN_COLUMNS = new Set(['date', 'type', 'category', 'amount', 'account', 'note']);
  let txStarted = false;
  let failureStage: ImportPhase | null = null;

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

    const categories = asRows<CategoryLookupRow>(queryAll('SELECT * FROM categories WHERE user_id = ?', [auth.userId]));
    const accounts = asRows<AccountLookupRow>(queryAll('SELECT * FROM accounts WHERE user_id = ?', [auth.userId]));
    const catMap: Record<string, CategoryLookupRow> = {};
    categories.forEach(c => {
      if (c.parent_id) {
        const parent = categories.find(p => p.id === c.parent_id);
        if (parent) catMap[String(parent.name) + ' > ' + String(c.name)] = c;
      }
      if (!catMap[String(c.name)]) catMap[String(c.name)] = c;
    });
    const accMap: Record<string, AccountLookupRow> = {};
    accounts.forEach(a => { accMap[String(a.name)] = a; });

    const existingTx = asRows<ExistingTransactionRow>(queryAll(
      'SELECT date, type, category_id, amount, account_id, note FROM transactions WHERE user_id = ?',
      [auth.userId]
    ));
    const existingHashes = new Set<string>();
    existingTx.forEach(t => {
      existingHashes.add(makeTxHash(t.date, t.type, t.category_id || '', t.amount, t.account_id || '', t.note || ''));
    });
    const batchHashes = new Set<string>();

    const db = getDB();
    db.run('BEGIN');
    txStarted = true;
    failureStage = 'auto_create';

    if (autoCreate) {
      const maxOrder = Number(asRow<{ m: number }>(queryOne('SELECT COALESCE(MAX(sort_order),0) as m FROM categories WHERE user_id = ?', [auth.userId]))?.m) || 0;
      let orderCounter = maxOrder;
      const defaultColors = ['#6366f1', '#f59e0b', '#10b981', '#ef4444', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
      let colorIdx = 0;
      rows.forEach(row => {
        const type = cell(row, 'type', '類型');
        const category = cell(row, 'category', '分類');
        const account = cell(row, 'account', '帳戶');
        const transferToAccount = cell(row, 'transferToAccount', 'transfer_to_account', '轉入帳戶');
        let dbType: 'income' | 'expense' | null = 'expense';
        if (type === '收入') dbType = 'income';
        else if (type === '轉出' || type === '轉入') dbType = null;
        else if (type === '支出') dbType = 'expense';
        const categoryName = String(category);
        if (dbType && category && !catMap[categoryName]) {
          const catId = uid();
          orderCounter++;
          const color = defaultColors[colorIdx % defaultColors.length];
          colorIdx++;
          db.run('INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order) VALUES (?,?,?,?,?,0,?)',
            [catId, auth.userId, categoryName, dbType, color, orderCounter]);
          catMap[categoryName] = { id: catId, name: categoryName, type: dbType };
          createdCats.push(categoryName);
        }
        const accountName = String(account);
        if (account && !accMap[accountName]) {
          const accId = uid();
          db.run("INSERT INTO accounts (id, user_id, name, initial_balance, icon, currency) VALUES (?,?,?,0,'fa-wallet','TWD')",
            [accId, auth.userId, accountName]);
          accMap[accountName] = { id: accId, name: accountName };
          createdAccs.push(accountName);
        }
        const transferAccountName = String(transferToAccount);
        if (transferToAccount && !accMap[transferAccountName]) {
          const accId = uid();
          db.run("INSERT INTO accounts (id, user_id, name, initial_balance, icon, currency) VALUES (?,?,?,0,'fa-wallet','TWD')",
            [accId, auth.userId, transferAccountName]);
          accMap[transferAccountName] = { id: accId, name: transferAccountName };
          createdAccs.push(transferAccountName);
        }
      });
    }

    failureStage = 'writing';
    updateProgress(0, 'writing');

    const now = Date.now();
    const parsedRows: ParsedTransactionImportRow[] = [];
    rows.forEach((row, idx) => {
      const rawDate = cell(row, 'date', '日期');
      const type = cell(row, 'type', '類型');
      const category = cell(row, 'category', '分類');
      const amount = cell(row, 'amount', '金額');
      const account = cell(row, 'account', '帳戶');
      const note = cell(row, 'note', '備註');
      const currency = String(cell(row, 'currency', '幣別') || 'TWD').trim() || 'TWD';
      const originalAmount = parseFloat(String(cell(row, 'originalAmount', 'original_amount', '原始金額') || amount));
      const fxRate = String(cell(row, 'fxRate', 'fx_rate', '匯率') || '1');
      const twdAmountRaw = cell(row, 'twdAmount', 'twd_amount', '台幣金額');
      const twdAmount = twdAmountRaw === '' ? 0 : parseFloat(String(twdAmountRaw));
      const fxFee = parseFloat(String(cell(row, 'fxFee', 'fx_fee', '匯兌手續費') || 0));
      const transferToAccount = cell(row, 'transferToAccount', 'transfer_to_account', '轉入帳戶');
      const tags = String(cell(row, 'tags', '標籤') || '[]');
      const excludeFromStats = parseBool(cell(row, 'excludeFromStats', 'exclude_from_stats', '排除統計'));
      const date = (typeof rawDate === 'string' && isValidIso8601Date(rawDate)) ? rawDate : normalizeDate(String(rawDate || ''));
      const amt = parseFloat(String(amount));
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
      let dbType: TransactionType = 'expense';
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
        const cat = catMap[String(category)];
        if (cat) catId = cat.id;
      }
      let accId = '';
      const acc = accMap[String(account)];
      if (acc) accId = acc.id;
      const noteStr = String(note || '');
      const h = makeTxHash(date, dbType, catId, amt, accId, noteStr);
      if (existingHashes.has(h) || batchHashes.has(h)) {
        skipped++;
        return;
      }
      batchHashes.add(h);
      let transferToAccountId = '';
      const toAcc = accMap[String(transferToAccount)];
      if (toAcc) transferToAccountId = toAcc.id;
      parsedRows.push({
        idx, dbType, date, amt, catId, accId, note: noteStr,
        currency, originalAmount: Number.isFinite(originalAmount) ? originalAmount : amt,
        fxRate, twdAmount: Number.isFinite(twdAmount) ? twdAmount : 0,
        fxFee: Number.isFinite(fxFee) ? fxFee : 0, transferToAccountId,
        tags, excludeFromStats: excludeFromStats ? 1 : 0,
      });
    });

    updateProgress(0, 'pairing');
    const groupMap = new Map<string, TransferGroup>();
    parsedRows.forEach(p => {
      if (p.dbType === 'transfer_out' || p.dbType === 'transfer_in') {
        const key = `${p.date}|${p.amt}`;
        if (!groupMap.has(key)) groupMap.set(key, { outs: [], ins: [] });
        const grp = groupMap.get(key)!;
        const txId = uid();
        p.txId = txId;
        if (p.dbType === 'transfer_out') grp.outs.push({ idx: p.idx, txId });
        else grp.ins.push({ idx: p.idx, txId });
      } else {
        p.txId = uid();
      }
    });
    const linkedIdMap = new Map<string, string>();
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
      const txId = p.txId || uid();
      const linked = linkedIdMap.get(p.txId || '') || '';
      db.run(
        'INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,fx_fee,twd_amount,date,category_id,account_id,note,linked_id,transfer_to_account_id,tags,exclude_from_stats,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [txId, auth.userId, p.dbType, p.amt, p.currency, p.originalAmount, p.fxRate, p.fxFee, p.twdAmount, p.date, p.catId, p.accId, p.note, linked, p.transferToAccountId, p.tags, p.excludeFromStats, now, now]
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

    const result: TransactionImportResult = {
      imported, skipped,
      errors: errors.slice(0, 50),
      warnings,
      created: { categories: createdCats, accounts: createdAccs },
      unknownColumns: [...unknownColumnsSet],
    };
    return NextResponse.json(result);
  } catch (e) {
    if (txStarted) { try { getDB().run('ROLLBACK'); } catch (_) {} }
    importProgress.set(auth.userId, { processed: 0, total: rows.length, phase: 'finalizing', startedAt: Date.now(), completedAt: Date.now() });
    setTimeout(() => importProgress.delete(auth.userId), 5000);
    writeOperationAudit({
      userId: auth.userId, role: userRole, action: 'import_transactions',
      ipAddress, userAgent, result: 'failed', isAdminOperation: false,
      metadata: { rows: rows.length, failure_stage: failureStage || 'unknown', failure_reason: String(e instanceof Error ? e.message : e).slice(0, 200) },
    });
    return NextResponse.json({ error: '匯入失敗', message: String(e instanceof Error ? e.message : e), failedAt: failureStage || 'unknown' }, { status: 500 });
  } finally {
    releaseImportLock(auth.userId);
  }
}
