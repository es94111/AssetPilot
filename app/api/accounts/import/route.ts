import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../../lib/db';
import { normalizeCurrency, normalizeAccountIcon, categoryFromAccountType, accountTypeFromCategory } from '../../../../lib/accountHelpers';
import { uid, todayStr } from '../../../../lib/userDefaults';
import { writeOperationAudit } from '../../../../lib/auditHelpers';
import { getRequestIpFromHeaders } from '../../../../lib/loginHelpers';
import { importLocks, importProgress } from '@/lib/transactionImportState';

const CSV_IMPORT_MAX_ROWS = 20000;

type AccountImportRow = Record<string, unknown>;
type AccountImportFailureStage = 'validating' | 'writing' | 'finalizing';

interface ImportAccountsRequest {
  rows?: AccountImportRow[];
}

interface ImportError {
  row: number;
  reason: string;
}

interface AccountLookupRow {
  id: string;
  name: string;
}

interface ParsedAccountImportRow {
  idx: number;
  name: string;
  category: string;
  accountType: string;
  initialBalance: number;
  currency: string;
  icon: string;
  excludeFromTotal: boolean;
  linkedBankName: string;
  overseasFeeRate: number | null;
  note: string;
}

function asRows<T>(rows: Array<Record<string, string | number | null>>): T[] {
  return rows as unknown as T[];
}

function acquireImportLock(userId: string): boolean {
  if (importLocks.has(userId)) return false;
  importLocks.add(userId);
  return true;
}

function releaseImportLock(userId: string): void {
  importLocks.delete(userId);
}

function cell(row: AccountImportRow, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] != null && row[key] !== '') return row[key];
  }
  return '';
}

function parseBool(value: unknown): boolean {
  const s = String(value || '').trim().toLowerCase();
  return s === '1' || s === 'true' || s === 'yes' || s === 'y' || s === '是';
}

function normalizeImportedCategory(value: unknown, accountType: string): string {
  const s = String(value || '').trim();
  if (['bank', 'credit_card', 'cash', 'virtual_wallet'].includes(s)) return s;
  if (s === '銀行') return 'bank';
  if (s === '信用卡') return 'credit_card';
  if (s === '現金') return 'cash';
  if (s === '電子錢包' || s === '虛擬錢包' || s === '虛擬') return 'virtual_wallet';
  return categoryFromAccountType(accountType || 'checking');
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({})) as ImportAccountsRequest;
  const { rows } = body;
  if (!Array.isArray(rows) || rows.length === 0) return NextResponse.json({ error: '無有效資料' }, { status: 400 });
  if (rows.length > CSV_IMPORT_MAX_ROWS) return NextResponse.json({ error: `單次最多匯入 ${CSV_IMPORT_MAX_ROWS} 筆，請分批上傳` }, { status: 413 });
  if (!acquireImportLock(auth.userId)) {
    return NextResponse.json({ error: 'IMPORT_IN_PROGRESS', message: '您已有匯入進行中，請稍候完成後再試' }, { status: 409 });
  }

  importProgress.set(auth.userId, { processed: 0, total: rows.length, phase: 'parsing', startedAt: Date.now(), completedAt: null });

  let imported = 0;
  let skipped = 0;
  const errors: ImportError[] = [];
  let txStarted = false;
  let failureStage: AccountImportFailureStage | null = null;
  const ipAddress = getRequestIpFromHeaders(request.headers);
  const userAgent = request.headers.get('user-agent') || '';
  const userRow = queryOne('SELECT is_admin FROM users WHERE id = ?', [auth.userId]);
  const userRole = userRow?.is_admin ? 'admin' : 'user';

  try {
    failureStage = 'validating';
    const existing = asRows<AccountLookupRow>(queryAll('SELECT id, name FROM accounts WHERE user_id = ?', [auth.userId]));
    const byName = new Map(existing.map(a => [String(a.name), a]));
    const parsed: ParsedAccountImportRow[] = [];
    rows.forEach((row, idx) => {
      const name = String(cell(row, 'name', '帳戶名稱')).trim();
      if (!name) { errors.push({ row: idx + 2, reason: '帳戶名稱為空' }); skipped++; return; }
      if (byName.has(name)) { skipped++; return; }
      const rawCategory = String(cell(row, 'category', '類別')).trim();
      const rawAccountType = String(cell(row, 'accountType', 'account_type', '帳戶類型')).trim();
      const category = normalizeImportedCategory(rawCategory, rawAccountType);
      const accountType = rawAccountType || accountTypeFromCategory(category);
      const initialBalance = Number(cell(row, 'initialBalance', 'initial_balance', '初始餘額') || 0);
      const overseasRaw = cell(row, 'overseasFeeRate', 'overseas_fee_rate', '海外手續費率');
      parsed.push({
        idx,
        name,
        category,
        accountType,
        initialBalance: Number.isFinite(initialBalance) ? initialBalance : 0,
        currency: normalizeCurrency(String(cell(row, 'currency', '幣別') || 'TWD')),
        icon: normalizeAccountIcon(String(cell(row, 'icon', '圖示') || 'fa-wallet')),
        excludeFromTotal: parseBool(cell(row, 'excludeFromTotal', 'exclude_from_total', '排除總資產')),
        linkedBankName: String(cell(row, 'linkedBankName', 'linked_bank_name', '連結銀行帳戶')).trim(),
        overseasFeeRate: overseasRaw === '' ? null : Number(overseasRaw),
        note: String(cell(row, 'note', '備註') || ''),
      });
    });

    const db = getDB();
    db.run('BEGIN');
    txStarted = true;
    failureStage = 'writing';

    parsed.forEach((a, i) => {
      const linked = a.linkedBankName ? byName.get(a.linkedBankName) : null;
      const id = uid();
      const nowMs = Date.now();
      db.run(
        'INSERT INTO accounts (id, user_id, name, category, account_type, initial_balance, currency, icon, exclude_from_total, linked_bank_id, overseas_fee_rate, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [id, auth.userId, a.name, a.category, a.accountType, a.initialBalance, a.currency, a.icon, a.excludeFromTotal ? 1 : 0, linked?.id || '', a.overseasFeeRate, a.note, todayStr(), nowMs]
      );
      byName.set(a.name, { id, name: a.name });
      imported++;
      if ((i + 1) % 500 === 0) {
        const cur = importProgress.get(auth.userId);
        if (cur) importProgress.set(auth.userId, { ...cur, processed: i + 1, phase: 'writing' });
      }
    });

    failureStage = 'finalizing';
    db.run('COMMIT');
    saveDB();
    const completedEntry = importProgress.get(auth.userId) || {};
    importProgress.set(auth.userId, { ...completedEntry, processed: rows.length, phase: 'finalizing', completedAt: Date.now() });
    setTimeout(() => importProgress.delete(auth.userId), 5000);

    writeOperationAudit({
      userId: auth.userId, role: userRole, action: 'import_accounts',
      ipAddress, userAgent, result: 'success', isAdminOperation: false,
      metadata: { rows: rows.length, imported, skipped, errors: errors.length, warnings: 0 },
    });
    return NextResponse.json({ imported, skipped, errors: errors.slice(0, 50), warnings: [] });
  } catch (e) {
    if (txStarted) { try { getDB().run('ROLLBACK'); } catch (_) {} }
    importProgress.set(auth.userId, { processed: 0, total: rows.length, phase: 'finalizing', startedAt: Date.now(), completedAt: Date.now() });
    setTimeout(() => importProgress.delete(auth.userId), 5000);
    writeOperationAudit({
      userId: auth.userId, role: userRole, action: 'import_accounts',
      ipAddress, userAgent, result: 'failed', isAdminOperation: false,
      metadata: { rows: rows.length, failure_stage: failureStage || 'unknown', failure_reason: String(e instanceof Error ? e.message : e).slice(0, 200) },
    });
    return NextResponse.json({ error: '匯入失敗', message: String(e instanceof Error ? e.message : e), failedAt: failureStage || 'unknown' }, { status: 500 });
  } finally {
    releaseImportLock(auth.userId);
  }
}
