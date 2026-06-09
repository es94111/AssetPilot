import { NextResponse } from 'next/server';
import { getS3ConfigStatus, getS3Config, getS3Object } from '../../../../lib/s3Storage';

// Public endpoint — the mobile app polls this to learn the latest released
// version and APK URL. The CI workflow (android-apk.yml) writes the manifest to
// downloads/app-version.json on S3 after every signed release build.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MANIFEST_KEY = 'downloads/app-version.json';

export async function GET() {
  const status = getS3ConfigStatus();
  if (!status.configured) {
    return NextResponse.json(
      { error: 'S3 尚未設定，無法取得 App 版本資訊', missing: status.missing },
      { status: 503 },
    );
  }

  try {
    const config = getS3Config();
    // CI uploads to bucket-root downloads/ (no prefix); read the same path.
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
