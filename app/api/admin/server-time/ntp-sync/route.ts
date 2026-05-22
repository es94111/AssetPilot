// @ts-nocheck
import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/apiHelpers';
import { DEFAULT_NTP_HOSTS, queryAnyNtp } from '../../../../../lib/ntp';
import { getServerTimeSnapshot, setServerTimeOffset } from '../../../../../lib/serverTime';

export const runtime = 'nodejs';

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  let body;
  try { body = await request.json(); } catch { body = {}; }

  const customHost = String(body?.host || '').trim();
  const hosts = customHost ? [customHost] : DEFAULT_NTP_HOSTS;
  const dryRun = !!body?.dryRun;

  try {
    const ntp = await queryAnyNtp(hosts);
    if (!dryRun) setServerTimeOffset(ntp.offsetMs, auth.userId);

    return NextResponse.json({
      success: true,
      dryRun,
      host: ntp.host,
      resolvedIp: ntp.resolvedIp,
      ntpTime: ntp.ntpTime,
      ntpTimeIso: ntp.ntpTimeIso,
      offsetMs: ntp.offsetMs,
      roundTripDelayMs: ntp.roundTripDelayMs,
      stratum: ntp.stratum,
      ...getServerTimeSnapshot(),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'NTP 同步失敗' },
      { status: 502 }
    );
  }
}
