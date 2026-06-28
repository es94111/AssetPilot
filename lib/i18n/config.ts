// lib/i18n/config.ts — 多語言設定中心（locale 註冊表）
//
// 新增語言請修改 shared/i18n/locales.json，然後執行 npm run i18n:generate。

import {
  GENERATED_DEFAULT_LOCALE,
  GENERATED_HTML_DIR,
  GENERATED_HTML_LANG,
  GENERATED_LOCALE_LABELS,
  GENERATED_LOCALE_PREFIX_ALIASES,
  GENERATED_LOCALES,
} from './generated/config.ts';

export const LOCALES = GENERATED_LOCALES;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = GENERATED_DEFAULT_LOCALE;

// 執行期語言來源：cookie（由登入 / 切換時依 DB 偏好寫入）
export const LOCALE_COOKIE = 'locale';

// <html lang> 屬性值
export const HTML_LANG: Record<Locale, string> = GENERATED_HTML_LANG;

export const HTML_DIR: Record<Locale, 'ltr' | 'rtl'> = {
  ...GENERATED_HTML_DIR,
};

// 語言切換器顯示名稱（以該語言自稱）
export const LOCALE_LABELS: Record<Locale, string> = GENERATED_LOCALE_LABELS;

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** 寬鬆正規化：未知值回退到預設語言。用於 DB / cookie 讀取。 */
export function normalizeLocale(value: unknown): Locale {
  if (isLocale(value)) return value;
  const s = String(value ?? '').trim().replace('_', '-').toLowerCase();
  if (!s) return DEFAULT_LOCALE;
  for (const [prefix, locale] of GENERATED_LOCALE_PREFIX_ALIASES) {
    if (s === prefix || s.startsWith(`${prefix}-`)) return locale;
  }
  return DEFAULT_LOCALE;
}

/** 解析 Accept-Language 標頭，挑出第一個支援的語言；無匹配回退預設。 */
export function localeFromAcceptLanguage(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE;
  const tags = header.split(',').map((p) => p.trim().split(';')[0]);
  for (const tag of tags) {
    const locale = normalizeLocale(tag);
    const lowerTag = String(tag).toLowerCase();
    if (locale !== DEFAULT_LOCALE || lowerTag.startsWith('zh')) return locale;
  }
  return DEFAULT_LOCALE;
}
