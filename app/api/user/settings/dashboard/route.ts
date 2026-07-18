import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../../lib/db';
import { normalizeDashboardLayout, parseDashboardLayout } from '../../../../../lib/dashboardPreferences';

type SettingsRow = {
  dashboard_layout?: string | null;
  dashboard_layout_updated_at?: string | number | null;
};

function getOrCreateRow(userId: string): SettingsRow {
  let row = queryOne(
    'SELECT dashboard_layout, dashboard_layout_updated_at FROM user_settings WHERE user_id = ?',
    [userId]
  ) as SettingsRow | null;
  if (!row) {
    const now = Date.now();
    getDB().run(
      'INSERT INTO user_settings (user_id, pinned_currencies, default_currency, dashboard_layout, dashboard_layout_updated_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, '["TWD"]', 'TWD', '{}', now, now]
    );
    saveDB();
    row = { dashboard_layout: '{}', dashboard_layout_updated_at: now };
  }
  return row;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const row = getOrCreateRow(auth.userId);
  return NextResponse.json({
    layout: parseDashboardLayout(row.dashboard_layout),
    updatedAt: Number(row.dashboard_layout_updated_at) || 0,
  });
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  if (!body?.layout || typeof body.layout !== 'object') {
    return NextResponse.json(
      { error: 'ValidationError', field: 'layout', message: 'Dashboard layout is required' },
      { status: 400 }
    );
  }

  const layout = normalizeDashboardLayout(body.layout);
  const expected = body.expectedUpdatedAt ?? body.expected_updated_at;
  if (!Number.isFinite(Number(expected)) || Number(expected) < 0) {
    return NextResponse.json(
      { error: 'ValidationError', field: 'expectedUpdatedAt', message: 'Dashboard version is required' },
      { status: 400 }
    );
  }

  const now = Math.max(Date.now(), Number(expected) + 1);
  getDB().run(
    `INSERT INTO user_settings (
       user_id, pinned_currencies, default_currency, dashboard_layout, dashboard_layout_updated_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT (user_id) DO UPDATE SET
       dashboard_layout = EXCLUDED.dashboard_layout,
       dashboard_layout_updated_at = EXCLUDED.dashboard_layout_updated_at
     WHERE COALESCE(user_settings.dashboard_layout_updated_at, 0) = ?`,
    [auth.userId, '["TWD"]', 'TWD', JSON.stringify(layout), now, now, Number(expected)]
  );
  if (getDB().getRowsModified() === 0) {
    const server = queryOne(
      'SELECT dashboard_layout_updated_at FROM user_settings WHERE user_id = ?',
      [auth.userId]
    ) as SettingsRow | null;
    return NextResponse.json(
      {
        error: 'OptimisticLockConflict',
        serverUpdatedAt: Number(server?.dashboard_layout_updated_at) || 0,
        message: 'This dashboard changed after you opened it. Refresh and try again.',
      },
      { status: 409 }
    );
  }
  saveDB();

  return NextResponse.json({ layout, updatedAt: now });
}
