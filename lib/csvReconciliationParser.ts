// lib/csvReconciliationParser.ts — 銀行／券商 CSV 對帳檔解析（可設定欄位對應）。
//
// 與自家匯出／匯入（app/api/transactions/import）不同，銀行與券商 CSV 沒有共同欄位
// 命名與排列，因此本模組以「欄位對應 profile」描述來源檔的欄位語意，再由同一份解析器
// 產生正規化的交易列。
//
// 兩個安全性處理比照既有匯出邏輯（lib/auditHelpers.ts）：
//  1. UTF-8 BOM（`\uFEFF`）一律去除，否則第一個標題會多出不可見字元而對不上 profile。
//  2. Formula Injection 防護：外部檔案內容可能以 `=`、`+`、`-`、`@` 開頭，若原樣寫入
//     資料庫，之後匯出成 CSV 再被試算表開啟時會被當成公式執行。匯出端已加 `'` 前綴，
//     匯入端則反向還原自家匯出的 `'` 前綴，並對其餘危險開頭一律移除，杜絕來回注入。
//
// 本模組為純函式：不觸碰 DB、不寫稽核、不做授權判斷（呼叫端負責）。

/** 日期格式；`auto` 依序嘗試所有支援格式。 */
export type ReconciliationDateFormat =
  | 'auto'
  | 'YYYY-MM-DD'
  | 'YYYY/MM/DD'
  | 'YYYYMMDD'
  | 'MM/DD/YYYY'
  | 'DD/MM/YYYY'
  | 'DD-MM-YYYY'
  | 'YYYY年MM月DD日';

/**
 * 金額正負號語意：
 * - `signed`（預設，銀行對帳單）：負值為支出（debit）、正值為收入（credit）。
 * - `credit_card`（信用卡帳單）：正值為消費（debit）、負值為退款（credit）。
 */
export type ReconciliationAmountSign = 'signed' | 'credit_card';

/** 欄位對應 profile：描述來源 CSV 每個語意欄位對應的標題名稱。 */
export interface ReconciliationCsvProfile {
  /** 欄位分隔符，預設 `,`。 */
  delimiter?: string;
  /** 第一列是否為標題列，預設 true。 */
  hasHeader?: boolean;
  /** 略過的前導資料列數（不含標題列），預設 0。 */
  skipRows?: number;
  /** 日期格式，預設 `auto`。 */
  dateFormat?: ReconciliationDateFormat;
  /** 金額正負號語意，預設 `signed`。 */
  amountSign?: ReconciliationAmountSign;
  /** 語意欄位 → 來源標題名稱。 */
  columns: {
    /** 日期欄（必填）。 */
    date: string;
    /** 金額欄；與 `debit`／`credit` 二選一。 */
    amount?: string;
    /** 借方（支出）金額欄；與 `amount` 二選一。 */
    debit?: string;
    /** 貸方（收入）金額欄；與 `amount` 二選一。 */
    credit?: string;
    /** 摘要欄。 */
    description?: string;
    /** 銀行／券商端唯一識別碼欄（選填，缺少時由內容推導）。 */
    fitid?: string;
    /** 帳戶欄（選填）。 */
    account?: string;
  };
}

/** 解析後的正規化交易列（`amount` 恆為正值，方向由 `direction` 表達）。 */
export interface ReconciliationCsvRow {
  /** 來源列號（1-based，含標題列，方便使用者回查原檔）。 */
  line: number;
  fitid: string;
  date: string;
  amount: number;
  direction: 'debit' | 'credit';
  description: string;
  account: string;
}

/** 解析失敗的列（不中斷整批解析，交由呼叫端決定是否整批拒絕）。 */
export interface ReconciliationCsvRowError {
  line: number;
  reason: string;
}

export interface ReconciliationCsvParseResult {
  /** 實際使用的欄位對應（含套用後的預設值）。 */
  profile: Required<Omit<ReconciliationCsvProfile, 'columns'>> & {
    columns: ReconciliationCsvProfile['columns'];
  };
  /** 來源檔標題列（無標題列時為空陣列）。 */
  headers: string[];
  rows: ReconciliationCsvRow[];
  errors: ReconciliationCsvRowError[];
  /** profile 指向但來源檔不存在的欄位名稱。 */
  missingColumns: string[];
}

export class ReconciliationCsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReconciliationCsvError';
  }
}

export const RECONCILIATION_CSV_MAX_ROWS = 20000;

/** 支援的日期格式 → 正規表示式（捕獲年、月、日）。 */
const DATE_PATTERNS: Array<{ format: ReconciliationDateFormat; regex: RegExp; order: [number, number, number] }> = [
  { format: 'YYYY-MM-DD', regex: /^(\d{4})-(\d{1,2})-(\d{1,2})$/, order: [0, 1, 2] },
  { format: 'YYYY/MM/DD', regex: /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/, order: [0, 1, 2] },
  { format: 'YYYYMMDD', regex: /^(\d{4})(\d{2})(\d{2})$/, order: [0, 1, 2] },
  { format: 'YYYY年MM月DD日', regex: /^(\d{4})年(\d{1,2})月(\d{1,2})日$/, order: [0, 1, 2] },
  // 兩位數年份的斜線格式無從可靠區分 DD/MM 與 MM/DD，因此放在斜線格式之後，
  // 由格式明確的 `dateFormat` 指定；`auto` 時以 MM/DD/YYYY 為預設（美國來源常見）。
  { format: 'MM/DD/YYYY', regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, order: [2, 0, 1] },
  { format: 'DD/MM/YYYY', regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/, order: [2, 1, 0] },
  { format: 'DD-MM-YYYY', regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/, order: [2, 1, 0] },
];

/**
 * 判斷字串是否為「看起來就是數值」的金額。
 *
 * 用途：Formula Injection 防護會移除 `-`／`+` 開頭，但負數金額 `-1250` 與負向金額
 * `-1,250` 也正好是這種開頭，若一律移除會把支出變成收入（方向反轉）。因此先判斷是否
 * 為合法數值，是數值者原樣保留，僅對真正的公式樣式字串做處理。
 */
function looksNumeric(value: string): boolean {
  const cleaned = value
    .replace(/[,\s\u00A0]/g, '')
    .replace(/^([+-]?)[$€£¥₩]/, '$1');
  return /^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(cleaned);
}

/**
 * 去除試算表 Formula Injection 風險並還原自家匯出的 `'` 前綴。
 *
 * 匯出端（`csvCell`）會對 `=`、`+`、`-`、`@` 開頭的字串加上 `'` 前綴；匯入第三方
 * 檔案時若原樣保留，之後再次匯出就會被試算表當成公式。因此這裡反向處理：
 * 自家前綴 `'=...` 還原為 `=...`，其餘危險開頭則移除該字元；但負數金額必須保留
 * 正負號（見 `looksNumeric`），否則對帳方向會整批反轉。
 */
export function neutralizeCsvFormula(value: string): string {
  const raw = String(value ?? '');
  if (raw.startsWith("'") && /^[=+\-@]/.test(raw.slice(1))) return raw.slice(1);
  // 控制字元（Tab／CR）常被用來繞過前端公式檢查，先行剝除。
  const trimmedControl = raw.replace(/^[\t\r]+/, '');
  if (!/^[=+\-@]/.test(trimmedControl)) return trimmedControl;
  if (looksNumeric(trimmedControl)) return trimmedControl;
  return trimmedControl.slice(1);
}

/** 解析 CSV 全文為字串矩陣；支援雙引號跳脫、CRLF／CR／LF 與 UTF-8 BOM。 */
export function parseDelimited(text: string, delimiter = ','): string[][] {
  const normalized = String(text ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
  const rows: string[][] = [];
  let cells: string[] = [];
  let current = '';
  let inQuotes = false;
  let hasContent = false;

  for (let i = 0; i < normalized.length; i += 1) {
    const char = normalized[i];
    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' && current.trim() === '') {
      // 僅在欄位開頭（允許前導空白）才視為引號區段起始。
      inQuotes = true;
      current = current.trim();
      continue;
    }
    if (char === delimiter) {
      cells.push(current);
      current = '';
      hasContent = true;
      continue;
    }
    if (char === '\n') {
      cells.push(current);
      if (hasContent || cells.some((cell) => cell.trim() !== '')) rows.push(cells);
      cells = [];
      current = '';
      hasContent = false;
      continue;
    }
    current += char;
  }

  cells.push(current);
  if (hasContent || cells.some((cell) => cell.trim() !== '')) rows.push(cells);
  return rows.map((row) => row.map((cell) => cell.trim()));
}

/** 依 `dateFormat` 解析日期字串為 `YYYY-MM-DD`；無法解析時回傳 `''`。 */
export function parseReconciliationDate(
  raw: string,
  format: ReconciliationDateFormat = 'auto',
): string {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  const candidates = format === 'auto'
    ? DATE_PATTERNS
    : DATE_PATTERNS.filter((pattern) => pattern.format === format);

  for (const { regex, order } of candidates) {
    const match = value.match(regex);
    if (!match) continue;
    const year = Number(match[order[0] + 1]);
    const month = Number(match[order[1] + 1]);
    const day = Number(match[order[2] + 1]);
    const dt = new Date(Date.UTC(year, month - 1, day));
    if (dt.getUTCFullYear() !== year || dt.getUTCMonth() + 1 !== month || dt.getUTCDate() !== day) {
      continue;
    }
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  return '';
}

/**
 * 解析金額字串；容忍千分位逗號、外層括號（會計負數寫法）、貨幣符號與正負號。
 * 無法解析或為零時回傳 `NaN`（零金額在對帳上沒有意義，交由呼叫端列為錯誤列）。
 */
export function parseReconciliationAmount(raw: string): number {
  let value = String(raw ?? '').trim();
  if (!value) return NaN;
  // 會計負數：`(1,234.56)`。
  const parenthesized = /^\((.*)\)$/.exec(value);
  if (parenthesized) value = `-${parenthesized[1]}`;
  const cleaned = value
    .replace(/\s|\u00A0/g, '')
    .replace(/^([+-]?)[$€£¥₩]/, '$1')
    .replace(/,/g, '');
  if (!/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(cleaned)) return NaN;
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed) || parsed === 0) return NaN;
  return parsed;
}

/** 以內容推導缺少 FITID 時的穩定識別碼（同日同金額同摘要可去重）。 */
function deriveFitid(row: { date: string; amount: number; direction: string; description: string }): string {
  return ['csv', row.date, row.direction, row.amount.toFixed(2), row.description]
    .join('|')
    .slice(0, 128);
}

function resolveProfile(
  profile: ReconciliationCsvProfile,
): ReconciliationCsvParseResult['profile'] {
  return {
    delimiter: profile.delimiter || ',',
    hasHeader: profile.hasHeader !== false,
    skipRows: Math.max(0, Number(profile.skipRows) || 0),
    dateFormat: profile.dateFormat || 'auto',
    amountSign: profile.amountSign || 'signed',
    columns: profile.columns,
  };
}

/**
 * 依欄位對應 profile 解析銀行／券商 CSV 對帳檔。
 *
 * 拋出 `ReconciliationCsvError`：profile 未指定日期欄、未指定金額欄、同時指定
 * `amount` 與 `debit`／`credit`、或筆數超過上限。個別列的解析失敗會收集在
 * `errors` 而不中斷（呼叫端若採原子化匯入，應在 `errors` 非空時整批拒絕）。
 */
export function parseReconciliationCsv(
  text: string,
  profile: ReconciliationCsvProfile,
): ReconciliationCsvParseResult {
  if (!profile || typeof profile !== 'object' || !profile.columns || typeof profile.columns !== 'object') {
    throw new ReconciliationCsvError('缺少欄位對應設定（columns）');
  }
  const resolved = resolveProfile(profile);
  const { columns } = resolved;
  if (!columns.date) throw new ReconciliationCsvError('欄位對應缺少日期欄（columns.date）');
  const usesSplitAmount = Boolean(columns.debit || columns.credit);
  if (columns.amount && usesSplitAmount) {
    throw new ReconciliationCsvError('金額欄只能二選一：amount，或 debit／credit 分欄');
  }
  if (!columns.amount && !usesSplitAmount) {
    throw new ReconciliationCsvError('欄位對應缺少金額欄（columns.amount 或 columns.debit／credit）');
  }

  const matrix = parseDelimited(text, resolved.delimiter);
  if (matrix.length === 0) throw new ReconciliationCsvError('CSV 檔案為空');

  // 前導列（銀行常放帳號／期間等表頭資訊）必須先略過，再做標題列判讀，
  // 否則真正的標題列會被當成前導列而整批對不上欄位。
  const afterSkip = matrix.slice(Math.min(resolved.skipRows, matrix.length));
  if (afterSkip.length === 0) throw new ReconciliationCsvError('略過前導列後已無資料');
  const headers = resolved.hasHeader ? afterSkip[0] : [];
  const dataRows = afterSkip.slice(resolved.hasHeader ? 1 : 0);

  const referenced = Object.values(columns).filter((name): name is string => Boolean(name));
  const missingColumns = referenced.filter((name) => !headers.includes(name));
  if (resolved.hasHeader && missingColumns.length > 0) {
    throw new ReconciliationCsvError(
      `CSV 缺少對應欄位：${missingColumns.join('、')}（實際標題：${headers.join('、') || '（無）'}）`,
    );
  }

  const columnIndex = (name?: string): number => (name ? headers.indexOf(name) : -1);
  const indexOfDate = columnIndex(columns.date);
  const indexOfAmount = columnIndex(columns.amount);
  const indexOfDebit = columnIndex(columns.debit);
  const indexOfCredit = columnIndex(columns.credit);
  const indexOfDescription = columnIndex(columns.description);
  const indexOfFitid = columnIndex(columns.fitid);
  const indexOfAccount = columnIndex(columns.account);

  const rows: ReconciliationCsvRow[] = [];
  const errors: ReconciliationCsvRowError[] = [];

  for (let i = 0; i < dataRows.length; i += 1) {
    const cells = dataRows[i];
    // 列號以原始檔案為準（標題列為第 1 列）。
    const line = i + (resolved.hasHeader ? 2 : 1) + resolved.skipRows;
    const pick = (index: number): string =>
      index >= 0 && index < cells.length ? neutralizeCsvFormula(cells[index]) : '';

    const date = parseReconciliationDate(pick(indexOfDate), resolved.dateFormat);
    if (!date) {
      errors.push({ line, reason: `日期無法解析：${pick(indexOfDate) || '（空白）'}` });
      continue;
    }

    let signed: number;
    if (usesSplitAmount) {
      const debit = parseReconciliationAmount(pick(indexOfDebit));
      const credit = parseReconciliationAmount(pick(indexOfCredit));
      if (Number.isFinite(debit)) signed = -Math.abs(debit);
      else if (Number.isFinite(credit)) signed = Math.abs(credit);
      else {
        errors.push({ line, reason: '借方與貸方金額皆為空或無法解析' });
        continue;
      }
    } else {
      signed = parseReconciliationAmount(pick(indexOfAmount));
      if (!Number.isFinite(signed)) {
        errors.push({ line, reason: `金額無法解析：${pick(indexOfAmount) || '（空白）'}` });
        continue;
      }
    }

    const direction: 'debit' | 'credit' =
      resolved.amountSign === 'credit_card'
        ? (signed < 0 ? 'credit' : 'debit')
        : (signed < 0 ? 'debit' : 'credit');
    const description = pick(indexOfDescription).slice(0, 500);
    const amount = Math.abs(signed);

    rows.push({
      line,
      fitid: pick(indexOfFitid).slice(0, 128) || deriveFitid({ date, amount, direction, description }),
      date,
      amount,
      direction,
      description,
      account: pick(indexOfAccount).slice(0, 64),
    });
  }

  if (rows.length > RECONCILIATION_CSV_MAX_ROWS) {
    throw new ReconciliationCsvError(`單次最多匯入 ${RECONCILIATION_CSV_MAX_ROWS} 筆，請分批上傳`);
  }

  return { profile: resolved, headers, rows, errors, missingColumns };
}
