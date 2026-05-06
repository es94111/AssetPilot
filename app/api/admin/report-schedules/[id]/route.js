import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../../lib/db';

function serializeSchedule(row) {
  return {
    id: row.id, userId: row.user_id, freq: row.freq,
    hour: Number(row.hour) || 0, weekday: Number(row.weekday) || 0,
    dayOfMonth: Number(row.day_of_month) || 1, enabled: row.enabled === 1,
    lastRun: Number(row.last_run) || 0, lastSummary: row.last_summary || '',
    createdAt: Number(row.created_at) || 0, updatedAt: Number(row.updated_at) || 0,
  };
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export async function PUT(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const row = queryOne('SELECT * FROM report_schedules WHERE id = ?', [id]);
  if (!row) return NextResponse.json({ error: '排程不存在' }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const updates = {};
  if (body?.hour !== undefined) updates.hour = clampInt(body.hour, 0, 23, row.hour);
  if (body?.weekday !== undefined) updates.weekday = clampInt(body.weekday, 0, 6, row.weekday);
  if (body?.dayOfMonth !== undefined) updates.day_of_month = clampInt(body.dayOfMonth, 1, 28, row.day_of_month);
  if (body?.enabled !== undefined) updates.enabled = body.enabled ? 1 : 0;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '請至少更新一個欄位' }, { status: 400 });
  }
  const cols = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  const vals = [...Object.values(updates), Date.now(), id];
  getDB().run(`UPDATE report_schedules SET ${cols}, updated_at = ? WHERE id = ?`, vals);
  saveDB();
  const updated = queryOne('SELECT * FROM report_schedules WHERE id = ?', [id]);
  return NextResponse.json(serializeSchedule(updated));
}

export async function DELETE(request, { params }) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const row = queryOne('SELECT id FROM report_schedules WHERE id = ?', [id]);
  if (!row) return NextResponse.json({ error: '排程不存在' }, { status: 404 });
  getDB().run('DELETE FROM report_schedules WHERE id = ?', [id]);
  saveDB();
  return new NextResponse(null, { status: 204 });
}
