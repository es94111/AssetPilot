// lib/memoryStorePrune.ts — in-memory 帶 TTL Map 的過期清掃
//
// 安全背景：OAuth state、passkey challenge、auth ticket 等 in-memory store 的
// 過期 entry 原本只在「同一個 key 再被存取」時才會刪除；長期運行的程序中，
// 未再被存取的過期 entry 會持續累積（記憶體緩慢洩漏）。此工具提供定期清掃。
//
// 注意：Edge runtime 無 setInterval；proxy.ts 的限流 Map 由 rateLimit.ts 的
// 容量上限保護。本模組供 Node runtime 的 lib 模組使用。

const timers = new Set<ReturnType<typeof setInterval>>();

const PRUNE_TIMER_KEY = Symbol.for('assetpilot.pruneTimer') as unknown as any;

/**
 * 為一個 Map 註冊定期清掃。同一個 Map 重複註冊不會產生多個 timer。
 * @returns 清除函式（測試用）
 */
export function registerTtlMapPrune<K, V>(
  map: Map<K, V>,
  isExpired: (value: V) => boolean,
  intervalMs = 5 * 60 * 1000,
): () => void {
  const existing = map.get(PRUNE_TIMER_KEY as K);
  if (existing) return () => {};

  const timer = setInterval(() => {
    try {
      for (const [key, value] of map) {
        if (isExpired(value)) map.delete(key);
      }
    } catch (_) {
      // 清掃失敗不影響服務
    }
  }, intervalMs);
  // 不阻擋程序結束
  if (typeof timer === 'object' && timer !== null && 'unref' in timer) {
    (timer as { unref?: () => void }).unref?.();
  }
  timers.add(timer);

  const cleanup = () => {
    clearInterval(timer);
    timers.delete(timer);
    map.delete(PRUNE_TIMER_KEY as K);
  };
  // 以 symbol key 記錄，避免汙染正常 key 空間（僅用於防重複註冊）
  map.set(PRUNE_TIMER_KEY as K, timer as unknown as V);
  return cleanup;
}

/** 測試後清理所有 timer */
export function clearAllTtlMapTimers(): void {
  for (const timer of timers) clearInterval(timer);
  timers.clear();
}