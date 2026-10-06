// tests/e2e/support/theme.ts — 強制淺色／深色主題（供視覺回歸與無障礙測試使用）
//
// App 的主題切換邏輯（lib/themeScript.ts）在 <head> inline script 中讀取
// localStorage 的 'theme'（'light' | 'dark' | 'system'）並切換 `.dark-mode`
// class，於 hydration 前就執行以避免閃爍。用 addInitScript 在任何頁面腳本
// 執行前寫入 localStorage，可在導覽前就決定好主題，不需要透過 UI 切換，
// 結果穩定可重現。
import type { Page } from '@playwright/test';

export type ThemeMode = 'light' | 'dark';

export async function forceTheme(page: Page, theme: ThemeMode): Promise<void> {
  await page.addInitScript((value) => {
    try {
      window.localStorage.setItem('theme', value);
    } catch {
      // localStorage 可能在極少數環境被封鎖；忽略即可，僅影響主題預設值。
    }
  }, theme);
}
