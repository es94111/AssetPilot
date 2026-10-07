import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { queryAll, queryAllInKeysetPages, queryOne } from '../../../../lib/db';
import { buildCsv, writeOperationAudit } from '../../../../lib/auditHelpers';
import { getRequestIpFromHeaders } from '../../../../lib/loginHelpers';
import {
  createXlsxExportResponse,
  mapXlsxRows,
  resolveExportFormat,
  type XlsxColumn,
} from '../../../../lib/xlsxExport';

export const runtime = 'nodejs';

interface AccountExportRow {
  name: string | null;
  category: string | null;
  account_type: string | null;
  initial_balance: number | string | null;
  currency: string | null;
  icon: string | null;
  exclude_from_total: number | string | null;
  linked_bank_id: string | null;
  linked_bank_name: string | null;
  overseas_fee_rate: number | string | null;
  note: string | null;
  created_at: string | number | null;
  updated_at: string | number | null;
}

type CsvCell = string | number;

function asRows<T>(rows: Array<Record<string, string | number | null>>): T[] {
  return rows as unknown as T[];
}

function accountExportCells(r: AccountExportRow): CsvCell[] {
  return [
    r.name || '', r.category || '', r.account_type || '', r.initial_balance || 0,
    r.currency || 'TWD', r.icon || 'fa-wallet', Number(r.exclude_from_total) ? '是' : '否',
    r.linked_bank_name || '', r.overseas_fee_rate ?? '', r.note || '', r.created_at || '', r.updated_at || '',
  ];
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const format = resolveExportFormat(searchParams.get('format'));

  try {
    const baseSql = `SELECT a.name, a.category, a.account_type, a.initial_balance, a.currency, a.icon,
      a.exclude_from_total, a.linked_bank_id, linked.name AS linked_bank_name,
      a.overseas_fee_rate, a.note, a.created_at, a.updated_at,
      COALESCE(a.sort_order, 0) AS export_cursor_sort_order,
      COALESCE(a.created_at, '') AS export_cursor_created_at, a.id AS export_cursor_id
      FROM accounts a
      LEFT JOIN accounts linked ON linked.id = a.linked_bank_id AND linked.user_id = a.user_id
      WHERE a.user_id = ?`;
    const sql = `${baseSql} ORDER BY a.sort_order ASC, a.created_at ASC, a.name ASC`;
    const params = [auth.userId];

    const headers = ['帳戶名稱', '類別', '帳戶類型', '初始餘額', '幣別', '圖示', '排除總資產', '連結銀行帳戶', '海外手續費率', '備註', '建立時間', '更新時間'];
    const userRow = queryOne('SELECT is_admin FROM users WHERE id = ?', [auth.actorUserId]);
    const ipAddress = getRequestIpFromHeaders(request.headers);
    const userAgent = request.headers.get('user-agent') || '';
    const role = userRow?.is_admin ? 'admin' : 'user';

    if (format === 'xlsx') {
      const columns: XlsxColumn[] = [
        { header: '帳戶名稱', type: 'text' },
        { header: '類別', type: 'text' },
        { header: '帳戶類型', type: 'text' },
        { header: '初始餘額', type: 'number' },
        { header: '幣別', type: 'text' },
        { header: '圖示', type: 'text' },
        { header: '排除總資產', type: 'text' },
        { header: '連結銀行帳戶', type: 'text' },
        { header: '海外手續費率', type: 'number', format: '0.0000' },
        { header: '備註', type: 'text' },
        { header: '建立時間', type: 'date' },
        { header: '更新時間', type: 'datetime' },
      ];
      return createXlsxExportResponse({
        columns,
        rows: mapXlsxRows(
          queryAllInKeysetPages(
            baseSql,
            params,
            {
              cursorColumns: ['COALESCE(a.sort_order, 0)', "COALESCE(a.created_at, '')", 'a.name', 'a.id'],
              orderBy: ['COALESCE(a.sort_order, 0)', "COALESCE(a.created_at, '')", 'a.name', 'a.id'],
              direction: 'ASC',
              cursorFromRow: (row) => [row.export_cursor_sort_order, row.export_cursor_created_at, row.name, row.export_cursor_id],
            },
          ),
          (row) => accountExportCells(row as unknown as AccountExportRow),
        ),
        filenamePrefix: 'accounts',
        audit: { userId: auth.userId, role, action: 'export_accounts', ipAddress, userAgent },
      });
    }

    const rows = asRows<AccountExportRow>(queryAll(sql, params));
    const dataRows = rows.map(accountExportCells);
    const csv = buildCsv(headers, dataRows);
    const filename = `accounts-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;
    writeOperationAudit({
      userId: auth.userId,
      role,
      action: 'export_accounts',
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
    console.error('export_accounts failed', e);
    return NextResponse.json({ error: '匯出失敗', message: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
