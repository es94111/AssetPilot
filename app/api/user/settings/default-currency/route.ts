// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../../lib/db';
import {
  getOrCreateUserCurrencySettings,
  normalizeUserDefaultCurrency,
} from '../../../../../lib/userCurrencySettings';

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const settings = getOrCreateUserCurrencySettings(auth.userId);
  return NextResponse.json({
    defaultCurrency: settings.defaultCurrency,
    updatedAt: settings.updatedAt,
  });
}

export async function PUT(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const currency = normalizeUserDefaultCurrency(body?.defaultCurrency ?? body?.currency);
  const raw = String(body?.defaultCurrency ?? body?.currency ?? '').trim();
  if (!/^[A-Za-z]{3}$/.test(raw) || currency !== raw.toUpperCase()) {
    return NextResponse.json(
      { error: 'ValidationError', field: 'defaultCurrency', message: '請輸入有效的 ISO 4217 幣別代碼' },
      { status: 400 }
    );
  }

  const row = queryOne('SELECT updated_at FROM user_settings WHERE user_id = ?', [auth.userId]);
  const expected = body?.expected_updated_at ?? body?.expectedUpdatedAt;
  if (row && expected != null && Number(expected) !== Number(row.updated_at)) {
    return NextResponse.json(
      {
        error: 'OptimisticLockConflict',
        serverUpdatedAt: Number(row.updated_at),
        message: '此筆已被其他裝置修改，請重新整理後再操作',
      },
      { status: 409 }
    );
  }

  const now = Date.now();
  if (row) {
    getDB().run(
      'UPDATE user_settings SET default_currency = ?, updated_at = ? WHERE user_id = ?',
      [currency, now, auth.userId]
    );
  } else {
    getDB().run(
      'INSERT INTO user_settings (user_id, pinned_currencies, default_currency, updated_at) VALUES (?, ?, ?, ?)',
      [auth.userId, JSON.stringify([currency]), currency, now]
    );
  }
  saveDB();

  return NextResponse.json({ defaultCurrency: currency, updatedAt: now });
}
