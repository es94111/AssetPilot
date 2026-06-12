'use client';

// components/i18n/I18nProvider.tsx — client 端譯文 context
//
// 由 root layout（server）解析 locale + 字典後，以 props 傳入此 Provider。
// client component 透過 useT() 取得 t() 與目前 locale。

import { createContext, useContext, useMemo } from 'react';
import { createTranslator, type Dictionary, type TranslateFn } from '@/lib/i18n/translate';
import type { Locale } from '@/lib/i18n/config';

interface I18nContextValue {
  locale: Locale;
  t: TranslateFn;
  dict: Dictionary;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  dict,
  children,
}: {
  locale: Locale;
  dict: Dictionary;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nContextValue>(
    () => ({ locale, dict, t: createTranslator(dict) }),
    [locale, dict]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useT(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useT() 必須在 <I18nProvider> 內使用');
  }
  return ctx;
}
