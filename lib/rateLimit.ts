// lib/rateLimit.ts — in-memory 每 IP 速率限制（Edge runtime 相容，零相依）
//
// 安全設計：限流 Map 以客戶端 IP 為 key。若攻擊者以大量偽造 IP 請求（直連未經代理時
// 可能發生），Map 會無限成長造成記憶體耗盡。因此：
//   1. 達到上限時先清掃已過期的 entry；
//   2. 仍超限則整體清空（短暫公平性損失，換取服務存活）。

export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/** 每個限流 Map 的最大 entry 數（超過即觸發清掃／清空保護）。 */
export const MAX_RATE_LIMIT_ENTRIES = 100_000;

export function checkRateLimit(
  map: Map<string, RateLimitEntry>,
  ip: string,
  max: number,
  windowMs = 15 * 60 * 1000,
  now: number = Date.now(),
): boolean {
  if (map.size >= MAX_RATE_LIMIT_ENTRIES) {
    for (const [key, entry] of map) {
      if (now > entry.resetAt) map.delete(key);
    }
    if (map.size >= MAX_RATE_LIMIT_ENTRIES) map.clear();
  }

  let entry = map.get(ip);
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + windowMs };
    map.set(ip, entry);
  }
  entry.count += 1;
  return entry.count <= max;
}