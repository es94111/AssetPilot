// app/api/push/public-key/route.ts — 前端取得 VAPID 公鑰（issue #257）
//
// 公鑰本身可安全公開（訂閱時瀏覽器會把它送給 push service）；
// 私鑰只存在於伺服器環境變數／持久化 .env，永不外流。
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getVapidPublicKey, isWebPushConfigured } from '../../../../lib/webPushConfig';

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const configured = isWebPushConfigured();
  return NextResponse.json(
    {
      enabled: configured,
      publicKey: configured ? getVapidPublicKey() : '',
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
