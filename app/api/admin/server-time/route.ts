// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/apiHelpers';
import {
  MAX_SERVER_TIME_OFFSET_MS,
  getServerTimeOffset,
  getServerTimeSnapshot,
  setServerTimeOffset,
} from '../../../../lib/serverTime';

export const runtime = 'nodejs';

export async function GET(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json({
    ...getServerTimeSnapshot(),
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

  if (Math.abs(offsetMs) > MAX_SERVER_TIME_OFFSET_MS) {
    return NextResponse.json({ error: '偏移量超過 ±10 年上限' }, { status: 400 });
  }

  setServerTimeOffset(offsetMs, auth.userId);

  return NextResponse.json({
    success: true,
    ...getServerTimeSnapshot(),
  });
}
