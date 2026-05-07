import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/apiHelpers';
import { getDB, queryOne, queryAll, saveDB } from '../../../../lib/db';
import { uid } from '../../../../lib/loginHelpers';

const SCHEDULE_FREQ_VALUES = ['off', 'daily', 'weekly', 'monthly'];
const REPORT_SCHEDULE_MAX_TARGETS = 50;

function parseUserIdList(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch (_) {}
  return [];
}

function getReportSchedule() {
  const row = queryOne(
    'SELECT report_schedule_freq, report_schedule_hour, report_schedule_weekday, report_schedule_day_of_month, report_schedule_last_run, report_schedule_last_summary, report_schedule_user_ids FROM system_settings WHERE id = 1'
  );
  const safe = (v, min, max, fallback) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  };
  return {
    freq: SCHEDULE_FREQ_VALUES.includes(row?.report_schedule_freq) ? row.report_schedule_freq : 'off',
    hour: safe(row?.report_schedule_hour, 0, 23, 9),
    weekday: safe(row?.report_schedule_weekday, 0, 6, 1),
    dayOfMonth: safe(row?.report_schedule_day_of_month, 1, 28, 1),
    lastRun: Number(row?.report_schedule_last_run) || 0,
    lastSummary: row?.report_schedule_last_summary || '',
    userIds: parseUserIdList(row?.report_schedule_user_ids),
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

  const s = getReportSchedule();
  return NextResponse.json({
    deprecated: true,
    freq: s.freq,
    hour: s.hour,
    weekday: s.weekday,
    dayOfMonth: s.dayOfMonth,
    userIds: s.userIds,
    lastRun: s.lastRun,
    lastRunText: s.lastRun ? new Date(s.lastRun).toISOString() : '',
    lastSummary: s.lastSummary,
  });
}

export async function PUT(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  let body;
  try { body = await request.json(); } catch { body = {}; }

  const freq = SCHEDULE_FREQ_VALUES.includes(body?.freq) ? body.freq : 'off';
  const hour = clampInt(body?.hour, 0, 23, 9);
  const weekday = clampInt(body?.weekday, 0, 6, 1);
  const dayOfMonth = clampInt(body?.dayOfMonth, 1, 28, 1);

  const rawIds = Array.isArray(body?.userIds) ? body.userIds : [];
  const cleanIds = [...new Set(rawIds.map(String).map(s => s.trim()).filter(Boolean))];
  if (cleanIds.length > REPORT_SCHEDULE_MAX_TARGETS) {
    return NextResponse.json({ error: `單次最多指定 ${REPORT_SCHEDULE_MAX_TARGETS} 位使用者` }, { status: 400 });
  }
  const validIds = cleanIds.filter(id => !!queryOne('SELECT id FROM users WHERE id = ?', [id]));

  const db = getDB();
  db.run(
    'UPDATE system_settings SET report_schedule_freq = ?, report_schedule_hour = ?, report_schedule_weekday = ?, report_schedule_day_of_month = ?, report_schedule_user_ids = ?, updated_at = ?, updated_by = ? WHERE id = 1',
    [freq, hour, weekday, dayOfMonth, JSON.stringify(validIds), Date.now(), auth.userId]
  );

  if (freq !== 'off') {
    const nowMs = Date.now();
    for (const uid_ of validIds) {
      const existing = queryOne('SELECT id FROM report_schedules WHERE user_id = ? AND freq = ? LIMIT 1', [uid_, freq]);
      if (existing) {
        db.run(
          'UPDATE report_schedules SET hour = ?, weekday = ?, day_of_month = ?, enabled = 1, updated_at = ? WHERE id = ?',
          [hour, weekday, dayOfMonth, nowMs, existing.id]
        );
      } else {
        const id = `rs_${nowMs}_${uid().slice(0, 8)}`;
        db.run(
          'INSERT INTO report_schedules (id, user_id, freq, hour, weekday, day_of_month, enabled, last_run, last_summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, 0, ?, ?, ?)',
          [id, uid_, freq, hour, weekday, dayOfMonth, '', nowMs, nowMs]
        );
      }
    }
    const allRows = queryAll('SELECT id, user_id FROM report_schedules WHERE freq = ?', [freq]);
    for (const r of allRows) {
      if (!validIds.includes(r.user_id)) {
        db.run('UPDATE report_schedules SET enabled = 0, updated_at = ? WHERE id = ?', [Date.now(), r.id]);
      }
    }
  }

  saveDB();
  return NextResponse.json({ success: true, freq, hour, weekday, dayOfMonth, userIds: validIds });
}
