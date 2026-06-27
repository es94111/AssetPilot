// lib/i18n/translate.ts — 翻譯器（dot-path 查詢 + {var} 插值）
//
// 這支同時可在 server / client 使用（純函式，無 next/headers 依賴）。

import type { Dictionary } from './dictionaries/zh-TW';

export type { Dictionary };

/**
 * 由來源字典型別自動展開的「所有 leaf 鍵」dot-path 聯集。
 * 用於 t() 的參數型別，讓 IDE 對靜態鍵提供自動補全與跳轉。
 * （巢狀物件遞迴，string leaf 為終點。）
 */
export type I18nKey = DotPath<Dictionary>;

type DotPath<T> = {
  [K in keyof T & string]: T[K] extends string
    ? K
    : T[K] extends Record<string, unknown>
      ? `${K}.${DotPath<T[K]>}`
      : never;
}[keyof T & string];

export type TranslateVars = Record<string, string | number>;

/**
 * 翻譯函式型別。
 * - `I18nKey`：已知靜態鍵 → IDE 自動補全。
 * - `(string & {})`：保留接受任意字串的能力，使動態鍵
 *   （如 t(`a.b.${x}`)、t(labelKey)）仍可呼叫、不破壞編譯。
 * 靜態鍵的拼字把關交由 CI 腳本 tools/check-i18n-parity.ts，
 * 它直接掃原始碼比對 zh-TW，比型別更不受 tsc 環境限制。
 */
export type TranslateFn = (path: I18nKey | (string & {}), vars?: TranslateVars) => string;

function lookup(dict: Dictionary, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, dict);
}

/**
 * 建立翻譯函式。
 * - 找不到鍵時回傳鍵本身（path），方便開發期一眼看出漏譯。
 * - vars 以 {name} 形式插值。
 */
export function createTranslator(dict: Dictionary): TranslateFn {
  return function t(path: string, vars?: TranslateVars): string {
    const value = lookup(dict, path);
    let str = typeof value === 'string' ? value : path;
    if (vars) {
      for (const [key, v] of Object.entries(vars)) {
        str = str.split(`{${key}}`).join(String(v));
      }
    }
    return str;
  };
}
