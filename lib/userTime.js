// 009-multi-timezone：per-user 時區工具（server-only）。
// 憲章 v1.3.0 Principle IV：後端時間一律以 UTC ms / ISO 8601 `Z` 表達；
// 「使用者當地某日／某月／某時刻」一律以 users.timezone (IANA) 計算。
//
// 提供函式：
// - isValidIanaTimezone(tz)
// - todayInUserTz(tz)            → 'YYYY-MM-DD'
// - monthInUserTz(tz, dateOrMs?) → 'YYYY-MM'
// - isFutureDateForTz(tz, dateStr)
// - partsInTz(tz, msOrDate)      → { year, month, day, hour, minute, weekday }
// - toIsoUtc(value)              → 'YYYY-MM-DDTHH:mm:ss.sssZ'
// - isValidIsoDate(s)            → 沿用既有 lib/taipeiTime 邏輯
// 測試 hook：
// - __nowMs() / __setNowMs(ms|null)
//
// 設計原則：所有函式為純函式（除 __setNowMs / __nowMs），不直接讀 DB；
// 由呼叫端提供 IANA 字串（通常為 req.userTimezone）。

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

let __overrideNowMs = null; // 測試用注入

function __setNowMs(ms) {
  __overrideNowMs = (ms == null) ? null : Number(ms);
}

function __nowMs() {
  if (__overrideNowMs != null) return __overrideNowMs;
  // 環境變數 FAKE_NOW（ISO 字串）→ ms
  const fake = process.env.FAKE_NOW;
  if (fake) {
    const t = Date.parse(fake);
    if (!isNaN(t)) return t;
  }
  return Date.now();
}

// 內部：以 Intl.DateTimeFormat 解析 ms 為使用者時區下的數字部位
// 回傳 Map { year, month, day, hour, minute, second, weekday }
function _formatToParts(tz, ms) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = fmt.formatToParts(new Date(ms));
  const m = {};
  for (const p of parts) m[p.type] = p.value;
  return m;
}

// 短週次字串 → 0-6（與 Date#getDay 對齊：Sun=0, Mon=1, ..., Sat=6）
const WEEKDAY_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function isValidIanaTimezone(tz) {
  if (typeof tz !== 'string' || tz.length === 0) return false;
  // 顯式拒絕已知會被 Intl 容錯接受但語意非 IANA 的字串
  if (/^UTC[+\-]\d/.test(tz)) return false; // UTC+8 / UTC-7 等
  if (/^GMT[+\-]\d/.test(tz)) return false; // GMT+8 等
  // 拒絕純縮寫（PST、EST、CST 等）。IANA 識別碼形式為 Region/City 或單一字 'UTC'。
  // 縮寫通常 ≤ 4 個大寫字母、無斜線、且不在白名單。
  const utcAlias = ['UTC', 'GMT', 'Etc/UTC', 'Etc/GMT', 'Z'];
  if (utcAlias.includes(tz)) {
    // 額外驗證：DateTimeFormat 接受
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
      return true;
    } catch (_) {
      return false;
    }
  }
  if (/^[A-Z]{2,5}$/.test(tz) && !tz.includes('/')) return false;
  // 主要驗證：以 Intl.DateTimeFormat 為事實來源（只要不擲錯就接受）
  // Node 的 Intl.supportedValuesOf('timeZone') 不收 'UTC' 等別名，
  // 但這些別名是合法的 IANA 名稱，故走 DateTimeFormat 驗證更包容。
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
    return true;
  } catch (_) {
    return false;
  }
}

function todayInUserTz(tz) {
  const ms = __nowMs();
  const p = _formatToParts(tz || 'Asia/Taipei', ms);
  return `${p.year}-${p.month}-${p.day}`;
}

function monthInUserTz(tz, dateOrMs) {
  let ms;
  if (dateOrMs == null) ms = __nowMs();
  else if (typeof dateOrMs === 'number') ms = dateOrMs;
  else if (dateOrMs instanceof Date) ms = dateOrMs.getTime();
  else ms = __nowMs();
  const p = _formatToParts(tz || 'Asia/Taipei', ms);
  return `${p.year}-${p.month}`;
}

function isFutureDateForTz(tz, dateStr) {
  if (!isValidIsoDate(dateStr)) return false;
  return String(dateStr) > todayInUserTz(tz);
}

function partsInTz(tz, msOrDate) {
  let ms;
  if (msOrDate == null) ms = __nowMs();
  else if (typeof msOrDate === 'number') ms = msOrDate;
  else if (msOrDate instanceof Date) ms = msOrDate.getTime();
  else ms = __nowMs();
  const p = _formatToParts(tz || 'Asia/Taipei', ms);
  return {
    year: parseInt(p.year, 10),
    month: parseInt(p.month, 10),
    day: parseInt(p.day, 10),
    hour: parseInt(p.hour, 10) % 24, // hour12:false 仍可能輸出 24:00 的角落情況
    minute: parseInt(p.minute, 10),
    weekday: WEEKDAY_MAP[p.weekday] != null ? WEEKDAY_MAP[p.weekday] : 0,
  };
}

// 任何 timestamp 進來 → 一律輸出 'YYYY-MM-DDTHH:mm:ss.sssZ'
function toIsoUtc(value) {
  if (value == null || value === '') {
    throw new TypeError(`toIsoUtc: 不接受空值（got ${value}）`);
  }
  let d;
  if (typeof value === 'number') {
    d = new Date(value);
  } else if (value instanceof Date) {
    d = value;
  } else if (typeof value === 'string') {
    // 拒絕含時區偏移（非 Z 結尾且帶 +HH:MM 或 -HH:MM）
    if (/[+\-]\d{2}:?\d{2}$/.test(value)) {
      throw new TypeError(`toIsoUtc: 不接受帶時區偏移的輸入（${value}），必須為 UTC Z`);
    }
    // 容錯：sqlite default 'YYYY-MM-DD HH:mm:ss' 視為 UTC
    let s = value;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
      s = s.replace(' ', 'T') + 'Z';
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
      // 缺 Z → 補 Z（視為 UTC）
      s = s + 'Z';
    }
    d = new Date(s);
  } else {
    throw new TypeError(`toIsoUtc: 不支援的型別 ${typeof value}`);
  }
  if (isNaN(d.getTime())) {
    throw new TypeError(`toIsoUtc: 無法解析的時間值 ${JSON.stringify(value)}`);
  }
  // toISOString 預設輸出 .sssZ
  return d.toISOString();
}

// 嚴格驗證 ISO 8601 DATE（YYYY-MM-DD），與既有 lib/taipeiTime.js 行為相容
function isValidIsoDate(s) {
  if (typeof s !== 'string' || !ISO_DATE_REGEX.test(s)) return false;
  const [yyyy, mm, dd] = s.split('-').map((p) => parseInt(p, 10));
  if (mm < 1 || mm > 12) return false;
  if (dd < 1 || dd > 31) return false;
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  return d.getUTCFullYear() === yyyy && d.getUTCMonth() === mm - 1 && d.getUTCDate() === dd;
}

module.exports = {
  isValidIanaTimezone,
  todayInUserTz,
  monthInUserTz,
  isFutureDateForTz,
  partsInTz,
  toIsoUtc,
  isValidIsoDate,
  __nowMs,
  __setNowMs,
};
