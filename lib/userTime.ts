// lib/userTime.ts — per-user 時區工具（server-only）。
// 憲章 v1.3.0 Principle IV：後端時間一律以 UTC ms / ISO 8601 `Z` 表達；
// 「使用者當地某日／某月／某時刻」一律以 users.timezone (IANA) 計算。

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

let __overrideNowMs: number | null = null; // 測試用注入

export function __setNowMs(ms: number | null): void {
  __overrideNowMs = (ms == null) ? null : Number(ms);
}

export function __nowMs(): number {
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
function _formatToParts(tz: string, ms: number): Record<string, string> {
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
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  return m;
}

// 短週次字串 → 0-6（與 Date#getDay 對齊：Sun=0, Mon=1, ..., Sat=6）
const WEEKDAY_MAP: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function isValidIanaTimezone(tz: string): boolean {
  if (typeof tz !== 'string' || tz.length === 0) return false;
  // 顯式拒絕已知會被 Intl 容錯接受但語意非 IANA 的字串
  if (/^UTC[+\-]\d/.test(tz)) return false; // UTC+8 / UTC-7 等
  if (/^GMT[+\-]\d/.test(tz)) return false; // GMT+8 等
  // 拒絕純縮寫（PST、EST、CST 等）
  const utcAlias = ['UTC', 'GMT', 'Etc/UTC', 'Etc/GMT', 'Z'];
  if (utcAlias.includes(tz)) {
    try {
      new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
      return true;
    } catch (_) {
      return false;
    }
  }
  if (/^[A-Z]{2,5}$/.test(tz) && !tz.includes('/')) return false;
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
    return true;
  } catch (_) {
    return false;
  }
}

export function todayInUserTz(tz: string): string {
  const ms = __nowMs();
  const p = _formatToParts(tz || 'Asia/Taipei', ms);
  return `${p.year}-${p.month}-${p.day}`;
}

export function monthInUserTz(tz: string, dateOrMs?: number | Date | null): string {
  let ms: number;
  if (dateOrMs == null) ms = __nowMs();
  else if (typeof dateOrMs === 'number') ms = dateOrMs;
  else if (dateOrMs instanceof Date) ms = dateOrMs.getTime();
  else ms = __nowMs();
  const p = _formatToParts(tz || 'Asia/Taipei', ms);
  return `${p.year}-${p.month}`;
}

export function isFutureDateForTz(tz: string, dateStr: string): boolean {
  if (!isValidIsoDate(dateStr)) return false;
  return String(dateStr) > todayInUserTz(tz);
}

export interface TimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

export function partsInTz(tz: string, msOrDate?: number | Date | null): TimeParts {
  let ms: number;
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
export function toIsoUtc(value: number | Date | string | null | undefined): string {
  if (value == null || value === '') {
    throw new TypeError(`toIsoUtc: 不接受空值（got ${value}）`);
  }
  let d: Date;
  if (typeof value === 'number') {
    d = new Date(value);
  } else if (value instanceof Date) {
    d = value;
  } else if (typeof value === 'string') {
    // 拒絕含時區偏移（非 Z 結尾且帶 +HH:MM 或 -HH:MM）
    if (/[+\-]\d{2}:?\d{2}$/.test(value)) {
      throw new TypeError(`toIsoUtc: 不接受帶時區偏移的輸入（${value}），必須為 UTC Z`);
    }
    // 容錯：legacy database default 'YYYY-MM-DD HH:mm:ss' 視為 UTC
    let s = value;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
      s = s.replace(' ', 'T') + 'Z';
    } else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s)) {
      s = s + 'Z';
    }
    d = new Date(s);
  } else {
    throw new TypeError(`toIsoUtc: 不支援的型別 ${typeof value}`);
  }
  if (isNaN(d.getTime())) {
    throw new TypeError(`toIsoUtc: 無法解析的時間值 ${JSON.stringify(value)}`);
  }
  return d.toISOString();
}

// 嚴格驗證 ISO 8601 DATE（YYYY-MM-DD）
export function isValidIsoDate(s: unknown): boolean {
  if (typeof s !== 'string' || !ISO_DATE_REGEX.test(s)) return false;
  const [yyyy, mm, dd] = s.split('-').map((p) => parseInt(p, 10));
  if (mm < 1 || mm > 12) return false;
  if (dd < 1 || dd > 31) return false;
  const d = new Date(Date.UTC(yyyy, mm - 1, dd));
  return d.getUTCFullYear() === yyyy && d.getUTCMonth() === mm - 1 && d.getUTCDate() === dd;
}
