// lib/userActive.ts — 帳號啟用狀態的共用判斷（零相依）
//
// 刻意獨立於 lib/apiHelpers.ts：mcpAuth.ts 等模組（供 MCP server / 非
// Next.js route handler 情境使用）不應為了這一個判斷式而連帶引入
// apiHelpers.ts → lib/auth.ts → next/headers 這條較重的相依鏈。

// 帳號啟用狀態一律 fail-closed：僅明確等於啟用值（1 / '1' / true）才視為啟用中，
// null/undefined/0 等其餘情況一律視為已停用，避免遺漏檢查造成停用帳號仍可存取。
export function isActiveUserFlag(value: unknown): boolean {
  return value === 1 || value === "1" || value === true;
}
