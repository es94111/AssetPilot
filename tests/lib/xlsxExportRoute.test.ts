// tests/lib/xlsxExportRoute.test.ts — 匯出端點 CSV／XLSX 雙格式（issue #261）
//
// 需要真實 PostgreSQL（DATABASE_URL/POSTGRES_URL）；未設定時略過，
// 保持 `npm test` 在無 DB 環境下仍可通過（比照 tests/lib/stockHelpers.test.ts）。
//
// 驗收條件對應：
//   - 匯出頁可選擇 CSV 或 XLSX（同一端點 ?format=xlsx）
//   - 匯出操作寫入稽核日誌（CSV 與 XLSX 兩條路徑都要有，且標明格式）
//
// 執行方式：node --experimental-transform-types --import ./tests/setup/register.mjs tests/lib/xlsxExportRoute.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import JSZip from 'jszip';

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  test('xlsxExportRoute（略過：未設定 DATABASE_URL/POSTGRES_URL，需搭配 PostgreSQL 執行完整驗證）', () => {});
} else {
  test('xlsx 匯出端點：CSV／XLSX 雙格式與稽核', async (t) => {
  const { initDB, getDB, queryAll } = await import('../../lib/db.ts');
  const { uid } = await import('../../lib/userDefaults.ts');
  const { createLoginSession } = await import('../../lib/sessionHelpers.ts');
  const { NextRequest } = await import('next/server');
  const transactionsExport = await import('../../app/api/transactions/export/route.ts');
  const accountsExport = await import('../../app/api/accounts/export/route.ts');
  const categoriesExport = await import('../../app/api/categories/export/route.ts');

  await initDB();
  const db = getDB();

  const userId = `test_xlsxexport_${uid()}`;
  const token = createLoginSession(userId, 0, {}).token;

  function request(path: string) {
    return new NextRequest(`http://localhost${path}`, {
      headers: { Cookie: `authToken=${token}` },
    });
  }

  function cleanup() {
    db.run('DELETE FROM transactions WHERE user_id = ?', [userId]);
    db.run('DELETE FROM accounts WHERE user_id = ?', [userId]);
    db.run('DELETE FROM categories WHERE user_id = ?', [userId]);
    db.run('DELETE FROM data_operation_audit_log WHERE user_id = ?', [userId]);
    db.run('DELETE FROM users WHERE id = ?', [userId]);
  }

  try {
    db.run(
      'INSERT INTO users (id,email,password_hash,display_name,created_at,is_admin) VALUES (?,?,?,?,?,?)',
      [userId, `${userId}@example.com`, 'disabled', 'xlsx export test', new Date().toISOString(), 0],
    );
    // 含公式開頭備註與小數金額，驗證型別與防護在真實資料流下仍成立。
    const unsafeNote = "=cmd|' /c calc'!A0";
    getDB().run(
      'INSERT INTO transactions (id,user_id,type,amount,currency,date,note) VALUES (?,?,?,?,?,?,?)',
      [uid(), userId, 'expense', 1234.56, 'TWD', '2026-08-14', unsafeNote],
    );
    getDB().run(
      'INSERT INTO accounts (id,user_id,name,initial_balance,currency,created_at) VALUES (?,?,?,?,?,?)',
      [uid(), userId, '現金', 5000.5, 'TWD', '2026-08-14'],
    );

    async function assertXlsxResponse(res: Response, expectedFilename: RegExp) {
      assert.equal(res.status, 200);
      assert.equal(
        res.headers.get('Content-Type'),
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      assert.match(res.headers.get('Content-Disposition') || '', expectedFilename);
      const buffer = Buffer.from(await res.arrayBuffer());
      assert.equal(buffer.subarray(0, 2).toString('utf8'), 'PK');
      const zip = await JSZip.loadAsync(buffer);
      return zip;
    }

    await t.test('交易匯出：?format=xlsx 回傳 Excel，含標題、日期與金額型別、公式防護', async () => {
      const res = await transactionsExport.GET(request('/api/transactions/export?format=xlsx'));
      const zip = await assertXlsxResponse(res, /filename="transactions-\d{8}\.xlsx"/);

      const sheetXml = await zip.file('xl/worksheets/sheet1.xml')!.async('string');
      const sharedStrings = await zip.file('xl/sharedStrings.xml')!.async('string');
      const stylesXml = await zip.file('xl/styles.xml')!.async('string');

      assert.ok(!/<f[ >]/.test(sheetXml), '不得輸出公式儲存格');
      assert.ok(sharedStrings.includes('日期') && sharedStrings.includes('金額'), '第一列應為欄位標題');
      assert.ok(
        sharedStrings.includes("'=cmd|' /c calc'!A0"),
        '公式開頭備註應前置撇號後以文字儲存',
      );
      // 日期欄以 Excel 序列值 46248（2026-08-14）寫入，金額欄為數值。
      assert.match(sheetXml, /<row r="2"[^>]*>[\s\S]*?<v>46248<\/v>/, '日期應為日期型別');
      assert.match(sheetXml, /<v>1234\.56<\/v>/, '金額應為數值型別');
      assert.ok(stylesXml.includes('yyyy-mm-dd'), '日期應套用日期格式');
      assert.ok(/formatCode="@"/.test(stylesXml), '文字欄位應套用文字格式');
    });

    await t.test('交易匯出：未帶 format 時維持 CSV 行為（BOM 與 text/csv）', async () => {
      const res = await transactionsExport.GET(request('/api/transactions/export'));
      assert.equal(res.status, 200);
      assert.match(res.headers.get('Content-Type') || '', /^text\/csv/);
      assert.match(res.headers.get('Content-Disposition') || '', /filename="transactions-\d{8}\.csv"/);

      // 以原始位元組檢查 UTF-8 BOM（Response.text() 會把 BOM 解碼掉）。
      const buffer = Buffer.from(await res.arrayBuffer());
      assert.equal(buffer.subarray(0, 3).toString('hex'), 'efbbbf', 'CSV 應保留 UTF-8 BOM');
      const text = buffer.toString('utf8');
      assert.ok(text.includes("'=cmd|' /c calc'!A0"), 'CSV 應保留既有 Formula Injection 防護');
    });

    await t.test('匯出稽核：CSV 與 XLSX 兩條路徑都寫入且標明格式', async () => {
      const rows = queryAll(
        "SELECT metadata FROM data_operation_audit_log WHERE user_id = ? AND action = 'export_transactions' ORDER BY timestamp ASC",
        [userId],
      );
      assert.ok(rows.length >= 2, `應有 CSV 與 XLSX 兩筆稽核，實際 ${rows.length}`);
      const formats = rows.map((row) => String(row.metadata)).filter((m) => m.includes('"format"'));
      assert.ok(formats.some((m) => m.includes('"format":"csv"')), 'CSV 稽核應標明 format=csv');
      assert.ok(formats.some((m) => m.includes('"format":"xlsx"')), 'XLSX 稽核應標明 format=xlsx');
      assert.ok(
        formats.some((m) => m.includes('.xlsx') && m.includes('"filename"')),
        'XLSX 稽核應記錄檔名',
      );
    });

    await t.test('帳戶與分類匯出：亦支援 ?format=xlsx', async () => {
      const accountRes = await accountsExport.GET(request('/api/accounts/export?format=xlsx'));
      await assertXlsxResponse(accountRes, /filename="accounts-\d{8}\.xlsx"/);

      const categoryRes = await categoriesExport.GET(request('/api/categories/export?format=xlsx'));
      await assertXlsxResponse(categoryRes, /filename="categories-\d{8}\.xlsx"/);
    });

    await t.test('無效 format 值回退 CSV，不會產生非預期格式', async () => {
      const res = await accountsExport.GET(request('/api/accounts/export?format=pdf'));
      assert.match(res.headers.get('Content-Type') || '', /^text\/csv/);
    });
  } finally {
    cleanup();
    // Postgres worker thread 不會自動結束行程，測試結束後需顯式關閉，否則行程會無限期掛著。
    db.close();
  }
  });
}
