// lib/exchangeRateDefaults.ts — 純模組化的系統預設匯率表。
//
// 刻意獨立於 lib/accountHelpers.ts（其餘函式依賴資料庫），讓需要共用預設值的
// 純邏輯與測試不必載入資料庫初始化／env secret 副作用。
export const DEFAULT_EXCHANGE_RATES: Record<string, number> = {
  TWD: 1,
  USD: 31.5,
  JPY: 0.21,
  EUR: 34.2,
  CNY: 4.35,
  HKD: 4.03,
};
