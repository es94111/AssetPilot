// tests/e2e/support/a11y.ts — 無障礙檢測共用輔助函式（axe-core）
//
// 驗收條件：「無障礙檢測（axe）納入 CI，重大違規視為失敗」。
// impact 為 critical／serious 的違規視為失敗；moderate／minor 僅記錄於報表附件，
// 不會讓測試失敗，避免過於嚴苛導致既有 UI 大量小瑕疵阻擋 CI。
import AxeBuilder from '@axe-core/playwright';
import type { Page, TestInfo } from '@playwright/test';

const BLOCKING_IMPACTS = new Set(['critical', 'serious']);

export async function assertNoSeriousA11yViolations(
  page: Page,
  testInfo: TestInfo,
  label: string,
): Promise<void> {
  const results = await new AxeBuilder({ page })
    // Turnstile/Google 等第三方 widget 於測試環境未啟用，無需掃描。
    .exclude('[data-nosnippet="third-party"]')
    .analyze();

  if (results.violations.length > 0) {
    await testInfo.attach(`axe-violations-${label}.json`, {
      body: JSON.stringify(results.violations, null, 2),
      contentType: 'application/json',
    });
  }

  const blocking = results.violations.filter((violation) => BLOCKING_IMPACTS.has(violation.impact || ''));
  if (blocking.length > 0) {
    const summary = blocking
      .map((violation) => `- [${violation.impact}] ${violation.id}: ${violation.help} (${violation.nodes.length} node(s))`)
      .join('\n');
    throw new Error(`「${label}」存在重大無障礙違規（critical/serious）：\n${summary}`);
  }
}
