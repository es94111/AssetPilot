// tests/e2e/reports.test.ts — 報表（issue #264）
import { test, expect } from './support/fixtures';
import { createE2ETransaction } from './support/testUser';

// ReportsClient 的「本月」等預設區間是用瀏覽器本地時間的 `new Date(y, m, d)`
// 算出端點後再 `.toISOString()` 轉成日期字串；在 UTC+ 時區下，本地午夜換算成
// UTC 會變成「前一天」，使區間上限實際變成「到昨天」（既有、與本次變更無關的
// 邊界問題）。改用「自訂區間」並直接帶入種子交易當天的日期字串
// （`new Date('YYYY-MM-DD')` 一律以 UTC 午夜解析，不受本地時區影響），完全
// 避開這個問題，也不受「月初測試可能落到上個月」這類日期邊界影響。
function todayIsoDate(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test('reports page summarizes seeded transactions for the current month', async ({ authedPage, testUser }) => {
  const seedDate = todayIsoDate();
  await createE2ETransaction(testUser.id, { type: 'expense', amount: 3000, date: seedDate, note: 'E2E 報表測試' });

  await authedPage.goto('/finance/reports');
  await expect(authedPage.getByRole('heading', { name: '統計報表' }).first()).toBeVisible();

  await authedPage.getByLabel('期間').selectOption({ label: '自訂' });
  await authedPage.getByLabel('開始').fill(seedDate);
  await authedPage.getByLabel('結束').fill(seedDate);

  await expect(authedPage.getByText('本期合計')).toBeVisible();
  await expect(authedPage.getByText('NT$ 3,000').first()).toBeVisible();
});
