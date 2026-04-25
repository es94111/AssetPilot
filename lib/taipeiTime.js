// Asia/Taipei 時區工具（server-only）。FR-007a：所有「今天／未來」判定固定以 UTC+8 計算。
// DB 內部時間戳記仍以 UTC 儲存；transactions.date 為 'YYYY-MM-DD' 代表台灣自然日。

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// 回傳當下台灣時區的日期字串 'YYYY-MM-DD'
function todayInTaipei() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(new Date());
}

// 004-budgets-recurring T035：回傳當下台灣時區的月份字串 'YYYY-MM'
function monthInTaipei(date) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return fmt.format(date || new Date()).slice(0, 7);
}

// 是否為未來日期（嚴格大於今天）
function isFutureDate(dateStr) {
  if (!isValidIsoDate(dateStr)) return false;
  return String(dateStr) > todayInTaipei();
}

// 驗證 ISO 8601 DATE 格式（YYYY-MM-DD）
function isValidIsoDate(s) {
  if (typeof s !== 'string' || !ISO_DATE_REGEX.test(s)) return false;
  const [yyyy, mm, dd] = s.split('-').map((p) => parseInt(p, 10));
  if (mm < 1 || mm > 12) return false;
  if (dd < 1 || dd > 31) return false;
  // 嚴格驗證：以 Date 物件比對是否為合法日期（避免 2026-02-30 通過）
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  return d.getUTCFullYear() === yyyy && d.getUTCMonth() === mm - 1 && d.getUTCDate() === dd;
}

module.exports = {
  todayInTaipei,
  monthInTaipei,
  isFutureDate,
  isValidIsoDate,
};
