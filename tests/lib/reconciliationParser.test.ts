// tests/lib/reconciliationParser.test.ts — 銀行／券商對帳檔解析純函式測試。
//
// 涵蓋 issue #251 驗收條件：
//  - OFX 1.x（SGML，含省略葉標籤結尾）與 OFX 2.x（XML、命名空間前綴）解析
//  - 可設定的 CSV 欄位對應 profile（含自訂分隔符、日期格式、借貸分欄、信用卡語意）
//  - CSV UTF-8 BOM 與 Formula Injection 防護
// 不需資料庫；`npm test` 直接執行。
// 執行方式：node --experimental-transform-types --import tests/setup/register.mjs tests/lib/reconciliationParser.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';

const {
  parseOfx,
  parseOfxAmount,
  parseOfxDate,
  OfxParseError,
} = await import('../../lib/ofxParser.ts');
const {
  parseReconciliationCsv,
  parseReconciliationDate,
  parseReconciliationAmount,
  parseDelimited,
  neutralizeCsvFormula,
  ReconciliationCsvError,
} = await import('../../lib/csvReconciliationParser.ts');

// ── OFX 1.x：SGML，容器標籤有結尾、葉標籤常省略結尾 ──
const OFX_1X = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>TWD
<BANKACCTFROM>
<BANKID>012
<ACCTID>12345678901234
<ACCTTYPE>CHECKING
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260901120000
<DTEND>20260930120000
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260903120000
<TRNAMT>-1,250.00
<FITID>202609030001
<NAME>全聯福利中心
<MEMO>信用卡消費
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260905
<TRNAMT>30000.00
<FITID>202609050001
<NAME>薪資轉帳
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

// ── OFX 2.x：XML，含命名空間前綴與自閉合標籤 ──
const OFX_2X = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="220" SECURITY="NONE" OLDFILEUID="NONE" NEWFILEUID="NONE"?>
<ofx:OFX xmlns:ofx="http://ofx.net/types/2003/04">
  <ofx:CREDITCARDMSGSRSV1>
    <ofx:CCSTMTTRNRS>
      <ofx:CCSTMTRS>
        <ofx:CURDEF>TWD</ofx:CURDEF>
        <ofx:CCACCTFROM>
          <ofx:ACCTID>987654321</ofx:ACCTID>
        </ofx:CCACCTFROM>
        <ofx:BANKTRANLIST>
          <ofx:DTSTART>20260901000000</ofx:DTSTART>
          <ofx:DTEND>20260930000000</ofx:DTEND>
          <ofx:STMTTRN>
            <ofx:TRNTYPE>DEBIT</ofx:TRNTYPE>
            <ofx:DTPOSTED>20260908120000</ofx:DTPOSTED>
            <ofx:TRNAMT>880.00</ofx:TRNAMT>
            <ofx:FITID>CC20260908001</ofx:FITID>
            <ofx:NAME>線上購物</ofx:NAME>
          </ofx:STMTTRN>
          <ofx:STMTTRN>
            <ofx:TRNTYPE>CREDIT</ofx:TRNTYPE>
            <ofx:DTPOSTED>20260910000000</ofx:DTPOSTED>
            <ofx:TRNAMT>-120.00</ofx:TRNAMT>
            <ofx:FITID>CC20260910001</ofx:FITID>
            <ofx:MEMO>退款 &amp; 折讓</ofx:MEMO>
          </ofx:STMTTRN>
        </ofx:BANKTRANLIST>
      </ofx:CCSTMTRS>
    </ofx:CCSTMTTRNRS>
  </ofx:CREDITCARDMSGSRSV1>
</ofx:OFX>`;

// ── OFX 券商投資對帳單（含被略過的 TRANSFER）──
const OFX_INVESTMENT = `OFXHEADER:100
DATA:OFXSGML
VERSION:103

<OFX>
<INVSTMTMSGSRSV1>
<INVSTMTTRNRS>
<INVSTMTRS>
<CURDEF>TWD
<INVACCTFROM>
<BROKERID>testbroker
<ACCTID>A1234567
</INVACCTFROM>
<INVTRANLIST>
<DTSTART>20260901
<DTEND>20260930
<BUYSTOCK>
<INVBUY>
<INVTRAN>
<FITID>INV-BUY-1
<DTTRADE>20260902
<MEMO>買進台積電
</INVTRAN>
<SECID><UNIQUEID>2330</UNIQUEID><UNIQUEIDTYPE>TICKER</UNIQUEIDTYPE></SECID>
<UNITS>1000
<TOTAL>-550000.00
<SUBACCTSEC>CASH
</INVBUY>
</BUYSTOCK>
<INCOME>
<INVTRAN>
<FITID>INV-DIV-1
<DTTRADE>20260915
<MEMO>現金股利
</INVTRAN>
<SECID><UNIQUEID>2330</UNIQUEID></SECID>
<TOTAL>2000.00
<INCOMETYPE>DIV
</INCOME>
<TRANSFER>
<INVTRAN>
<FITID>INV-TRF-1
<DTTRADE>20260920
</INVTRAN>
</TRANSFER>
<INVBANKTRAN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260925
<TRNAMT>-30.00
<FITID>INV-FEE-1
<MEMO>保管費
</STMTTRN>
</INVBANKTRAN>
</INVTRANLIST>
</INVSTMTRS>
</INVSTMTTRNRS>
</INVSTMTMSGSRSV1>
</OFX>`;

test('OFX 1.x (SGML)：解析銀行對帳單的日期、金額正負號與交易摘要', () => {
  const result = parseOfx(OFX_1X);
  assert.equal(result.version, 1);
  assert.deepEqual(result.kinds, ['bank']);
  assert.deepEqual(result.accounts, ['12345678901234']);
  assert.equal(result.currency, 'TWD');
  assert.equal(result.periodStart, '2026-09-01');
  assert.equal(result.periodEnd, '2026-09-30');
  assert.equal(result.transactions.length, 2);

  const [debit, credit] = result.transactions;
  assert.equal(debit.direction, 'debit');
  assert.equal(debit.amount, 1250);
  assert.equal(debit.date, '2026-09-03');
  assert.equal(debit.fitid, '202609030001');
  assert.equal(debit.typeCode, 'DEBIT');
  assert.equal(debit.description, '全聯福利中心 — 信用卡消費');

  assert.equal(credit.direction, 'credit');
  assert.equal(credit.amount, 30000);
  assert.equal(credit.date, '2026-09-05');
  assert.equal(credit.description, '薪資轉帳');

  assert.equal(result.dateFrom, '2026-09-03');
  assert.equal(result.dateTo, '2026-09-05');
});

test('OFX 2.x (XML)：解析命名空間前綴並套用信用卡金額語意', () => {
  const result = parseOfx(OFX_2X);
  assert.equal(result.version, 2);
  assert.deepEqual(result.kinds, ['credit_card']);
  assert.deepEqual(result.accounts, ['987654321']);
  assert.equal(result.transactions.length, 2);

  const [purchase, refund] = result.transactions;
  // 信用卡帳單：TRNAMT 正值為消費（debit），負值為退款（credit）。
  assert.equal(purchase.direction, 'debit');
  assert.equal(purchase.amount, 880);
  assert.equal(purchase.fitid, 'CC20260908001');
  assert.equal(refund.direction, 'credit');
  assert.equal(refund.amount, 120);
  // XML 實體必須解碼，否則摘要會出現 &amp; 字樣。
  assert.equal(refund.description, '退款 & 折讓');
});

test('OFX 券商對帳單：買進為支出、股利為收入，並計數略過的移轉交易', () => {
  const result = parseOfx(OFX_INVESTMENT);
  assert.deepEqual(result.kinds, ['investment']);
  assert.equal(result.skippedTypes.TRANSFER, 1);

  const buy = result.transactions.find((tx) => tx.fitid === 'INV-BUY-1');
  assert.ok(buy, '買進交易必須被解析');
  assert.equal(buy.direction, 'debit');
  assert.equal(buy.amount, 550000);
  assert.equal(buy.typeCode, 'BUYSTOCK');
  assert.equal(buy.securityId, '2330');
  assert.equal(buy.units, 1000);

  const dividend = result.transactions.find((tx) => tx.fitid === 'INV-DIV-1');
  assert.ok(dividend, '股利交易必須被解析');
  assert.equal(dividend.direction, 'credit');
  assert.equal(dividend.amount, 2000);
  assert.equal(dividend.typeCode, 'INCOME');

  const fee = result.transactions.find((tx) => tx.fitid === 'INV-FEE-1');
  assert.ok(fee, 'INVTRANLIST 內的現金流交易必須被解析');
  assert.equal(fee.direction, 'debit');
  assert.equal(fee.amount, 30);
});

test('OFX 解析錯誤：非 OFX 內容與缺少帳戶聲明皆須拋出可讀錯誤', () => {
  assert.throws(() => parseOfx('date,amount\n2026-01-01,100'), OfxParseError);
  assert.throws(() => parseOfx('<OFX>\n<SIGNONMSGSRSV1></SIGNONMSGSRSV1>\n</OFX>'), OfxParseError);
  assert.throws(() => parseOfx('   '), OfxParseError);
});

test('OFX 數值與日期邊界：千分位、貨幣符號、非法日期一律回傳安全值', () => {
  assert.equal(parseOfxAmount('-1,250.00'), -1250);
  assert.equal(parseOfxAmount('$1,000'), 1000);
  assert.equal(parseOfxAmount('-€99.5'), -99.5);
  assert.equal(parseOfxAmount('abc'), Number.NaN);
  assert.equal(parseOfxAmount(''), Number.NaN);
  assert.equal(parseOfxAmount('Infinity'), Number.NaN);

  assert.equal(parseOfxDate('20260903120000'), '2026-09-03');
  assert.equal(parseOfxDate('20260903'), '2026-09-03');
  assert.equal(parseOfxDate('20261303'), '');
  assert.equal(parseOfxDate('20260230'), '');
  assert.equal(parseOfxDate(''), '');
});

// ── CSV 欄位對應 profile ──

test('CSV profile：自訂欄位名稱、日期格式與千分位金額', () => {
  const csv = [
    '交易日期,摘要,金額,FITID',
    '2026/09/03,全聯福利中心,"-1,250",B001',
    '2026/09/05,薪資轉帳,"30,000",B002',
  ].join('\n');
  const result = parseReconciliationCsv(csv, {
    dateFormat: 'YYYY/MM/DD',
    columns: { date: '交易日期', amount: '金額', description: '摘要', fitid: 'FITID' },
  });

  assert.equal(result.errors.length, 0);
  assert.equal(result.rows.length, 2);
  assert.equal(result.missingColumns.length, 0);
  assert.deepEqual(result.profile.columns.date, '交易日期');

  assert.equal(result.rows[0].date, '2026-09-03');
  assert.equal(result.rows[0].amount, 1250);
  assert.equal(result.rows[0].direction, 'debit');
  assert.equal(result.rows[0].line, 2);
  assert.equal(result.rows[1].direction, 'credit');
  assert.equal(result.rows[1].amount, 30000);
});

test('CSV profile：借貸分欄、自訂分隔符、略過前導列', () => {
  const csv = [
    '帳戶對帳單明細（測試銀行）',
    '日期;摘要;借方;貸方',
    '2026-09-03;電費;1,500;',
    '2026-09-05;退款;;200',
    '2026-09-06;轉帳手續費;15;',
  ].join('\n');
  const result = parseReconciliationCsv(csv, {
    delimiter: ';',
    skipRows: 1,
    columns: { date: '日期', debit: '借方', credit: '貸方', description: '摘要' },
  });

  assert.equal(result.rows.length, 3);
  assert.equal(result.rows[0].direction, 'debit');
  assert.equal(result.rows[0].amount, 1500);
  assert.equal(result.rows[0].line, 3);
  assert.equal(result.rows[1].direction, 'credit');
  assert.equal(result.rows[1].amount, 200);
  assert.equal(result.rows[2].direction, 'debit');
  assert.equal(result.rows[2].amount, 15);
});

test('CSV profile：信用卡語意（正值為消費）與無 FITID 時推導穩定識別碼', () => {
  const csv = ['date,amount,description', '2026-09-08,880,線上購物', '2026-09-10,-120,退款'].join('\n');
  const result = parseReconciliationCsv(csv, {
    amountSign: 'credit_card',
    columns: { date: 'date', amount: 'amount', description: 'description' },
  });

  assert.equal(result.rows[0].direction, 'debit');
  assert.equal(result.rows[1].direction, 'credit');
  assert.match(result.rows[0].fitid, /^csv\|2026-09-08\|debit\|880\.00\|線上購物$/);
  assert.match(result.rows[1].fitid, /^csv\|2026-09-10\|credit\|120\.00\|退款$/);
  // 相同內容必須得到相同識別碼（可重複匯入時穩定）。
  const repeat = parseReconciliationCsv(csv, {
    amountSign: 'credit_card',
    columns: { date: 'date', amount: 'amount', description: 'description' },
  });
  assert.equal(repeat.rows[0].fitid, result.rows[0].fitid);
});

test('CSV UTF-8 BOM：去除 BOM 後第一個標題仍能對應', () => {
  const csv = '\uFEFFdate,amount,description\n2026-09-03,-1250,全聯福利中心';
  const result = parseReconciliationCsv(csv, {
    columns: { date: 'date', amount: 'amount', description: 'description' },
  });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].date, '2026-09-03');
  assert.equal(result.rows[0].amount, 1250);
  assert.equal(result.missingColumns.length, 0);
});

test('CSV Formula Injection：還原自家匯出的單引號前綴並移除其餘危險開頭', () => {
  // 匯出端（lib/auditHelpers.ts csvCell）對危險開頭補上單引號前綴。
  assert.equal(neutralizeCsvFormula("'=1+1"), '=1+1');
  assert.equal(neutralizeCsvFormula("'+SUM(A1)"), '+SUM(A1)');
  assert.equal(neutralizeCsvFormula("'-2"), '-2');
  assert.equal(neutralizeCsvFormula("'@cmd"), '@cmd');
  // 第三方檔案的危險開頭則移除該字元，避免再匯出時被試算表當成公式。
  assert.equal(neutralizeCsvFormula('=HYPERLINK("http://evil")'), 'HYPERLINK("http://evil")');
  assert.equal(neutralizeCsvFormula('@SUM(1)'), 'SUM(1)');
  // 前置 Tab 是常見的繞過手法：剝除控制字元後仍須移除公式起始字元。
  assert.equal(neutralizeCsvFormula('\t=1+1'), '1+1');
  assert.equal(neutralizeCsvFormula('一般摘要'), '一般摘要');

  const csv = ['date,amount,description', '2026-09-03,-1250,"=cmd|\' /c calc\'!A0"'].join('\n');
  const result = parseReconciliationCsv(csv, {
    columns: { date: 'date', amount: 'amount', description: 'description' },
  });
  assert.equal(result.rows[0].description.startsWith('='), false);
  assert.equal(result.rows[0].description, 'cmd|\' /c calc\'!A0');
});

test('CSV 解析錯誤：缺少欄位、金額欄衝突、逐列錯誤會被收集而不中斷', () => {
  assert.throws(
    () => parseReconciliationCsv('a,b\n1,2', { columns: { date: 'a' } as never }),
    ReconciliationCsvError,
  );
  assert.throws(
    () => parseReconciliationCsv('a,b,c\n1,2,3', {
      columns: { date: 'a', amount: 'b', debit: 'c' },
    }),
    ReconciliationCsvError,
  );
  assert.throws(
    () => parseReconciliationCsv('date,amount\n2026-01-01,1', {
      columns: { date: 'date', amount: 'missing' },
    }),
    ReconciliationCsvError,
  );

  const csv = ['date,amount', '2026-09-03,-1250', 'not-a-date,100', '2026-09-05,abc'].join('\n');
  const result = parseReconciliationCsv(csv, { columns: { date: 'date', amount: 'amount' } });
  assert.equal(result.rows.length, 1);
  assert.equal(result.errors.length, 2);
  assert.equal(result.errors[0].line, 3);
  assert.equal(result.errors[1].line, 4);
});

test('CSV 語法：引號內含分隔符與換行、CRLF 正規化、空行忽略', () => {
  const rows = parseDelimited('a,b\r\n"x,y","line1\nline2"\r\n\r\n1,2\r\n');
  assert.deepEqual(rows, [
    ['a', 'b'],
    ['x,y', 'line1\nline2'],
    ['1', '2'],
  ]);
});

test('CSV 日期與金額邊界：多格式自動判定、會計負數、零金額視為錯誤', () => {
  assert.equal(parseReconciliationDate('2026-09-03'), '2026-09-03');
  assert.equal(parseReconciliationDate('20260903'), '2026-09-03');
  assert.equal(parseReconciliationDate('2026年9月3日'), '2026-09-03');
  assert.equal(parseReconciliationDate('2026/09/03'), '2026-09-03');
  assert.equal(parseReconciliationDate('09/03/2026'), '2026-09-03');
  assert.equal(parseReconciliationDate('2026-13-01'), '');
  assert.equal(parseReconciliationDate('31/31/2026'), '');
  assert.equal(parseReconciliationDate('', 'YYYY-MM-DD'), '');

  assert.equal(parseReconciliationAmount('-1,250.00'), -1250);
  assert.equal(parseReconciliationAmount('(2,500)'), -2500);
  assert.equal(parseReconciliationAmount('$30,000'), 30000);
  assert.equal(Number.isNaN(parseReconciliationAmount('0')), true);
  assert.equal(Number.isNaN(parseReconciliationAmount('')), true);
  assert.equal(Number.isNaN(parseReconciliationAmount('1.2.3')), true);

  const csv = ['date,amount', '2026-09-03,0', '2026-09-04,-1'].join('\n');
  const result = parseReconciliationCsv(csv, { columns: { date: 'date', amount: 'amount' } });
  assert.equal(result.rows.length, 1);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].reason, /金額無法解析/);
});
