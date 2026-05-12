import { getDB, queryOne, saveDB } from './db';
import { parseCurrencyCode } from './accountHelpers';
import { isValidCurrency } from './iso4217';

export const FALLBACK_DEFAULT_CURRENCY = 'TWD';

export function normalizeUserDefaultCurrency(value: unknown): string {
  const code = parseCurrencyCode(String(value || ''));
  if (!code || !isValidCurrency(code)) return FALLBACK_DEFAULT_CURRENCY;
  return code;
}

export function getOrCreateUserCurrencySettings(userId: string): {
  pinnedCurrencies: string;
  defaultCurrency: string;
  updatedAt: number;
} {
  let row = queryOne('SELECT pinned_currencies, default_currency, updated_at FROM user_settings WHERE user_id = ?', [userId]);
  if (!row) {
    const now = Date.now();
    getDB().run(
      'INSERT INTO user_settings (user_id, pinned_currencies, default_currency, updated_at) VALUES (?, ?, ?, ?)',
      [userId, '["TWD"]', FALLBACK_DEFAULT_CURRENCY, now]
    );
    saveDB();
    return { pinnedCurrencies: '["TWD"]', defaultCurrency: FALLBACK_DEFAULT_CURRENCY, updatedAt: now };
  }

  const defaultCurrency = normalizeUserDefaultCurrency(row.default_currency);
  if (defaultCurrency !== row.default_currency) {
    const now = Date.now();
    getDB().run(
      'UPDATE user_settings SET default_currency = ?, updated_at = ? WHERE user_id = ?',
      [defaultCurrency, now, userId]
    );
    saveDB();
    row = { ...row, default_currency: defaultCurrency, updated_at: now };
  }

  return {
    pinnedCurrencies: String(row.pinned_currencies || '["TWD"]'),
    defaultCurrency,
    updatedAt: Number(row.updated_at) || 0,
  };
}
