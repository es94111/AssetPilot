// 登入後只允許返回這些站內目的地：MCP 授權頁，以及「一鍵匯入 NouriLedger」的 authorize 步驟
// （它會把已登入的使用者導向 NouriLedger）。
const ALLOWED_RETURN_PATHS = new Set(['/oauth/authorize', '/api/migration/nouriledger/authorize']);

export function safeOAuthReturnTo(value: unknown): string {
  if (typeof value !== 'string' || value.length > 8192 || !value.startsWith('/') || value.startsWith('//')) return '';
  try {
    const parsed = new URL(value, 'https://assetpilot.invalid');
    if (parsed.origin !== 'https://assetpilot.invalid' || !ALLOWED_RETURN_PATHS.has(parsed.pathname)) return '';
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return '';
  }
}
