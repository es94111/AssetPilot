// tests/lib/xlsxExport.test.ts — Excel (.xlsx) 匯出共用工具（issue #261）
//
// 驗收條件對應：
//   - XLSX 含欄位標題、正確的日期與數字型別（金額為數值欄位而非字串）
//   - 沿用既有 Formula Injection 防護（以 `'` 前置或以文字格式儲存）
//
// 純函式測試，不需 PostgreSQL；直接解開產出的 .xlsx（zip）檢查 XML，
// 斷言儲存格型別與 numFmt，避免只測到自家包裝層。
// 執行方式：node --experimental-transform-types --import ./tests/setup/register.mjs tests/lib/xlsxExport.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';

import {
  buildSheetData,
  createXlsxStream,
  escapeFormulaText,
  parseDateOnly,
  resolveExportFormat,
  sanitizeSheetName,
  toNumeric,
  xlsxFilename,
  XLSX_CONTENT_TYPE,
  type XlsxColumn,
  type XlsxRow,
} from '../../lib/xlsxExport.ts';

const ZIP_MAGIC = 'PK';

async function readXlsx(rows: readonly XlsxRow[], columns: readonly XlsxColumn[], sheetName = 'S') {
  const stream = await createXlsxStream({ sheetName, columns, rows });
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const buffer = Buffer.concat(chunks);
  const zip = await JSZip.loadAsync(buffer);
  const sheetXml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
  const stylesXml = await zip.file('xl/styles.xml')!.async('string');
  return { buffer, sheetXml, stylesXml };
}

function rowXml(sheetXml: string, rowNumber: number): string {
  const match = new RegExp(`<row r="${rowNumber}"[^>]*>.*?</row>`, 's').exec(sheetXml);
  return match ? match[0] : '';
}

function cellsOf(row: string): string[] {
  // 以 [\s\S] 取代 dotAll 旗標（tsconfig 的 target 較舊，不支援 /s）。
  return [...row.matchAll(/<c [^>]*>[\s\S]*?<\/c>|<c [^>]*\/>/g)].map((m) => m[0]);
}

test('xlsx：欄位標題列寫入第一列且為文字', async () => {
  const { sheetXml } = await readXlsx([], [
    { header: '日期', type: 'date' },
    { header: '金額', type: 'number' },
  ]);
  const header = rowXml(sheetXml, 1);
  const cells = cellsOf(header);

  assert.equal(cells.length, 2, '第一列應有兩個標題儲存格');
  // 標題走 sharedStrings（t="s"），代表是文字而非數字／公式。
  assert.match(cells[0], /t="s"/);
  assert.match(cells[1], /t="s"/);
});

test('xlsx：日期為日期型別（序列值）並套用 yyyy-mm-dd 格式', async () => {
  const { sheetXml, stylesXml } = await readXlsx(
    [['2026-08-14', 1]],
    [{ header: '日期', type: 'date' }, { header: '金額', type: 'number' }],
  );
  const row = rowXml(sheetXml, 2);
  const cells = cellsOf(row);

  // Excel 日期序列值：1970-01-01 = 25569，2026-08-14 應為 46248。
  assert.match(cells[0], /<v>46248<\/v>/, `日期應寫入序列值，實際：${cells[0]}`);
  assert.ok(!/t="s"/.test(cells[0]), '日期不得以文字儲存');
  assert.ok(stylesXml.includes('yyyy-mm-dd'), '樣式表應包含 yyyy-mm-dd 的 numFmt');
});

test('xlsx：金額為數值欄位（非字串）並套用千分位格式', async () => {
  const { sheetXml, stylesXml } = await readXlsx(
    [['2026-08-14', 1234.56]],
    [{ header: '日期', type: 'date' }, { header: '金額', type: 'number' }],
  );
  const cells = cellsOf(rowXml(sheetXml, 2));

  assert.match(cells[1], /<v>1234\.56<\/v>/, `金額應寫入數值，實際：${cells[1]}`);
  assert.ok(!/t="s"/.test(cells[1]), '金額不得以文字儲存');
  assert.ok(stylesXml.includes('#,##0.00'), '樣式表應包含 #,##0.00 的 numFmt');
});

test('xlsx：Formula Injection 防護以 `\'` 前置且不使用公式儲存格', async () => {
  const dangerous = ['=1+1', '+1+1', '-1+1', '@SUM(A1)', "=cmd|' /c calc'!A0"];
  const rows: XlsxRow[] = dangerous.map((value) => [value]);
  const { buffer, sheetXml } = await readXlsx(rows, [{ header: '備註', type: 'text' }]);

  // 整份活頁簿不得出現任何公式元素。
  const zip = await JSZip.loadAsync(buffer);
  const sharedStrings = await zip.file('xl/sharedStrings.xml')!.async('string');
  assert.ok(!/<f[ >]/.test(sheetXml), 'xlsx 不得包含公式儲存格');

  dangerous.forEach((value, index) => {
    const cells = cellsOf(rowXml(sheetXml, index + 2));
    assert.equal(cells.length, 1);
    assert.match(cells[0], /t="s"/, `${value} 應以共享字串（文字）儲存`);
  });

  const escaped = dangerous.map(escapeFormulaText);
  for (const value of escaped) {
    // sharedStrings 只跳脫 & < >；撇號維持原樣。
    const encoded = value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    assert.ok(
      sharedStrings.includes(encoded),
      `sharedStrings 應包含已轉義的值 ${value}`,
    );
  }

  // 文字欄位需標記為文字格式，讓 Excel 不再重新解讀內容。
  assert.ok(
    stylesXmlHasTextFormat(await zip.file('xl/styles.xml')!.async('string')),
    '文字欄位應套用 @ 格式',
  );
});

function stylesXmlHasTextFormat(stylesXml: string): boolean {
  return /formatCode="@"/.test(stylesXml);
}

test('xlsx：一般文字不含 `\'` 前置且保持原值', async () => {
  const { buffer } = await readXlsx([['晚餐 -100']], [{ header: '備註', type: 'text' }]);
  const zip = await JSZip.loadAsync(buffer);
  const sharedStrings = await zip.file('xl/sharedStrings.xml')!.async('string');
  assert.ok(sharedStrings.includes('晚餐 -100'), '非公式開頭的文字應原樣輸出');
  assert.ok(!sharedStrings.includes("'晚餐 -100"), '非公式開頭的文字不應被前置撇號');
});

test('xlsx：空值不寫入儲存格，避免 Excel 出現 0 或空字串', async () => {
  const { sheetXml } = await readXlsx(
    [[null, '', Number.NaN, undefined, 0]],
    [
      { header: 'a', type: 'text' },
      { header: 'b', type: 'text' },
      { header: 'c', type: 'number' },
      { header: 'd', type: 'date' },
      { header: 'e', type: 'number' },
    ],
  );
  const cells = cellsOf(rowXml(sheetXml, 2));
  assert.equal(cells.length, 1, '只有 0 應寫入儲存格');
  assert.match(cells[0], /<v>0<\/v>/);
});

test('parseDateOnly：接受 YYYY-MM-DD 與 UTC 午夜 Date，拒絕無效日期', () => {
  assert.equal(parseDateOnly('2026-08-14')?.toISOString(), '2026-08-14T00:00:00.000Z');
  assert.equal(parseDateOnly(new Date(Date.UTC(2026, 7, 14)))?.toISOString(), '2026-08-14T00:00:00.000Z');
  // Date 以本地時區建立時，序列值須對應其 UTC 日期，不得再位移。
  assert.equal(parseDateOnly(new Date('2026-08-14T00:00:00.000Z'))?.getTime(), Date.UTC(2026, 7, 14));
  assert.equal(parseDateOnly('2026-02-30'), null, '不存在的日期不應被自動進位');
  assert.equal(parseDateOnly('2026-8-4'), null, '非補零格式不視為日期');
  assert.equal(parseDateOnly('not-a-date'), null);
  assert.equal(parseDateOnly(null), null);
  assert.equal(parseDateOnly(20260814), null);
  assert.equal(parseDateOnly(new Date('invalid')), null);
});

test('toNumeric：數值字串轉為 Number，空值與非有限數視為空', () => {
  assert.equal(toNumeric('1234.56'), 1234.56);
  assert.equal(toNumeric(0), 0);
  assert.equal(toNumeric('-5'), -5);
  assert.equal(toNumeric(''), null);
  assert.equal(toNumeric(null), null);
  assert.equal(toNumeric(undefined), null);
  assert.equal(toNumeric('abc'), null);
  assert.equal(toNumeric(Number.NaN), null);
  assert.equal(toNumeric(Number.POSITIVE_INFINITY), null);
});

test('escapeFormulaText：與 CSV 版一致，只針對公式開頭字元前置撇號', () => {
  assert.equal(escapeFormulaText('=SUM(A1)'), "'=SUM(A1)");
  assert.equal(escapeFormulaText('+1'), "'+1");
  assert.equal(escapeFormulaText('-1'), "'-1");
  assert.equal(escapeFormulaText('@x'), "'@x");
  assert.equal(escapeFormulaText('一般文字'), '一般文字');
  assert.equal(escapeFormulaText('金額 100'), '金額 100');
});

test('resolveExportFormat：僅 xlsx 走 Excel，其餘（含未提供）維持 CSV', () => {
  assert.equal(resolveExportFormat('xlsx'), 'xlsx');
  assert.equal(resolveExportFormat('csv'), 'csv');
  assert.equal(resolveExportFormat(null), 'csv');
  assert.equal(resolveExportFormat('XLSX'), 'csv', '大小寫不同視為無效值');
  assert.equal(resolveExportFormat('pdf'), 'csv');
});

test('xlsxFilename：帶日期後綴與 .xlsx 副檔名', () => {
  assert.equal(xlsxFilename('transactions', new Date(Date.UTC(2026, 9, 7))), 'transactions-20261007.xlsx');
});

test('sanitizeSheetName：套用 Excel 工作表命名限制', () => {
  assert.equal(sanitizeSheetName('交易記錄'), '交易記錄');
  assert.equal(sanitizeSheetName('a/b:c*d?e[f]g\\h'), 'a b c d e f g h');
  assert.equal(sanitizeSheetName(''), 'Sheet1');
  assert.equal(sanitizeSheetName('   '), 'Sheet1');
  assert.equal(sanitizeSheetName('x'.repeat(40)).length, 31);
});

test('buildSheetData：第一列為標題、其後為資料列', () => {
  const data = buildSheetData(
    [{ header: '日期', type: 'date' }, { header: '金額', type: 'number' }],
    [['2026-08-14', 100], ['2026-08-15', 200]],
  );
  assert.equal(data.length, 3);
  assert.equal((data[0][0] as { value: unknown }).value, '日期');
  assert.equal((data[2][1] as { value: unknown }).value, 200);
});

test('xlsx：串流輸出為有效 zip 內容', async () => {
  const { buffer } = await readXlsx([['2026-08-14', 1]], [
    { header: '日期', type: 'date' },
    { header: '金額', type: 'number' },
  ]);
  assert.ok(buffer.length > 0);
  assert.equal(buffer.subarray(0, 2).toString('utf8'), ZIP_MAGIC, 'xlsx 實為 zip 容器');
  assert.equal(
    XLSX_CONTENT_TYPE,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
});

test('xlsx：大量資料匯出仍為有效檔案且維持串流', async () => {
  const rows: XlsxRow[] = [];
  for (let i = 0; i < 20000; i += 1) {
    rows.push([`2026-08-14`, 100 + i, '備註 ' + i]);
  }
  const stream = await createXlsxStream({
    sheetName: 'S',
    columns: [
      { header: '日期', type: 'date' },
      { header: '金額', type: 'number' },
      { header: '備註', type: 'text' },
    ],
    rows,
  });

  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  const buffer = Buffer.concat(chunks);
  assert.equal(buffer.subarray(0, 2).toString('utf8'), ZIP_MAGIC);

  const zip = await JSZip.loadAsync(buffer);
  const sheetXml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
  // 標題列 + 20000 筆資料。
  assert.match(sheetXml, /<row r="20001"[ >]/, '應包含最後一筆資料列');
});
