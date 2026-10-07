// lib/xlsxExport.ts — Excel (.xlsx) 匯出共用工具（issue #261）
//
// CSV 仍走 lib/auditHelpers.buildCsv，本模組只負責 xlsx 分支。使用
// xlsx-stream-writer 的真正串流寫入器：每列轉成 XML 後直接送入 ZIP stream，
// 不先建立完整 sheet XML、cell matrix 或 XLSX Buffer。資料來源使用 sync iterable，
// 讓呼叫端可逐列轉換 DB 結果，而不再複製整份匯出資料。
import XlsxStreamWriter from 'xlsx-stream-writer';
import { writeOperationAudit } from './auditHelpers';

export type XlsxColumnType = 'date' | 'number' | 'text';

export interface XlsxColumn {
  header: string;
  type: XlsxColumnType;
  /** Excel 數字格式；未指定時使用型別預設值。 */
  format?: string;
}

export type XlsxRow = ReadonlyArray<unknown>;
export type XlsxRows = Iterable<XlsxRow> | AsyncIterable<XlsxRow>;

const DEFAULT_FORMATS: Record<XlsxColumnType, string> = {
  date: 'yyyy-mm-dd',
  number: '#,##0.00',
  text: '@',
};

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const FORMULA_PREFIX_RE = /^[=+\-@]/;

/** 以 `=`, `+`, `-`, `@` 開頭的文字前置撇號，與既有 CSV 防護一致。 */
export function escapeFormulaText(value: string): string {
  return FORMULA_PREFIX_RE.test(value) ? `'${value}` : value;
}

/** 把 YYYY-MM-DD 或 Date 轉成對應 UTC 日期的午夜，避免伺服器時區改變 Excel 日期序列。 */
export function parseDateOnly(value: unknown): Date | null {
  let year: number;
  let month: number;
  let day: number;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    year = value.getUTCFullYear();
    month = value.getUTCMonth() + 1;
    day = value.getUTCDate();
  } else if (typeof value === 'string') {
    const match = DATE_ONLY_RE.exec(value.trim());
    if (!match) return null;
    year = Number(match[1]);
    month = Number(match[2]);
    day = Number(match[3]);
  } else {
    return null;
  }

  // setUTCFullYear avoids Date.UTC's special treatment of years 0..99 as 1900..1999.
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) return null;
  return date;
}

export function toNumeric(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function cellValue(value: unknown, column: XlsxColumn): string | number | Date | null {
  if (column.type === 'date') return parseDateOnly(value);
  if (column.type === 'number') return toNumeric(value);
  if (value === null || value === undefined) return null;
  const text = escapeFormulaText(String(value));
  return text === '' ? null : text;
}

function* xlsxRowsSync(
  columns: readonly XlsxColumn[],
  rows: Iterable<XlsxRow>,
): Generator<XlsxStreamWriter.Row> {
  yield columns.map((column) => column.header);
  for (const row of rows) {
    yield columns.map((column, index) => cellValue(row[index], column));
  }
}

/** 第一列標題，其後逐列轉換；不累積所有資料列。 */
export async function* buildXlsxRows(
  columns: readonly XlsxColumn[],
  rows: XlsxRows,
): AsyncGenerator<XlsxStreamWriter.Row> {
  if (Symbol.asyncIterator in Object(rows)) {
    yield columns.map((column) => column.header);
    for await (const row of rows as AsyncIterable<XlsxRow>) {
      yield columns.map((column, index) => cellValue(row[index], column));
    }
    return;
  }
  yield* xlsxRowsSync(columns, rows as Iterable<XlsxRow>);
}

export function* mapXlsxRows<T>(
  rows: Iterable<T>,
  mapRow: (row: T) => XlsxRow,
): Generator<XlsxRow> {
  for (const row of rows) yield mapRow(row);
}

/** 測試用的有限資料 materializer；正式路由直接使用 buildXlsxRows 串流。 */
export function buildSheetData(columns: readonly XlsxColumn[], rows: readonly XlsxRow[]): XlsxStreamWriter.Row[] {
  return [...xlsxRowsSync(columns, rows)];
}

export interface XlsxSheetOptions {
  columns: readonly XlsxColumn[];
  rows: XlsxRows;
}

function createStyles(columns: readonly XlsxColumn[]) {
  const styles: Array<{ format: string }> = [];
  const styleIds = new Map<string, number>();
  const idForFormat = (format: string): number => {
    const existing = styleIds.get(format);
    if (existing !== undefined) return existing;
    const id = styles.length + 1;
    styles.push({ format });
    styleIds.set(format, id);
    return id;
  };

  const textStyleId = idForFormat('@');
  const columnStyleIds = columns.map((column) => idForFormat(column.format ?? DEFAULT_FORMATS[column.type]));
  return {
    styles,
    styleIdFunc: (_value: unknown, columnIndex: number, rowIndex: number) => (
      rowIndex === 0 ? textStyleId : (columnStyleIds[columnIndex] ?? 0)
    ),
  };
}

/** 回傳真正串流的 XLSX web stream；ZIP、工作表 XML、資料列皆逐步產生。 */
export function createXlsxStream(options: XlsxSheetOptions): ReadableStream<Uint8Array> {
  const styleOptions = createStyles(options.columns);
  const workbook = new XlsxStreamWriter({
    inlineStrings: true,
    styles: styleOptions.styles,
    styleIdFunc: styleOptions.styleIdFunc,
  });
  workbook.addRows(buildXlsxRows(options.columns, options.rows));
  return workbook.getStream();
}

export function xlsxFilename(prefix: string, now: Date = new Date()): string {
  return `${prefix}-${now.toISOString().slice(0, 10).replace(/-/g, '')}.xlsx`;
}

export function resolveExportFormat(rawFormat: string | null): 'csv' | 'xlsx' {
  return rawFormat === 'xlsx' ? 'xlsx' : 'csv';
}

export const XLSX_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export interface XlsxExportArgs {
  columns: readonly XlsxColumn[];
  rows: XlsxRows;
  rowCount: number;
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

/** 建立串流下載回應並寫入與 CSV 匯出一致的操作稽核。 */
export function createXlsxExportResponse(args: XlsxExportArgs): Response {
  const filename = xlsxFilename(args.filenamePrefix);
  const stream = createXlsxStream({ columns: args.columns, rows: args.rows });

  writeOperationAudit({
    userId: args.audit.userId,
    role: args.audit.role,
    action: args.audit.action,
    ipAddress: args.audit.ipAddress,
    userAgent: args.audit.userAgent,
    result: 'success',
    isAdminOperation: false,
    metadata: {
      rows: args.rowCount,
      filename,
      dateFrom: args.audit.dateFrom,
      dateTo: args.audit.dateTo,
      format: 'xlsx',
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': XLSX_CONTENT_TYPE,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
