// @ts-nocheck
import { NextResponse } from 'next/server';
import { reportDeliveryInputError } from '@/lib/reportScheduleDelivery';
import { requireAdmin } from '../../../../lib/apiHelpers';
import { getDB, queryOne, queryAll, saveDB } from '../../../../lib/db';

function serializeSchedule(row) {
  return {
    id: row.id, userId: row.user_id, freq: row.freq,
    hour: Number(row.hour) || 0, minute: Number(row.minute) || 0, weekday: Number(row.weekday) || 0,
    dayOfMonth: Number(row.day_of_month) || 0, enabled: row.enabled === 1 && row.notify_email !== 0,
    notifyEmail: row.notify_email !== 0,
    lastRun: Number(row.last_run) || 0, lastSummary: row.last_summary || '',
    createdAt: Number(row.created_at) || 0, updatedAt: Number(row.updated_at) || 0,
  };
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const rows = userId
    ? queryAll('SELECT * FROM report_schedules WHERE user_id = ? ORDER BY created_at DESC', [String(userId)])
    : queryAll('SELECT * FROM report_schedules ORDER BY created_at DESC');
  return NextResponse.json(rows.map(serializeSchedule));
}

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const deliveryError = reportDeliveryInputError(body);
  if (deliveryError) return NextResponse.json({ error: deliveryError }, { status: 400 });
  const userId = String(body?.userId || '').trim();
  const freq = String(body?.freq || '').trim();
  if (!userId) return NextResponse.json({ error: '缺少 userId' }, { status: 400 });
  if (!['daily', 'weekly', 'monthly'].includes(freq)) {
    return NextResponse.json({ error: 'freq 須為 daily/weekly/monthly' }, { status: 400 });
  }
  const u = queryOne('SELECT id FROM users WHERE id = ?', [userId]);
  if (!u) return NextResponse.json({ error: '指定的使用者不存在' }, { status: 400 });

  const hour = clampInt(body?.hour, 0, 23, 9);
  const minute = clampInt(body?.minute, 0, 59, 0);
  const weekday = clampInt(body?.weekday, 0, 6, 1);
  // dayOfMonth 0 = 每月最後一天，1-28 = 指定日期
  const dayOfMonth = clampInt(body?.dayOfMonth, 0, 28, 1);
  const notifyEmail = body?.notifyEmail === false ? 0 : 1;
  if (!notifyEmail) {
    return NextResponse.json({ error: '請啟用 Email 報表' }, { status: 400 });
  }
  const enabled = body?.enabled === false ? 0 : 1;
  const nowMs = Date.now();
  const id = 'rs_' + nowMs + '_' + Math.random().toString(36).slice(2, 10);

  getDB().run(
    'INSERT INTO report_schedules (id, user_id, freq, hour, minute, weekday, day_of_month, notify_email, enabled, last_run, last_summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, \'\', ?, ?)',
    [id, userId, freq, hour, minute, weekday, dayOfMonth, notifyEmail, enabled, nowMs, nowMs]
  );
  saveDB();
  const row = queryOne('SELECT * FROM report_schedules WHERE id = ?', [id]);
  return NextResponse.json(serializeSchedule(row), { status: 201 });
}
