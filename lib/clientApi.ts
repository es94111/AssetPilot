// lib/clientApi.ts — 前端 API 呼叫工具（client-side only）

export async function apiFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, { credentials: 'include', ...options });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('請先登入'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/**
 * 判斷錯誤是否為「連線層失敗」而非伺服器拒絕（007-pwa-offline-entry）。
 *
 * 以錯誤型別為主要判準：fetch 在離線／DNS 失敗／連線中斷時會 reject 一個
 * TypeError（訊息如 "Failed to fetch"），而 apiFetch 對非 2xx 會拋出一般 Error。
 * 因此 TypeError 一律視為連線問題。
 *
 * `navigator.onLine === false` 只作為次級提示，且僅在錯誤不是「伺服器回應」時採用：
 * navigator.onLine 並不可靠（LAN-only／captive portal／VPN 常誤報離線），若讓它
 * 覆蓋伺服器實際回傳的驗證錯誤（例如 400／409），使用者會看不到真正原因，交易卻被
 * 當成離線項目送往佇列。伺服器回應的錯誤帶有 HTTP 狀態訊息，故明確排除。
 */
export function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError) return true;
  // apiFetch 對非 2xx 拋出一般 Error；帶有「HTTP <code>」或伺服器訊息者不是連線問題。
  if (error instanceof Error && /^HTTP \d{3}$/.test(error.message)) return false;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    // 仍可能是連線層失敗（fetch 逾時等），但已排除伺服器明確回應的情形。
    return true;
  }
  return false;
}

export async function apiGet(url: string) {
  return apiFetch(url, { cache: 'no-store' });
}

export async function apiPost(url: string, body?: any) {
  return apiFetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

export async function apiPut(url: string, body?: any) {
  return apiFetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

export async function apiDelete(url: string) {
  return apiFetch(url, { method: 'DELETE' });
}

export async function apiPatch(url: string, body?: any) {
  return apiFetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

export const DATA_CHANGED_EVENT = 'assetpilot:data-changed';

export function notifyDataChanged(scope: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(DATA_CHANGED_EVENT, { detail: { scope } }));
}

/** 格式化金額 */
export function fmtMoney(n: number | string, currency = 'TWD') {
  const num = Math.round(Number(n) || 0);
  if (currency === 'TWD') return 'NT$ ' + num.toLocaleString('zh-TW');
  return num.toLocaleString('zh-TW') + ' ' + currency;
}

/** 格式化數字 */
export function fmtNum(n: number | string, decimals = 2) {
  return (Number(n) || 0).toFixed(decimals);
}
