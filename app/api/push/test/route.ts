// app/api/push/test/route.ts — 傳送測試推播（issue #257）
//
// 讓使用者在設定頁確認裝置真的收得到通知。不寫入去重紀錄，
// 因此每次按下都會實際發送；失效訂閱仍會在發送失敗時被自動清除。
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { sendTestNotification } from '../../../../lib/webPush';

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await sendTestNotification(auth.userId);
    if (result.status === 'skipped_no_subscription') {
      return NextResponse.json(
        { error: '尚未訂閱任何裝置', code: 'NoSubscription' },
        { status: 409 },
      );
    }
    if (result.status === 'failed') {
      return NextResponse.json(
        { error: result.reason || '推播發送失敗', code: 'PushFailed' },
        { status: 502 },
      );
    }
    return NextResponse.json({
      ok: true,
      delivered: result.delivered,
      expired: result.expired,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '推播發送失敗';
    return NextResponse.json({ error: message, code: 'PushFailed' }, { status: 500 });
  }
}
