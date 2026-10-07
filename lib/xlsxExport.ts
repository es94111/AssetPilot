// lib/xlsxExport.ts — Excel (.xlsx) 匯出共用工具（issue #261）
//
// 與既有純伺服端 CSV 匯出並存：CSV 仍走 lib/auditHelpers.buildCsv，本模組只負責
// xlsx 分支。設計要點：
//   1. 欄位標題、日期與數字型別正確（金額為真正的數值欄位，另以 numFmt 控制顯示）。
//   2. 沿用既有 Formula Injection 防護：以 `=`、`+`、`-`、`@` 開頭的文字儲存格
//      前置 `'`，並指定文字格式（`@`）讓 Excel 不以公式／日期／數字重新解讀。
//   3. 產生結果以 Node Readable 串流回傳，避免一次把整份檔案放進記憶體或字串。
import writeXlsxFile from 'write-excel-file/node';
import type { Cell, SheetData } from 'write-excel-file/node';
import { Readable } from 'node:stream';
import { writeOperationAudit } from './auditHelpers';

/**
 * 欄位型別：
 * - `date`：以 UTC 午夜寫入，Excel 日期序列值不隨伺服器時區漂移。
 * - `number`：真正的數值欄位（金額、股數、匯率等）。
 * - `text`：文字；公式開頭值會前置 `'` 並套用文字格式。
 */
export type XlsxColumnType = 'date' | 'number' | 'text';

export interface XlsxColumn {
  header: string;
  type: XlsxColumnType;
  /** 顯示格式（numFmt）。未指定時用型別預設值。 */
  format?: string;
  /** 欄寬（字元數）。 */
  width?: number;
}

export type XlsxRow = ReadonlyArray<unknown>;

const DEFAULT_FORMATS: Record<XlsxColumnType, string> = {
  date: 'yyyy-mm-dd',
  number: '#,##0.00',
  text: '@',
};

const DEFAULT_WIDTHS: Record<XlsxColumnType, number> = {
  date: 12,
  number: 14,
  text: 16,
};

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const FORMULA_PREFIX_RE = /^[=+\-@]/;

/**
 * Formula Injection 防護，與 lib/auditHelpers.ts 的 CSV 版一致：以 `=`、`+`、`-`、`@`
 * 開頭的文字前置 `'`。xlsx 版本另外把儲存格宣告為文字格式（`@`），
 * 雙重確保 Excel 不會把內容當成公式執行。
 */
export function escapeFormulaText(value: string): string {
  return FORMULA_PREFIX_RE.test(value) ? `'${value}` : value;
}

/**
 * 把 `YYYY-MM-DD` 轉成 UTC 午夜的 Date。
 * 直接 `new Date('2026-08-14')` 已解析為 UTC 午夜，但明確組出可避免非 ISO 字串
 * 被當成本地時間解析而產生時區位移。無法解析時回傳 null（呼叫端視為空值）。
 */
export function parseDateOnly(value: unknown): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== 'string') return null;
  const m = DATE_ONLY_RE.exec(value.trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  // 擋掉 2026-02-30 這類會被 Date 自動進位的無效日期。
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return date;
}

/** 數值正規化：null／空字串／NaN 一律視為空值，其餘轉為 Number。 */
export function toNumeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function toText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function buildCell(value: unknown, column: XlsxColumn): Cell | null {
  const format = column.format ?? DEFAULT_FORMATS[column.type];

  if (column.type === 'date') {
    const parsed = parseDateOnly(value);
    return parsed ? { value: parsed, type: Date, format } : null;
  }

  if (column.type === 'number') {
    const parsed = toNumeric(value);
    return parsed === null ? null : { value: parsed, type: Number, format };
  }

  const text = escapeFormulaText(toText(value));
  return text === '' ? null : { value: text, type: String, format };
}

/** 依欄位定義把二維資料轉成 write-excel-file 的 sheet data（第一列為標題）。 */
export function buildSheetData(columns: readonly XlsxColumn[], rows: readonly XlsxRow[]): SheetData {
  const header: Cell[] = columns.map((column) => ({
    value: column.header,
    type: String,
    fontWeight: 'bold',
  }));
  const body: SheetData = rows.map((row) => columns.map((column, index) => buildCell(row[index], column)));
  return [header, ...body];
}

export interface XlsxSheetOptions {
  /** 工作表名稱（Excel 上限 31 字元，且不可含 `[]:*?/\\`）。 */
  sheetName: string;
  columns: readonly XlsxColumn[];
  rows: readonly XlsxRow[];
}

// Excel 工作表名稱限制：31 字元上限 + 禁用字元；超長或含禁用字元會被 Excel 判定檔案毀損。
const SHEET_NAME_INVALID_RE = /[[\]:*?/\\]/g;

export function sanitizeSheetName(name: string): string {
  const cleaned = name.replace(SHEET_NAME_INVALID_RE, ' ').trim();
  const safe = cleaned || 'Sheet1';
  return safe.length > 31 ? safe.slice(0, 31) : safe;
}

function columnWidths(columns: readonly XlsxColumn[]): Array<{ width: number }> {
  return columns.map((column) => ({
    width: column.width ?? Math.max(DEFAULT_WIDTHS[column.type], column.header.length + 2),
  }));
}

function createWorkbook(options: XlsxSheetOptions) {
  return writeXlsxFile(buildSheetData(options.columns, options.rows), {
    sheet: sanitizeSheetName(options.sheetName),
    columns: columnWidths(options.columns),
    // 標題列凍結，方便在 Excel 中捲動瀏覽大量資料。
    stickyRowsCount: 1,
  });
}

/**
 * 產生 .xlsx 的 Node Readable 串流。資料量大時壓縮與寫入皆為串流處理，
 * 不會一次組出完整檔案內容。
 */
export async function createXlsxStream(options: XlsxSheetOptions): Promise<Readable> {
  // toStream 的型別宣告為「可帶 writable 參數」的聯合型別；不帶參數時必定回傳 Readable。
  return (createWorkbook(options).toStream as () => Promise<Readable>)();
}

/** 產生 .xlsx 的完整位元組（測試與小量輸出用；路由請用 createXlsxStream）。 */
export async function buildXlsxBuffer(options: XlsxSheetOptions): Promise<Buffer> {
  return createWorkbook(options).toBuffer();
}

/** 匯出檔名：`<prefix>-YYYYMMDD.xlsx`。 */
export function xlsxFilename(prefix: string, now: Date = new Date()): string {
  return `${prefix}-${now.toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
}

/** 由 URL 的 `format` 參數決定匯出格式；僅接受 `xlsx`，其餘（含未提供）一律視為 CSV。 */
export function resolveExportFormat(rawFormat: string | null): 'csv' | 'xlsx' {
  return rawFormat === 'xlsx' ? 'xlsx' : 'csv';
}

export const XLSX_CONTENT_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface XlsxExportArgs {
  /** 工作表名稱。 */
  sheetName: string;
  columns: readonly XlsxColumn[];
  rows: readonly XlsxRow[];
  /** 檔名不含副檔名的前綴，例如 `transactions` → transactions-20261007.xlsx。 */
  filenamePrefix: string;
  audit: {
    userId: string;
    role: string;
    action: string;
    ipAddress: string;
    userAgent: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

/**
 * 產生 xlsx 下載回應並寫入匯出稽核。五個匯出端點共用，確保 CSV／XLSX 兩條路徑的
 * 稽核動作名稱、角色與日期範圍等欄位口徑一致。
 */
export async function createXlsxExportResponse(args: XlsxExportArgs): Promise<Response> {
  const filename = xlsxFilename(args.filenamePrefix);
  const stream = await createXlsxStream({
    sheetName: args.sheetName,
    columns: args.columns,
    rows: args.rows,
  });

  writeOperationAudit({
    userId: args.audit.userId,
    role: args.audit.role,
    action: args.audit.action,
    ipAddress: args.audit.ipAddress,
    userAgent: args.audit.userAgent,
    result: 'success',
    isAdminOperation: false,
    metadata: {
      rows: args.rows.length,
      filename,
      dateFrom: args.audit.dateFrom,
      dateTo: args.audit.dateTo,
      format: 'xlsx',
    },
  });

  return new Response(stream as unknown as ReadableStream, {
    headers: {
      'Content-Type': XLSX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
