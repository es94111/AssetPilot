// lib/i18n/config.ts — 多語言設定中心（locale 註冊表）
//
// 新增語言 = 在此註冊 + 新增 dictionaries/<locale>.ts。
// 目前以 zh-TW 為來源語言（source of truth），其它語言缺漏鍵會自動回退 zh-TW。

export const LOCALES = ['zh-TW', 'zh-CN', 'en', 'es', 'ar', 'fr', 'hi', 'pt-BR', 'ru', 'ko'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'zh-TW';

// 執行期語言來源：cookie（由登入 / 切換時依 DB 偏好寫入）
export const LOCALE_COOKIE = 'locale';

// <html lang> 屬性值
export const HTML_LANG: Record<Locale, string> = {
  'zh-TW': 'zh-TW',
  'zh-CN': 'zh-CN',
  en: 'en',
  es: 'es',
  ar: 'ar',
  fr: 'fr',
  hi: 'hi',
  'pt-BR': 'pt-BR',
  ru: 'ru',
  ko: 'ko',
};

export const HTML_DIR: Record<Locale, 'ltr' | 'rtl'> = {
  'zh-TW': 'ltr',
  'zh-CN': 'ltr',
  en: 'ltr',
  es: 'ltr',
  ar: 'rtl',
  fr: 'ltr',
  hi: 'ltr',
  'pt-BR': 'ltr',
  ru: 'ltr',
  ko: 'ltr',
};

// 語言切換器顯示名稱（以該語言自稱）
export const LOCALE_LABELS: Record<Locale, string> = {
  'zh-TW': '繁體中文',
  'zh-CN': '简体中文',
  en: 'English',
  es: 'Español',
  ar: 'العربية',
  fr: 'Français',
  hi: 'हिन्दी',
  'pt-BR': 'Português (Brasil)',
  ru: 'Русский',
  ko: '한국어',
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** 寬鬆正規化：未知值回退到預設語言。用於 DB / cookie 讀取。 */
export function normalizeLocale(value: unknown): Locale {
  if (isLocale(value)) return value;
  const s = String(value ?? '').trim().replace('_', '-').toLowerCase();
  if (!s) return DEFAULT_LOCALE;
  if (s === 'zh-cn' || s === 'zh-hans' || s.startsWith('zh-cn-') || s.startsWith('zh-hans-') || s.startsWith('zh-sg')) {
    return 'zh-CN';
  }
  if (s.startsWith('zh')) return 'zh-TW';
  if (s.startsWith('en')) return 'en';
  if (s.startsWith('es')) return 'es';
  if (s.startsWith('ar')) return 'ar';
  if (s.startsWith('fr')) return 'fr';
  if (s.startsWith('hi')) return 'hi';
  if (s.startsWith('pt')) return 'pt-BR';
  if (s.startsWith('ru')) return 'ru';
  if (s.startsWith('ko')) return 'ko';
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
