import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../../lib/db';
import { uid } from '../../../../lib/userDefaults';
import { writeOperationAudit } from '../../../../lib/auditHelpers';
import { getRequestIpFromHeaders } from '../../../../lib/loginHelpers';
import { importLocks, importProgress } from '@/lib/transactionImportState';

const CSV_IMPORT_MAX_ROWS = 20000;

type CategoryType = 'income' | 'expense';
type CategoryImportRow = Record<string, unknown>;
type CategoryImportFailureStage = 'validating' | 'writing' | 'finalizing';

interface ImportCategoriesRequest {
  rows?: CategoryImportRow[];
}

interface ImportError {
  row: number;
  reason: string;
}

interface CategoryLookupRow {
  id: string;
  name: string;
  type: CategoryType | string;
  color: string | null;
  parent_id?: string | null;
}

interface ParsedCategoryImportRow {
  idx: number;
  type: CategoryType;
  name: string;
  parent: string;
  color: string;
}

function asRows<T>(rows: Array<Record<string, string | number | null>>): T[] {
  return rows as unknown as T[];
}

function asRow<T>(row: Record<string, string | number | null> | null): T | null {
  return row as unknown as T | null;
}

function isValidHexColor(s: unknown): s is string {
  return typeof s === 'string' && /^#[0-9A-Fa-f]{6}$/.test(s);
}

function cell(row: CategoryImportRow, ...keys: string[]): unknown {
  for (const key of keys) {
    if (row[key] != null && row[key] !== '') return row[key];
  }
  return '';
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

  const body = await request.json().catch(() => ({})) as ImportCategoriesRequest;
  const { rows } = body;
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

  let imported = 0;
  let skipped = 0;
  const errors: ImportError[] = [];
  let txStarted = false;
  let failureStage: CategoryImportFailureStage | null = null;

  const ipAddress = getRequestIpFromHeaders(request.headers);
  const userAgent = request.headers.get('user-agent') || '';
  const userRow = queryOne('SELECT is_admin FROM users WHERE id = ?', [auth.userId]);
  const userRole = userRow?.is_admin ? 'admin' : 'user';

  try {
    failureStage = 'validating';
    const existing = asRows<CategoryLookupRow>(queryAll('SELECT * FROM categories WHERE user_id = ?', [auth.userId]));
    const existingByKey = new Map<string, CategoryLookupRow>();
    existing.forEach(c => existingByKey.set(`${c.type}|${c.name}`, c));

    const parentRows: ParsedCategoryImportRow[] = [];
    const childRows: ParsedCategoryImportRow[] = [];
    rows.forEach((r, idx) => {
      const rawType = cell(r, 'type', '類型');
      const type: CategoryType | null = rawType === '收入' || rawType === 'income' ? 'income' : (rawType === '支出' || rawType === 'expense' ? 'expense' : null);
      const name = String(cell(r, 'name', '分類名稱')).trim();
      const parent = String(cell(r, 'parent', '上層分類')).trim();
      const color = String(cell(r, 'color', '顏色') || '');
      if (!type) { errors.push({ row: idx + 2, reason: `未知類型「${rawType}」` }); skipped++; return; }
      if (!name) { errors.push({ row: idx + 2, reason: '分類名稱為空' }); skipped++; return; }
      if (color && !isValidHexColor(color)) { errors.push({ row: idx + 2, reason: '顏色格式必須為 #RRGGBB' }); skipped++; return; }
      const item = { idx, type, name, parent, color: color || '#6366f1' };
      if (parent) childRows.push(item);
      else parentRows.push(item);
    });

    const db = getDB();
    db.run('BEGIN');
    txStarted = true;
    failureStage = 'writing';

    const maxOrder = Number(asRow<{ m: number }>(queryOne('SELECT COALESCE(MAX(sort_order),0) AS m FROM categories WHERE user_id = ?', [auth.userId]))?.m) || 0;
    let orderCounter = maxOrder;

    parentRows.forEach((p, i) => {
      const key = `${p.type}|${p.name}`;
      if (existingByKey.has(key)) { skipped++; return; }
      const id = uid();
      orderCounter++;
      db.run('INSERT INTO categories (id, user_id, name, type, color, is_default, sort_order) VALUES (?,?,?,?,?,0,?)',
        [id, auth.userId, p.name, p.type, p.color, orderCounter]);
      existingByKey.set(key, { id, name: p.name, type: p.type, color: p.color });
      imported++;
      if ((i + 1) % 500 === 0) {
        const cur = importProgress.get(auth.userId);
        if (cur) importProgress.set(auth.userId, { ...cur, processed: i + 1, phase: 'writing' });
      }
    });

    childRows.forEach(c => {
      const key = `${c.type}|${c.name}`;
      if (existingByKey.has(key)) { skipped++; return; }
      const parentKey = `${c.type}|${c.parent}`;
      const parent = existingByKey.get(parentKey);
      if (!parent) {
        errors.push({ row: c.idx + 2, reason: `找不到上層分類「${c.parent}」` });
        skipped++;
        return;
      }
      const id = uid();
      orderCounter++;
      db.run('INSERT INTO categories (id, user_id, name, type, color, parent_id, is_default, sort_order) VALUES (?,?,?,?,?,?,0,?)',
        [id, auth.userId, c.name, c.type, c.color, parent.id, orderCounter]);
      existingByKey.set(key, { id, name: c.name, type: c.type, color: c.color });
      imported++;
    });

    failureStage = 'finalizing';
    db.run('COMMIT');
    saveDB();

    const completedEntry = importProgress.get(auth.userId) || {};
    importProgress.set(auth.userId, { ...completedEntry, processed: rows.length, phase: 'finalizing', completedAt: Date.now() });
    setTimeout(() => importProgress.delete(auth.userId), 5000);

    writeOperationAudit({
      userId: auth.userId, role: userRole, action: 'import_categories',
      ipAddress, userAgent, result: 'success', isAdminOperation: false,
      metadata: { rows: rows.length, imported, skipped, errors: errors.length, warnings: 0 },
    });

    return NextResponse.json({ imported, skipped, errors: errors.slice(0, 50), warnings: [] });
  } catch (e) {
    if (txStarted) { try { getDB().run('ROLLBACK'); } catch (_) {} }
    importProgress.set(auth.userId, { processed: 0, total: rows.length, phase: 'finalizing', startedAt: Date.now(), completedAt: Date.now() });
    setTimeout(() => importProgress.delete(auth.userId), 5000);
    writeOperationAudit({
      userId: auth.userId, role: userRole, action: 'import_categories',
      ipAddress, userAgent, result: 'failed', isAdminOperation: false,
      metadata: { rows: rows.length, failure_stage: failureStage || 'unknown', failure_reason: String(e instanceof Error ? e.message : e).slice(0, 200) },
    });
    return NextResponse.json({ error: '匯入失敗', message: String(e instanceof Error ? e.message : e), failedAt: failureStage || 'unknown' }, { status: 500 });
  } finally {
    releaseImportLock(auth.userId);
  }
}
