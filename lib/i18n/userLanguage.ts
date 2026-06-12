// lib/i18n/userLanguage.ts — 使用者語言偏好的 DB 讀寫（持久真實來源）
//
// 存於 user_settings.language（見 lib/db.ts migration）。
// 伺服器端通知（Email / LINE 排程）沒有 HTTP request context，必須靠這裡讀偏好。

import { getDB, queryOne } from '../db';
import { DEFAULT_LOCALE, normalizeLocale, type Locale } from './config';

/** 讀取使用者語言偏好；無資料時回退預設。 */
export function getUserLanguage(userId: string): Locale {
  const row = queryOne('SELECT language FROM user_settings WHERE user_id = ?', [userId]);
  if (!row || row.language == null || row.language === '') return DEFAULT_LOCALE;
  return normalizeLocale(row.language);
}

/** 寫入使用者語言偏好。user_settings 列在註冊時已建立，故用 UPDATE。 */
export function setUserLanguage(userId: string, locale: Locale): void {
  getDB().run(
    'UPDATE user_settings SET language = ?, updated_at = ? WHERE user_id = ?',
    [locale, Date.now(), userId]
  );
}
