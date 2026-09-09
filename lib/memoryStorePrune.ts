// lib/memoryStorePrune.ts — in-memory 帶 TTL Map 的請求期間清掃
//
// OAuth state、passkey challenge、auth ticket 等 in-memory store 的
// 過期 entry 原本只在「同一個 key 再被存取」時才會刪除；長期運行的程序中，
// 未再被存取的過期 entry 會持續累積（記憶體緩慢洩漏）。各 store 本身已在
// issue/consume 時清掃；這裡只保留註冊介面，不建立常駐 timer。
//
// 這樣可避免純記憶體維護工作在沒有使用者時仍於伺服器背景執行。

const registeredMaps = new Set();

/**
 * 為一個 Map 註冊請求期間清掃的狀態。同一個 Map 重複註冊不會重複登記。
 * @returns 清除函式（測試用）
 */
export function registerTtlMapPrune<K, V>(
  map: Map<K, V>,
  isExpired: (value: V) => boolean,
  intervalMs = 5 * 60 * 1000,
): () => void {
  // 保留參數以維持既有呼叫端 API；清掃由各 Map 的使用者在請求期間完成。
  void isExpired;
  void intervalMs;
  const registeredMap = map as unknown as Map<unknown, unknown>;
  if (registeredMaps.has(registeredMap)) return () => {};
  registeredMaps.add(registeredMap);

  const cleanup = () => {
    registeredMaps.delete(registeredMap);
  };
  return cleanup;
}

/** 測試後清理註冊狀態（保留既有測試 API 名稱） */
export function clearAllTtlMapTimers(): void {
  registeredMaps.clear();
}
