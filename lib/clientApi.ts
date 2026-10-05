// lib/clientApi.ts — 前端 API 呼叫工具（client-side only）

export async function apiFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, { credentials: 'include', ...options });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('請先登入'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

/**
 * 只把 fetch 的連線層錯誤分類為可進離線佇列。
 *
 * 不以 `navigator.onLine` 判斷：該屬性在 LAN-only、VPN、captive portal 等情境常不可靠，
 * 若伺服器已回覆 4xx 但瀏覽器仍回報 offline，會把驗證失敗誤當成已儲存的離線交易。
 * 原生 fetch 的網路／DNS／離線失敗會 reject `TypeError`；HTTP 非 2xx 則由 apiFetch
 * 拋出一般 `Error`，必須讓使用者看到真正的伺服器訊息。
 */
export function isNetworkError(error: unknown): boolean {
  return error instanceof TypeError;
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
