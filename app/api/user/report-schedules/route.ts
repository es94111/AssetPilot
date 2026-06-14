// @ts-nocheck
// 使用者自助管理「定期報表通知」排程：列出 / 新增自己的排程。
// 與 admin/report-schedules 共用 report_schedules 資料表，但一律鎖定 auth.userId，
// 使用者只能看到與建立屬於自己的排程。
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryOne, queryAll, saveDB } from '../../../../lib/db';

function serializeSchedule(row) {
  return {
    id: row.id, userId: row.user_id, freq: row.freq,
    hour: Number(row.hour) || 0, minute: Number(row.minute) || 0, weekday: Number(row.weekday) || 0,
    dayOfMonth: Number(row.day_of_month) || 0, enabled: row.enabled === 1,
    notifyEmail: row.notify_email !== 0, notifyLine: row.notify_line === 1,
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
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const rows = queryAll('SELECT * FROM report_schedules WHERE user_id = ? ORDER BY created_at DESC', [auth.userId]);
  return NextResponse.json(rows.map(serializeSchedule));
}

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const freq = String(body?.freq || '').trim();
  if (!['daily', 'weekly', 'monthly'].includes(freq)) {
    return NextResponse.json({ error: 'freq 須為 daily/weekly/monthly' }, { status: 400 });
  }

  const hour = clampInt(body?.hour, 0, 23, 9);
  const minute = clampInt(body?.minute, 0, 59, 0);
  const weekday = clampInt(body?.weekday, 0, 6, 1);
  // dayOfMonth 0 = 每月最後一天，1-28 = 指定日期
  const dayOfMonth = clampInt(body?.dayOfMonth, 0, 28, 1);
  const notifyEmail = body?.notifyEmail === false ? 0 : 1;
  const notifyLine = body?.notifyLine === true ? 1 : 0;
  if (!notifyEmail && !notifyLine) {
    return NextResponse.json({ error: '請至少選擇一種通知方式' }, { status: 400 });
  }
  const enabled = body?.enabled === false ? 0 : 1;
  const nowMs = Date.now();
  const id = 'rs_' + nowMs + '_' + Math.random().toString(36).slice(2, 10);

  getDB().run(
    'INSERT INTO report_schedules (id, user_id, freq, hour, minute, weekday, day_of_month, notify_email, notify_line, enabled, last_run, last_summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, \'\', ?, ?)',
    [id, auth.userId, freq, hour, minute, weekday, dayOfMonth, notifyEmail, notifyLine, enabled, nowMs, nowMs]
  );
  saveDB();
  const row = queryOne('SELECT * FROM report_schedules WHERE id = ?', [id]);
  return NextResponse.json(serializeSchedule(row), { status: 201 });
}
