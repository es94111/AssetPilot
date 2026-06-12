// lib/i18n/resolveLocale.ts — server 端解析「目前該用哪個語言」
//
// 優先序：
//   1. locale cookie（登入時依 DB 偏好寫入；切換語言時同步更新）
//   2. Accept-Language 標頭（未登入 / 尚無 cookie 的首訪）
//   3. 預設語言
//
// 註：DB 偏好是「持久真實來源」，但不在每次 render 都查 DB；改由登入 / 切換時把偏好
//     寫進 cookie，render 直接讀 cookie（見 lib/i18n/userLanguage.ts 與 settings API）。

import { cookies, headers } from 'next/headers';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  isLocale,
  localeFromAcceptLanguage,
  type Locale,
} from './config';

export async function resolveLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookieLocale)) return cookieLocale;

  try {
    const headerStore = await headers();
    return localeFromAcceptLanguage(headerStore.get('accept-language'));
  } catch {
    return DEFAULT_LOCALE;
  }
}
