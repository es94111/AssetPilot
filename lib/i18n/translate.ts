// lib/i18n/translate.ts — 翻譯器（dot-path 查詢 + {var} 插值）
//
// 這支同時可在 server / client 使用（純函式，無 next/headers 依賴）。

import type { Dictionary } from './dictionaries/zh-TW';

export type { Dictionary };

export type TranslateVars = Record<string, string | number>;
export type TranslateFn = (path: string, vars?: TranslateVars) => string;

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
