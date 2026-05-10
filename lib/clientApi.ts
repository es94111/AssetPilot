// lib/clientApi.ts — 前端 API 呼叫工具（client-side only）

export async function apiFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, { credentials: 'include', ...options });
  if (res.status === 401) { window.location.href = '/login'; throw new Error('請先登入'); }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
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
