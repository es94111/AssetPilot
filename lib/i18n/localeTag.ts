import type { Locale } from './config';

const INTL_LOCALE_TAGS: Record<Locale, string> = {
  'zh-TW': 'zh-TW',
  'zh-CN': 'zh-CN',
  en: 'en-US',
  es: 'es-ES',
  ar: 'ar',
  fr: 'fr-FR',
  hi: 'hi-IN',
  'pt-BR': 'pt-BR',
  ru: 'ru-RU',
  ko: 'ko-KR',
};

export function localeTag(locale: string): string {
  return INTL_LOCALE_TAGS[locale as Locale] ?? INTL_LOCALE_TAGS['zh-TW'];
}
