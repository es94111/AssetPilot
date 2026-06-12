// lib/i18n/config.ts — 多語言設定中心（locale 註冊表）
//
// 新增語言 = 在此註冊 + 新增 dictionaries/<locale>.ts。
// 目前以 zh-TW 為來源語言（source of truth），en 為示範 stub（缺漏鍵自動回退 zh-TW）。

export const LOCALES = ['zh-TW', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'zh-TW';

// 執行期語言來源：cookie（由登入 / 切換時依 DB 偏好寫入）
export const LOCALE_COOKIE = 'locale';

// <html lang> 屬性值
export const HTML_LANG: Record<Locale, string> = {
  'zh-TW': 'zh-TW',
  en: 'en',
};

// 語言切換器顯示名稱（以該語言自稱）
export const LOCALE_LABELS: Record<Locale, string> = {
  'zh-TW': '繁體中文',
  en: 'English',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** 寬鬆正規化：未知值回退到預設語言。用於 DB / cookie 讀取。 */
export function normalizeLocale(value: unknown): Locale {
  if (isLocale(value)) return value;
  const s = String(value ?? '').toLowerCase();
  if (s.startsWith('zh')) return 'zh-TW';
  if (s.startsWith('en')) return 'en';
  return DEFAULT_LOCALE;
}

/** 解析 Accept-Language 標頭，挑出第一個支援的語言；無匹配回退預設。 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const tags = header.split(',').map((p) => p.trim().split(';')[0].toLowerCase());
  for (const tag of tags) {
    if (tag.startsWith('zh')) return 'zh-TW';
    if (tag.startsWith('en')) return 'en';
  }
  return DEFAULT_LOCALE;
}
