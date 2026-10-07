import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { queryAll, queryAllInKeysetPages, queryOne } from '../../../../lib/db';
import { buildCsv, writeOperationAudit, isValidIso8601Date } from '../../../../lib/auditHelpers';
import { getRequestIpFromHeaders } from '../../../../lib/loginHelpers';
import {
  createXlsxExportResponse,
  mapXlsxRows,
  resolveExportFormat,
  type XlsxColumn,
} from '../../../../lib/xlsxExport';

export const runtime = 'nodejs';

type TransactionExportType = 'income' | 'expense' | 'transfer_out' | 'transfer_in';

interface TransactionExportRow {
  date: string | null;
  type: TransactionExportType | string | null;
  amount: number | string | null;
  currency: string | null;
  original_amount: number | string | null;
  fx_rate: string | number | null;
  twd_amount: number | string | null;
  fx_fee: number | string | null;
  exclude_from_stats: number | string | null;
  tags: string | null;
  note: string | null;
  cat_name: string | null;
  cat_parent_id: string | null;
  parent_cat_name: string | null;
  account_name: string | null;
  transfer_to_account_name: string | null;
}

type CsvCell = string | number | null;

function asRows<T>(rows: Array<Record<string, string | number | null>>): T[] {
  return rows as unknown as T[];
}

function txTypeToChinese(t: string | null) {
  if (t === 'income') return '收入';
  if (t === 'expense') return '支出';
  if (t === 'transfer_out') return '轉出';
  if (t === 'transfer_in') return '轉入';
  return t || '';
}

function transactionExportCells(r: TransactionExportRow): CsvCell[] {
  let category = '';
  if (r.cat_name) {
    category = r.parent_cat_name ? (r.parent_cat_name + ' > ' + r.cat_name) : r.cat_name;
  }
  return [
    r.date || '', txTypeToChinese(r.type), category, r.amount,
    r.currency || 'TWD', r.original_amount || r.amount || '', r.fx_rate || '1',
    r.twd_amount || '', r.fx_fee || 0, r.account_name || '', r.transfer_to_account_name || '',
    Number(r.exclude_from_stats) ? '是' : '否', r.tags || '[]', r.note || '',
  ];
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const dateFrom = searchParams.get('dateFrom') || '';
  const dateTo = searchParams.get('dateTo') || '';
  const format = resolveExportFormat(searchParams.get('format'));

  try {
    let where = 'WHERE t.user_id = ?';
    const params = [auth.userId];
    if (dateFrom && isValidIso8601Date(dateFrom)) { where += ' AND t.date >= ?'; params.push(dateFrom); }
    if (dateTo && isValidIso8601Date(dateTo)) { where += ' AND t.date <= ?'; params.push(dateTo); }

    const baseSql = `SELECT t.date, t.type, t.amount, t.currency, t.original_amount, t.fx_rate,
      t.twd_amount, t.fx_fee, t.exclude_from_stats, t.tags, t.note,
      c.name AS cat_name, c.parent_id AS cat_parent_id,
      pc.name AS parent_cat_name,
      a.name AS account_name,
      ta.name AS transfer_to_account_name,
      COALESCE(t.created_at, 0) AS export_cursor_created_at, t.id AS export_cursor_id
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN categories pc ON c.parent_id = pc.id
      LEFT JOIN accounts a ON t.account_id = a.id
      LEFT JOIN accounts ta ON t.transfer_to_account_id = ta.id
      ${where}`;
    const orderBy = 't.date DESC, COALESCE(t.created_at, 0) DESC, t.id DESC';
    const sql = `${baseSql} ORDER BY t.date DESC, t.created_at DESC`;
    const headers = ['日期', '類型', '分類', '金額', '幣別', '原始金額', '匯率', '台幣金額', '匯兌手續費', '帳戶', '轉入帳戶', '排除統計', '標籤', '備註'];

    const userRow = queryOne('SELECT is_admin FROM users WHERE id = ?', [auth.actorUserId]);
    const ipAddress = getRequestIpFromHeaders(request.headers);
    const userAgent = request.headers.get('user-agent') || '';
    const role = userRow?.is_admin ? 'admin' : 'user';

    if (format === 'xlsx') {
      const columns: XlsxColumn[] = [
        { header: '日期', type: 'date' },
        { header: '類型', type: 'text' },
        { header: '分類', type: 'text' },
        { header: '金額', type: 'number' },
        { header: '幣別', type: 'text' },
        { header: '原始金額', type: 'number' },
        { header: '匯率', type: 'number', format: '0.000000' },
        { header: '台幣金額', type: 'number' },
        { header: '匯兌手續費', type: 'number' },
        { header: '帳戶', type: 'text' },
        { header: '轉入帳戶', type: 'text' },
        { header: '排除統計', type: 'text' },
        { header: '標籤', type: 'text' },
        { header: '備註', type: 'text' },
      ];
      return createXlsxExportResponse({
        columns,
        rows: mapXlsxRows(
          queryAllInKeysetPages(
            baseSql,
            params,
            {
              cursorColumns: ['t.date', 'COALESCE(t.created_at, 0)', 't.id'],
              orderBy: ['t.date', 'COALESCE(t.created_at, 0)', 't.id'],
              direction: 'DESC',
              cursorFromRow: (row) => [row.date, row.export_cursor_created_at, row.export_cursor_id],
            },
          ) as AsyncIterable<TransactionExportRow>,
          transactionExportCells,
        ),
        filenamePrefix: 'transactions',
        audit: { userId: auth.userId, role, action: 'export_transactions', ipAddress, userAgent, dateFrom, dateTo },
      });
    }

    const rows = asRows<TransactionExportRow>(queryAll(sql, params));
    const dataRows = rows.map(transactionExportCells);
    const csv = buildCsv(headers, dataRows);
    const filename = `transactions-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;

    writeOperationAudit({
      userId: auth.userId,
      role,
      action: 'export_transactions',
      ipAddress,
      userAgent,
      result: 'success',
      isAdminOperation: false,
      metadata: { rows: dataRows.length, byteSize: Buffer.byteLength(csv, 'utf8'), dateFrom, dateTo, format: 'csv' },
    });

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error('export_transactions failed', e);
    return NextResponse.json({ error: '匯出失敗', message: String(e instanceof Error ? e.message : e) }, { status: 500 });
  }
}
