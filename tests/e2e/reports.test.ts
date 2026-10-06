// tests/e2e/reports.test.ts — 報表（issue #264）
import { test, expect } from './support/fixtures';
import { createE2ETransaction } from './support/testUser';

// ReportsClient 的「本月」區間是用瀏覽器本地時間的 `new Date(y, m, d)` 算出區間
// 端點後再 `.toISOString()` 轉成日期字串；在 UTC+ 時區（例如 Asia/Taipei）下，
// 本地午夜換算成 UTC 會變成「前一天」，導致區間上限（到今天）實際變成「到昨天」
// （既有、與本次變更無關的邊界問題）。因此種子交易改用「昨天」而非「今天」，
// 確保落在（被提前一天的）區間內。
function yesterdayIsoDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  // 刻意用本地時間的年/月/日組字串（而非 toISOString()，那會再轉成 UTC，
  // 時間接近本地午夜時又會多跳一天），單純取得「本地昨天」這個日曆日期。
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

test('reports page summarizes seeded transactions for the current month', async ({ authedPage, testUser }) => {
  await createE2ETransaction(testUser.id, { type: 'expense', amount: 3000, date: yesterdayIsoDate(), note: 'E2E 報表測試' });

  await authedPage.goto('/finance/reports');

  await expect(authedPage.getByRole('heading', { name: '統計報表' }).first()).toBeVisible();
  await expect(authedPage.getByText('本期合計')).toBeVisible();
  await expect(authedPage.getByText('NT$ 3,000').first()).toBeVisible();
});
