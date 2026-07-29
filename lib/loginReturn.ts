export function safeOAuthReturnTo(value: unknown): string {
  if (typeof value !== 'string' || value.length > 8192 || !value.startsWith('/') || value.startsWith('//')) return '';
  try {
    const parsed = new URL(value, 'https://assetpilot.invalid');
    if (parsed.origin !== 'https://assetpilot.invalid' || parsed.pathname !== '/oauth/authorize') return '';
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return '';
  }
}
