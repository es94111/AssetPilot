// lib/i18n/getDictionary.ts — 依 locale 取得「已合併回退」的完整字典
//
// 非來源語言（如 en）只填部分鍵，這裡深層合併到 zh-TW 基底，確保任何鍵都有值。
// 合併在模組載入時做一次並快取。

import type { Locale } from './config';
import { zhTW, type Dictionary } from './dictionaries/zh-TW';
import { zhCN } from './dictionaries/zh-CN';
import { en } from './dictionaries/en';
import { es } from './dictionaries/es';
import { ar } from './dictionaries/ar';
import { fr } from './dictionaries/fr';
import { hi } from './dictionaries/hi';
import { ptBR } from './dictionaries/pt-BR';
import { ru } from './dictionaries/ru';
import { ko } from './dictionaries/ko';
import { createTranslator, type TranslateFn } from './translate';

type AnyRecord = Record<string, unknown>;

/** 以 base 為骨架，用 override 覆蓋（深層）。回傳新物件，不改動 base。 */
function deepMerge<T>(base: T, override: unknown): T {
  if (!override || typeof override !== 'object') return base;
  const out: AnyRecord = Array.isArray(base)
    ? ([...(base as unknown[])] as unknown as AnyRecord)
    : { ...(base as AnyRecord) };
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

const enBase = deepMerge(zhTW, en);

const DICTIONARIES: Record<Locale, Dictionary> = {
  'zh-TW': zhTW,
  'zh-CN': deepMerge(zhTW, zhCN),
  en: enBase,
  es: deepMerge(enBase, es),
  ar: deepMerge(enBase, ar),
  fr: deepMerge(enBase, fr),
  hi: deepMerge(enBase, hi),
  'pt-BR': deepMerge(enBase, ptBR),
  ru: deepMerge(enBase, ru),
  ko: deepMerge(enBase, ko),
};

export function getDictionary(locale: Locale): Dictionary {
  return DICTIONARIES[locale] ?? zhTW;
}

export function getTranslator(locale: Locale): TranslateFn {
  return createTranslator(getDictionary(locale));
}
