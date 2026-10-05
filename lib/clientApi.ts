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
 * fetch 在離線／DNS 失敗／連線中斷時會 reject 一個 TypeError（訊息如
 * "Failed to fetch"），與 apiFetch 針對非 2xx 拋出的 Error 不同：
 * 前者適合改走離線佇列，後者（驗證錯誤）必須讓使用者看到並修正。
 */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
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
