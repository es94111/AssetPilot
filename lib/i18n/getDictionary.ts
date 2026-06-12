// lib/i18n/getDictionary.ts — 依 locale 取得「已合併回退」的完整字典
//
// 非來源語言（如 en）只填部分鍵，這裡深層合併到 zh-TW 基底，確保任何鍵都有值。
// 合併在模組載入時做一次並快取。

import type { Locale } from './config';
import { zhTW, type Dictionary } from './dictionaries/zh-TW';
import { en } from './dictionaries/en';
import { createTranslator, type TranslateFn } from './translate';

type AnyRecord = Record<string, unknown>;

/** 以 base 為骨架，用 override 覆蓋（深層）。回傳新物件，不改動 base。 */
function deepMerge<T>(base: T, override: unknown): T {
  if (!override || typeof override !== 'object') return base;
  const out: AnyRecord = Array.isArray(base) ? [...(base as unknown[])] as AnyRecord : { ...(base as AnyRecord) };
  for (const [key, value] of Object.entries(override as AnyRecord)) {
    const baseVal = (base as AnyRecord)[key];
    if (baseVal && typeof baseVal === 'object' && value && typeof value === 'object') {
      out[key] = deepMerge(baseVal, value);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out as T;
}

const DICTIONARIES: Record<Locale, Dictionary> = {
  'zh-TW': zhTW,
  en: deepMerge(zhTW, en),
};

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? zhTW;
}

export function getTranslator(locale: Locale): TranslateFn {
  return createTranslator(getDictionary(locale));
}
