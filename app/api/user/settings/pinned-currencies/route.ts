// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../../lib/db';
import { getOrCreateUserCurrencySettings } from '../../../../../lib/userCurrencySettings';

function getOrCreateRow(userId) {
  let row = queryOne('SELECT pinned_currencies, default_currency, updated_at FROM user_settings WHERE user_id = ?', [userId]);
  if (!row) {
    const now = Date.now();
    getDB().run(
      'INSERT INTO user_settings (user_id, pinned_currencies, default_currency, updated_at) VALUES (?, ?, ?, ?)',
      [userId, '["TWD"]', 'TWD', now]
    );
    saveDB();
    row = { pinned_currencies: '["TWD"]', default_currency: 'TWD', updated_at: now };
  }
  return row;
}

function parsePinned(raw) {
  try {
    const v = JSON.parse(raw || '["TWD"]');
    return Array.isArray(v) ? v : ['TWD'];
  } catch {
    return ['TWD'];
  }
}

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const row = getOrCreateRow(auth.userId);
  return NextResponse.json({
    pinnedCurrencies: parsePinned(row.pinned_currencies),
    defaultCurrency: row.default_currency || 'TWD',
    updatedAt: Number(row.updated_at) || 0,
  });
}

export async function PUT(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const list = body?.pinnedCurrencies;

  if (!Array.isArray(list) || list.length < 1 || list.length > 50) {
    return NextResponse.json(
      { error: 'ValidationError', field: 'pinnedCurrencies', message: '常用幣別數量需介於 1~50' },
      { status: 400 }
    );
  }

  const norm = [];
  for (const c of list) {
    const code = String(c || '').toUpperCase();
    if (!/^[A-Z]{3}$/.test(code)) {
      return NextResponse.json(
        { error: 'ValidationError', field: 'pinnedCurrencies', message: `幣別格式不正確：${c}` },
        { status: 400 }
      );
    }
    if (!norm.includes(code)) norm.push(code);
  }
  if (!norm.includes('TWD')) norm.unshift('TWD');

  const row = queryOne('SELECT pinned_currencies, default_currency, updated_at FROM user_settings WHERE user_id = ?', [auth.userId]);
  if (!row) {
    const now = Date.now();
    getDB().run(
      'INSERT INTO user_settings (user_id, pinned_currencies, default_currency, updated_at) VALUES (?, ?, ?, ?)',
      [auth.userId, JSON.stringify(norm), 'TWD', now]
    );
    saveDB();
    return NextResponse.json({ pinnedCurrencies: norm, defaultCurrency: 'TWD', updatedAt: now });
  }

  const expected = body?.expected_updated_at ?? body?.expectedUpdatedAt;
  if (expected != null && Number(expected) !== Number(row.updated_at)) {
    return NextResponse.json(
      {
        error: 'OptimisticLockConflict',
        serverUpdatedAt: Number(row.updated_at),
        message: '此筆已被其他裝置修改，請重新整理後再操作',
      },
      { status: 409 }
    );
  }

  const nowMs = Date.now();
  getDB().run(
    'UPDATE user_settings SET pinned_currencies = ?, updated_at = ? WHERE user_id = ?',
    [JSON.stringify(norm), nowMs, auth.userId]
  );
  saveDB();

  const settings = getOrCreateUserCurrencySettings(auth.userId);
  return NextResponse.json({ pinnedCurrencies: norm, defaultCurrency: settings.defaultCurrency, updatedAt: nowMs });
}
