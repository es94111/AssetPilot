import { NextResponse } from 'next/server';
import { getS3Config, getS3Object } from '../../../../lib/s3Storage';
import { getMegaS4ConfigStatus } from '../../../../lib/megaS4';

// Public endpoint — the mobile app polls this to learn the latest released
// version and APK URL. Release builds write the manifest to
// downloads/app-version.json on MEGA S4 after every signed release build.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MANIFEST_KEY = 'downloads/app-version.json';

export async function GET() {
  const status = getMegaS4ConfigStatus();
  if (!status.configured) {
    return NextResponse.json(
      { error: 'MEGA S4 尚未設定，無法取得 App 版本資訊', missing: status.missing },
      { status: 503 },
    );
  }

  try {
    const config = getS3Config('MEGA_S4', {
      endpoint: status.endpoint,
      region: status.region,
      bucket: status.bucket,
      prefix: status.prefix,
    });
    // App update files live at bucket-root downloads/ (no MEGA_S4_PREFIX).
    const response = await getS3Object(config, MANIFEST_KEY);
    const manifest = await response.json();
    return NextResponse.json(manifest, {
      headers: { 'Cache-Control': 'public, max-age=60' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // No manifest yet (404) just means no release has been published.
    const status = /HTTP 404/.test(message) ? 404 : 502;
    return NextResponse.json({ error: '尚無已發布的 App 版本', detail: message }, { status });
  }
}
