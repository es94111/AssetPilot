// 002 T044 / 004 T035：歷史介面，保留 module.exports 形狀以維持向後相容。
// 009-multi-timezone：本檔自 v4.33.0 起改為 lib/userTime.js 的 thin wrapper，
// 一律以 'Asia/Taipei' 為固定 tz 參數呼叫 userTime 對應函式。
// 後續新程式碼請直接 require('./userTime') 並傳入 req.userTimezone。

const userTime = require('./userTime');

function todayInTaipei() {
  return userTime.todayInUserTz('Asia/Taipei');
}

function monthInTaipei(date) {
  return userTime.monthInUserTz('Asia/Taipei', date);
}

function isFutureDate(dateStr) {
  return userTime.isFutureDateForTz('Asia/Taipei', dateStr);
}

// isValidIsoDate 與時區無關 → 直接 re-export
const isValidIsoDate = userTime.isValidIsoDate;

module.exports = {
  todayInTaipei,
  monthInTaipei,
  isFutureDate,
  isValidIsoDate,
};
