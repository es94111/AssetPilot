// lib/ofxParser.ts — 銀行／券商對帳檔（OFX 1.x SGML 與 2.x XML）自寫解析器。
//
// 為何自寫：OFX 1.x 是 SGML（容器標籤有結尾、僅帶值的葉標籤常省略結尾），2.x 起才是
// 標準 XML；既有 npm 生態沒有同時可靠支援兩者且仍在維護的套件，故不新增相依套件。
//
// 解析範圍：銀行對帳單（STMTRS）、信用卡對帳單（CCSTMTTRS）與券商投資對帳單
// （INVSTMTRS 內的 BUYSTOCK／SELLSTOCK／BUYMF／SELLMF／INCOME／INVEXPENSE／
// INVBANKTRAN 等）。純移轉類（TRANSFER）等沒有帳本收支語意的型別會略過並計數。
//
// 本模組為純函式：不觸碰 DB、不寫稽核、不做授權判斷（呼叫端負責）。

/** 對帳檔中單筆交易的收支方向。 */
export type OfxDirection = 'debit' | 'credit';

/** 對帳單來源類型；決定金額正負號的解讀方式。 */
export type OfxStatementKind = 'bank' | 'credit_card' | 'investment';

/**
 * 對帳檔中的單筆交易，已正規化為 AssetPilot 可理解的形狀。
 *
 * `amount` 一律為**正值**，方向由 `direction` 表達。銀行／券商現金流以 TRNAMT
 * 的正負號決定（負為 debit）；信用卡帳單沿用 OFX 慣例，TRNAMT 正值代表消費
 * （debit）、負值代表退款（credit）。
 */
export interface OfxTransaction {
  /** 銀行／券商端唯一識別碼（FITID）；缺少時為空字串。 */
  fitid: string;
  /** 交易日 `YYYY-MM-DD`。 */
  date: string;
  /** 帳簿入帳日 `YYYY-MM-DD`；OFX 未提供時等於 `date`。 */
  postedDate: string;
  /** 正值金額。 */
  amount: number;
  /** 收支方向。 */
  direction: OfxDirection;
  /** 交易摘要（NAME 與 MEMO 合併正規化後文字）。 */
  description: string;
  /** 交易型別代碼（TRNTYPE 或投資交易標籤名），未提供時為空字串。 */
  typeCode: string;
  /** 券商投資標的代號（UNIQUEID／TICKER），非投資交易為空字串。 */
  securityId: string;
  /** 券商投資交易單位數（UNITS），非投資交易為 0。 */
  units: number;
}

/** 一份對帳檔的解析結果（檔案含多個帳戶聲明時全部攤平）。 */
export interface OfxParseResult {
  /** 來源檔版本：`1`（SGML）或 `2`（XML）。 */
  version: 1 | 2;
  /** 檔案中出現的對帳單類型（可多種）。 */
  kinds: OfxStatementKind[];
  /** 帳戶識別碼（ACCTID）清單，可能為空。 */
  accounts: string[];
  /** 預設幣別（CURDEF），未提供時為空字串。 */
  currency: string;
  /** 對帳單期間起日 `YYYY-MM-DD`，未提供時為空字串。 */
  periodStart: string;
  /** 對帳單期間迄日 `YYYY-MM-DD`，未提供時為空字串。 */
  periodEnd: string;
  /** 交易日涵蓋範圍起日 `YYYY-MM-DD`，無交易時為空字串。 */
  dateFrom: string;
  /** 交易日涵蓋範圍迄日 `YYYY-MM-DD`，無交易時為空字串。 */
  dateTo: string;
  /** 全部交易（依檔案出現順序）。 */
  transactions: OfxTransaction[];
  /** 略過的交易型別統計（型別代碼 → 筆數）。 */
  skippedTypes: Record<string, number>;
}

export class OfxParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OfxParseError';
  }
}

interface OfxNode {
  name: string;
  children: OfxNode[];
  value: string;
}

const MAX_TAG_NAME_LENGTH = 64;
const MAX_TEXT_LENGTH = 4096;
export const OFX_MAX_TRANSACTIONS = 20000;

/** 沒有帳本收支語意、因此刻意略過的投資交易型別。 */
const SKIPPED_INVESTMENT_TYPES = new Set(['TRANSFER', 'MARGININTEREST', 'CLOSUREOPT']);

/** 認可的投資交易容器標籤。 */
const INVESTMENT_TRADE_TAGS = new Set([
  'BUYSTOCK', 'SELLSTOCK', 'BUYMF', 'SELLMF', 'BUYDEBT', 'SELLDEBT',
  'BUYOPT', 'SELLOPT', 'BUYOTHER', 'SELLOTHER', 'INCOME', 'INVEXPENSE',
]);

/** 賣出（收入）方向；其餘投資交易視為買進（支出）。 */
function isCreditInvestmentTag(tag: string): boolean {
  return tag.startsWith('SELL') || tag === 'INCOME';
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, '&');
}

function appendText(node: OfxNode, chunk: string, decodeEntities: boolean): void {
  const text = chunk.trim();
  if (!text) return;
  const decoded = decodeEntities ? decodeXmlEntities(text) : text;
  if (node.value.length >= MAX_TEXT_LENGTH) return;
  node.value = (node.value + decoded).slice(0, MAX_TEXT_LENGTH);
}

/**
 * 預先掃描出「有明確結尾標籤」的元素名稱。
 *
 * OFX 1.x 的 SGML 只對容器元素強制結尾；帶值的葉標籤（`<TRNTYPE>DEBIT`）常省略
 * 結尾。因此以「該名稱是否出現過 `</NAME>`」判定容器與葉節點，葉節點在遇到下一個
 * 起始標籤時即視為已結束——否則後續兄弟節點會被誤植為它的子節點。
 */
function collectExplicitlyClosedNames(text: string): Set<string> {
  const names = new Set<string>();
  for (const match of text.matchAll(/<\s*\/\s*([A-Za-z0-9_.:-]+)/g)) {
    names.add(match[1].toUpperCase().replace(/^[A-Z0-9_]+:/, ''));
  }
  return names;
}

/**
 * 逐字元掃描標籤並建立巢狀結構，同時容錯 OFX 1.x 與 2.x。
 *
 * 兩種省略寫法都要處理（見 `collectExplicitlyClosedNames`）：
 *  1. 葉標籤省略結尾：開啟新標籤時，堆疊頂端若為葉元素即先彈出。
 *  2. 同名標籤直接重開：堆疊中已有同名節點時視為前一個已隱式結束。
 */
function tokenize(text: string, decodeEntities: boolean): OfxNode[] {
  const root: OfxNode = { name: '', children: [], value: '' };
  const stack: OfxNode[] = [root];
  const explicitlyClosed = collectExplicitlyClosedNames(text);
  const length = text.length;
  let i = 0;

  while (i < length) {
    const lt = text.indexOf('<', i);
    appendText(stack[stack.length - 1], lt === -1 ? text.slice(i) : text.slice(i, lt), decodeEntities);
    if (lt === -1) break;

    if (text.startsWith('<!--', lt)) {
      const end = text.indexOf('-->', lt + 4);
      i = end === -1 ? length : end + 3;
      continue;
    }
    if (text.startsWith('<?', lt) || text.startsWith('<!', lt)) {
      const end = text.indexOf('>', lt + 2);
      i = end === -1 ? length : end + 1;
      continue;
    }

    const gt = text.indexOf('>', lt + 1);
    if (gt === -1) break;
    const rawTag = text.slice(lt + 1, gt).trim();
    i = gt + 1;
    if (!rawTag) continue;

    if (rawTag.startsWith('/')) {
      const name = rawTag.slice(1).trim().toUpperCase().replace(/^[A-Z0-9_]+:/, '');
      for (let depth = stack.length - 1; depth > 0; depth -= 1) {
        if (stack[depth].name === name) {
          stack.length = depth;
          break;
        }
      }
      continue;
    }

    const selfClosing = rawTag.endsWith('/');
    const body = (selfClosing ? rawTag.slice(0, -1) : rawTag).trim();
    // OFX 2.x 允許命名空間前綴（ofx:STMTTRN）；統一去除後再比對。
    const rawName = (body.split(/[\s/]+/)[0] || '').toUpperCase();
    const name = rawName.replace(/^[A-Z0-9_]+:/, '');
    if (!name || name.length > MAX_TAG_NAME_LENGTH || !/^[A-Z0-9._-]+$/.test(name)) continue;

    // 規則 1：葉元素自動結束。
    while (stack.length > 1 && !explicitlyClosed.has(stack[stack.length - 1].name)) {
      stack.pop();
    }
    // 規則 2：同名元素重開（前一個未結尾）。
    while (stack.length > 1 && stack[stack.length - 1].name === name) {
      stack.pop();
    }

    const node: OfxNode = { name, children: [], value: '' };
    stack[stack.length - 1].children.push(node);
    if (!selfClosing) stack.push(node);
  }

  return root.children;
}

/** 深度優先走訪，回傳第一個名稱相符的節點。 */
function findFirst(nodes: OfxNode[], name: string): OfxNode | null {
  for (const node of nodes) {
    if (node.name === name) return node;
    const nested = findFirst(node.children, name);
    if (nested) return nested;
  }
  return null;
}

/** 深度優先走訪，回傳全部名稱相符的節點。 */
function findAll(nodes: OfxNode[], name: string): OfxNode[] {
  const out: OfxNode[] = [];
  for (const node of nodes) {
    if (node.name === name) out.push(node);
    out.push(...findAll(node.children, name));
  }
  return out;
}

/**
 * 取直接子節點字串值（同名取文件順序第一個）。
 *
 * 只比對直接子節點即可：tokenize() 已依「有無明確結尾標籤」正確區分容器與葉節點，
 * 不會再把兄弟節點誤植為子節點。
 */
function valueOf(node: OfxNode | null, name: string): string {
  if (!node) return '';
  const child = node.children.find((entry) => entry.name === name);
  return child ? child.value.trim() : '';
}

/**
 * 深度優先搜尋並取字串值（同名取文件順序第一個）。
 *
 * 投資交易的欄位藏在 INVBUY／INVSELL／SECID 等子容器內（例如 FITID 在
 * BUYSTOCK > INVBUY > INVTRAN 之下），因此這些欄位必須深度搜尋。
 */
function findValueDeep(node: OfxNode, name: string): string {
  return findFirst(node.children, name)?.value.trim() || '';
}

/** 從直接子節點中取第一個存在者（OFX 各版本／各帳戶型別的容器名稱不同）。 */
function firstChild(node: OfxNode, names: string[]): OfxNode | null {
  for (const name of names) {
    const found = node.children.find((entry) => entry.name === name);
    if (found) return found;
  }
  return null;
}

/** OFX 日期：`YYYYMMDD[HHMMSS][.XXX][[+/-]TZ:TZNAME]`；無法解析時回傳 `''`。 */
export function parseOfxDate(raw: string | null | undefined): string {
  const match = String(raw || '').trim().match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return '';
  const [, year, month, day] = match;
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() + 1 !== m || dt.getUTCDate() !== d) return '';
  return `${year}-${month}-${day}`;
}

/** OFX 金額可能帶千分位逗號、貨幣符號（可含正負號）或空白；無法解析時回傳 `NaN`。 */
export function parseOfxAmount(raw: string | null | undefined): number {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/[,\s\u00A0]/g, '')
    .replace(/^([+-]?)[$€£¥₩]/, '$1');
  if (!cleaned || !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(cleaned)) return NaN;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function normalizeDescription(parts: string[]): string {
  return parts
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join(' — ')
    .slice(0, 500);
}

interface RawTransactionOptions {
  kind: OfxStatementKind;
  typeCode: string;
  securityId?: string;
  units?: number;
  /** 現金流語意已由呼叫端判定時提供的簽名金額（投資交易用）。 */
  signedAmount?: number;
  /** 投資交易的欄位散落在子容器內時改用深度搜尋取值。 */
  deep?: boolean;
}

function buildTransaction(trn: OfxNode, options: RawTransactionOptions): OfxTransaction | null {
  const pick = options.deep
    ? (name: string) => findValueDeep(trn, name)
    : (name: string) => valueOf(trn, name);
  const rawAmount = Number.isFinite(options.signedAmount as number)
    ? (options.signedAmount as number)
    : parseOfxAmount(pick('TRNAMT'));
  if (!Number.isFinite(rawAmount)) return null;

  const postedDate = parseOfxDate(pick('DTPOSTED'));
  const date = postedDate || parseOfxDate(pick('DTTRADE'));
  if (!date) return null;

  // 信用卡沿用 OFX 慣例：TRNAMT 正值為消費（debit），負值為退款（credit）。
  const direction: OfxDirection =
    options.kind === 'credit_card'
      ? (rawAmount < 0 ? 'credit' : 'debit')
      : (rawAmount < 0 ? 'debit' : 'credit');

  return {
    fitid: pick('FITID').slice(0, 128),
    date,
    postedDate: postedDate || date,
    amount: Math.abs(rawAmount),
    direction,
    description:
      normalizeDescription([pick('NAME'), pick('MEMO')]) ||
      pick('TRNTYPE') ||
      options.typeCode,
    typeCode: options.typeCode.slice(0, 32),
    securityId: String(options.securityId || '').slice(0, 64),
    units: Number(options.units) || 0,
  };
}

function collectInvestmentTransactions(
  nodes: OfxNode[],
  skipped: Record<string, number>,
): OfxTransaction[] {
  const out: OfxTransaction[] = [];
  for (const node of nodes) {
    if (node.name === 'INVBANKTRAN') {
      const trn = firstChild(node, ['STMTTRN']);
      if (trn) {
        const tx = buildTransaction(trn, { kind: 'investment', typeCode: valueOf(trn, 'TRNTYPE') });
        if (tx) out.push(tx);
      }
      continue;
    }
    if (SKIPPED_INVESTMENT_TYPES.has(node.name)) {
      skipped[node.name] = (skipped[node.name] || 0) + 1;
      continue;
    }
    if (!INVESTMENT_TRADE_TAGS.has(node.name)) continue;

    // 投資交易的欄位藏在子容器內（FITID 在 INVTRAN、TOTAL 在 INVBUY／INVSELL、
    // SECID 在 INVTRAN 旁），因此一律以深度搜尋取值。
    const total = parseOfxAmount(findValueDeep(node, 'TOTAL'));
    const signedAmount = Number.isFinite(total)
      ? total
      : (isCreditInvestmentTag(node.name) ? 1 : -1) * Math.abs(parseOfxAmount(findValueDeep(node, 'TRNAMT')));
    const invTran = firstChild(node, ['INVTRAN']);
    const securityId = findValueDeep(node, 'UNIQUEID') || findValueDeep(node, 'TICKER');
    const units = Number(findValueDeep(node, 'UNITS')) || 0;
    const tx = buildTransaction(invTran || node, {
      kind: 'investment',
      typeCode: node.name,
      securityId,
      units,
      signedAmount,
      deep: true,
    });
    if (tx) out.push(tx);
  }
  return out;
}

/**
 * 解析 OFX 內容（OFX 1.x SGML 與 OFX 2.x XML）。
 *
 * 拋出 `OfxParseError`：內容不是 OFX、找不到帳戶對帳聲明、或交易筆數超過
 * `OFX_MAX_TRANSACTIONS`（呼叫端應先擋下過大檔案再解析）。
 */
export function parseOfx(content: string): OfxParseResult {
  const text = String(content || '').replace(/^\uFEFF/, '');
  if (!text.trim()) throw new OfxParseError('OFX 檔案為空');

  // 2.x 才有 XML 宣告、命名空間前綴或 ofx.net／ofx.org 命名空間；
  // 1.x 以 OFXHEADER／DATA:OFXSGML 的鍵值標頭開頭。
  const isXml =
    /<\?xml/i.test(text) ||
    /xmlns[^>]*ofx\.(?:net|org)/i.test(text) ||
    /<\/?(?:[A-Za-z0-9_]+:)[A-Za-z]/i.test(text);
  const nodes = tokenize(text, isXml);
  const ofxNode = findFirst(nodes, 'OFX');
  if (!ofxNode) {
    throw new OfxParseError('無法辨識 OFX 檔頭，請確認檔案為 OFX 1.x 或 2.x 格式');
  }

  const statementNodes = [
    ...findAll(ofxNode.children, 'STMTRS'),
    ...findAll(ofxNode.children, 'CCSTMTRS'),
    ...findAll(ofxNode.children, 'INVSTMTRS'),
  ];
  if (statementNodes.length === 0) {
    throw new OfxParseError('OFX 檔案中找不到帳戶對帳聲明（STMTRS／CCSTMTRS／INVSTMTRS）');
  }

  const kinds = new Set<OfxStatementKind>();
  const accounts = new Set<string>();
  const skippedTypes: Record<string, number> = {};
  const transactions: OfxTransaction[] = [];
  let currency = '';
  let periodStart = '';
  let periodEnd = '';

  for (const stmt of statementNodes) {
    const acctFrom = firstChild(stmt, ['BANKACCTFROM', 'CCACCTFROM', 'INVACCTFROM']);
    const kind: OfxStatementKind =
      stmt.name === 'INVSTMTRS' || acctFrom?.name === 'INVACCTFROM'
        ? 'investment'
        : stmt.name === 'CCSTMTRS' || acctFrom?.name === 'CCACCTFROM'
          ? 'credit_card'
          : 'bank';
    kinds.add(kind);

    currency = currency || valueOf(stmt, 'CURDEF');

    const acctId = valueOf(acctFrom, 'ACCTID');
    if (acctId) accounts.add(acctId.slice(0, 64));

    const bankTranList = firstChild(stmt, ['BANKTRANLIST']);
    if (bankTranList) {
      const from = parseOfxDate(valueOf(bankTranList, 'DTSTART'));
      const to = parseOfxDate(valueOf(bankTranList, 'DTEND'));
      if (from && (!periodStart || from < periodStart)) periodStart = from;
      if (to && (!periodEnd || to > periodEnd)) periodEnd = to;

      for (const trn of findAll(bankTranList.children, 'STMTTRN')) {
        const tx = buildTransaction(trn, { kind, typeCode: valueOf(trn, 'TRNTYPE') });
        if (tx) transactions.push(tx);
      }
    }

    const invTranList = firstChild(stmt, ['INVTRANLIST']);
    if (invTranList) {
      transactions.push(...collectInvestmentTransactions(invTranList.children, skippedTypes));
    }
  }

  if (transactions.length > OFX_MAX_TRANSACTIONS) {
    throw new OfxParseError(`單次最多匯入 ${OFX_MAX_TRANSACTIONS} 筆，請分批上傳`);
  }

  const dates = transactions.map((tx) => tx.date).filter(Boolean).sort();
  return {
    version: isXml ? 2 : 1,
    kinds: [...kinds],
    accounts: [...accounts],
    currency,
    periodStart,
    periodEnd,
    dateFrom: dates[0] || '',
    dateTo: dates[dates.length - 1] || '',
    transactions,
    skippedTypes,
  };
}
