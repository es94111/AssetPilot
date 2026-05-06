import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db.js';

// Module-level variable for server time offset (initialized from DB on first call)
let serverTimeOffset = null;

function getServerTimeOffset() {
  if (serverTimeOffset === null) {
    const row = queryOne('SELECT server_time_offset FROM system_settings WHERE id = 1');
    serverTimeOffset = Number(row?.server_time_offset) || 0;
  }
  return serverTimeOffset;
}

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const offset = getServerTimeOffset();
  const realNow = Date.now();
  const effectiveNow = realNow + offset;

  return NextResponse.json({
    realNow,
    realNowIso: new Date(realNow).toISOString(),
    effectiveNow,
    effectiveNowIso: new Date(effectiveNow).toISOString(),
    offsetMs: offset,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || '',
    timezoneOffsetMinutes: new Date().getTimezoneOffset(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
}

export async function PUT(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  let body;
  try { body = await request.json(); } catch { body = {}; }

  const mode = String(body?.mode || '').trim();
  let offsetMs = getServerTimeOffset();

  if (mode === 'reset') {
    offsetMs = 0;
  } else if (mode === 'offset') {
    const n = Number(body?.offsetMs);
    if (!Number.isFinite(n)) return NextResponse.json({ error: 'offsetMs 必須為數字（毫秒）' }, { status: 400 });
    offsetMs = Math.trunc(n);
  } else if (mode === 'target') {
    let target;
    if (body?.targetMs !== undefined) {
      target = Number(body.targetMs);
    } else if (body?.targetIso) {
      target = new Date(String(body.targetIso)).getTime();
    }
    if (!Number.isFinite(target)) return NextResponse.json({ error: '目標時間格式錯誤' }, { status: 400 });
    offsetMs = target - Date.now();
  } else {
    return NextResponse.json({ error: 'mode 必須為 reset / offset / target 其中之一' }, { status: 400 });
  }

  const MAX_OFFSET = 10 * 365 * 24 * 60 * 60 * 1000;
  if (Math.abs(offsetMs) > MAX_OFFSET) {
    return NextResponse.json({ error: '偏移量超過 ±10 年上限' }, { status: 400 });
  }

  const db = getDB();
  db.run(
    'UPDATE system_settings SET server_time_offset = ?, updated_at = ?, updated_by = ? WHERE id = 1',
    [offsetMs, Date.now(), auth.userId]
  );
  saveDB();
  serverTimeOffset = offsetMs;

  const realNow = Date.now();
  const effectiveNow = realNow + serverTimeOffset;
  return NextResponse.json({
    success: true,
    realNow,
    effectiveNow,
    effectiveNowIso: new Date(effectiveNow).toISOString(),
    offsetMs: serverTimeOffset,
  });
}
