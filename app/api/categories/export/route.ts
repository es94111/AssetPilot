import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { queryAll, queryOne } from '../../../../lib/db';
import { buildCsv, writeOperationAudit } from '../../../../lib/auditHelpers';
import { getRequestIpFromHeaders } from '../../../../lib/loginHelpers';
import {
  createXlsxExportResponse,
  resolveExportFormat,
  type XlsxColumn,
} from '../../../../lib/xlsxExport';

export const runtime = 'nodejs';

type CategoryType = 'income' | 'expense';

interface CategoryExportRow {
  id: string;
  name: string | null;
  type: CategoryType | string | null;
  color: string | null;
  parent_id: string | null;
}

type CsvCell = string | number;

function asRows<T>(rows: Array<Record<string, string | number | null>>): T[] {
  return rows as unknown as T[];
}

function normalizeHexColor(c: unknown): string {
  if (!c || typeof c !== 'string') return '';
  if (/^#[0-9A-Fa-f]{6}$/.test(c)) return c.toUpperCase();
  if (/^#[0-9A-Fa-f]{3}$/.test(c)) {
    return ('#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3]).toUpperCase();
  }
  return c;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const format = resolveExportFormat(searchParams.get('format'));

  try {
    const cats = asRows<CategoryExportRow>(queryAll(
      "SELECT * FROM categories WHERE user_id = ? ORDER BY (parent_id IS NULL OR parent_id = '') DESC, sort_order ASC, name ASC",
      [auth.userId]
    ));
    const idMap: Record<string, CategoryExportRow> = {};
    cats.forEach(c => { idMap[c.id] = c; });
    const parents = cats.filter(c => !c.parent_id);
    const children = cats.filter(c => c.parent_id);
    const headers = ['類型', '分類名稱', '上層分類', '顏色'];
    const dataRows: CsvCell[][] = [];
    parents.forEach(p => {
      dataRows.push([p.type === 'income' ? '收入' : '支出', p.name || '', '', normalizeHexColor(p.color || '')]);
    });
    children.forEach(c => {
      const parent = idMap[c.parent_id || ''];
      dataRows.push([c.type === 'income' ? '收入' : '支出', c.name || '', parent?.name || '', normalizeHexColor(c.color || '')]);
    });

    const userRow = queryOne('SELECT is_admin FROM users WHERE id = ?', [auth.actorUserId]);
    const ipAddress = getRequestIpFromHeaders(request.headers);
    const userAgent = request.headers.get('user-agent') || '';
    const role = userRow?.is_admin ? 'admin' : 'user';

    if (format === 'xlsx') {
      const columns: XlsxColumn[] = [
        { header: '類型', type: 'text' },
        { header: '分類名稱', type: 'text' },
        { header: '上層分類', type: 'text' },
        { header: '顏色', type: 'text' },
      ];
      return createXlsxExportResponse({
        columns,
        rows: dataRows,
        rowCount: dataRows.length,
        filenamePrefix: 'categories',
        audit: { userId: auth.userId, role, action: 'export_categories', ipAddress, userAgent },
      });
    }

    const csv = buildCsv(headers, dataRows);
    const filename = `categories-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;

    writeOperationAudit({
      userId: auth.userId,
      role,
      action: 'export_categories',
      ipAddress,
      userAgent,
      result: 'success',
      isAdminOperation: false,
      metadata: { rows: dataRows.length, byteSize: Buffer.byteLength(csv, 'utf8'), format: 'csv' },
    });

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error('export_categories failed', e);
    return NextResponse.json({ error: '匯出失敗', message: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
