// 002 T044 / 004 T035：歷史介面，保留 module.exports 形狀以維持向後相容。
// 009-multi-timezone：本檔自 v4.33.0 起改為 lib/userTime.js 的 thin wrapper，
// 一律以 'Asia/Taipei' 為固定 tz 參數呼叫 userTime 對應函式。
// 後續新程式碼請直接 require('./userTime') 並傳入 req.userTimezone。

import { isFutureDateForTz, isValidIsoDate, monthInUserTz, todayInUserTz } from './userTime.ts';

export function todayInTaipei(): string {
  return todayInUserTz('Asia/Taipei');
}

export function monthInTaipei(date?: Date | number | null): string {
  return monthInUserTz('Asia/Taipei', date);
}

export function isFutureDate(dateStr: string): boolean {
  return isFutureDateForTz('Asia/Taipei', dateStr);
}

// isValidIsoDate 與時區無關 → 直接 re-export
export { isValidIsoDate };
