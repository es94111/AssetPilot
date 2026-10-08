// app/api/push/preferences/route.ts — 推播通知種類開關（issue #257）
//
// GET ：讀取三種通知（帳單到期／預算超標／股利發放）的開關狀態
// PUT ：更新單一（或多個）通知種類；只允許 lib/webPushCore.ts 的固定種類
//
// 關閉某種類只影響 Web Push，不影響既有 Email／LINE 排程通知。
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getUserPushPreferences, setUserPushPreference } from '../../../../lib/webPush';
import { PUSH_CATEGORIES, isPushCategory } from '../../../../lib/webPushCore';

export async function GET(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  return NextResponse.json(
    { preferences: getUserPushPreferences(auth.userId), categories: PUSH_CATEGORIES },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function PUT(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const updates = (body as { preferences?: Record<string, unknown> }).preferences
    ?? (body as Record<string, unknown>);

  const applied: string[] = [];
  for (const [key, value] of Object.entries(updates ?? {})) {
    if (!isPushCategory(key)) continue;
    if (typeof value !== 'boolean') {
      return NextResponse.json(
        { error: `${key} 必須為布林值`, code: 'ValidationError', field: key },
        { status: 400 },
      );
    }
    setUserPushPreference(auth.userId, key, value);
    applied.push(key);
  }

  if (applied.length === 0) {
    return NextResponse.json(
      { error: '未提供任何有效的通知種類', code: 'ValidationError' },
      { status: 400 },
    );
  }

  return NextResponse.json({ ok: true, preferences: getUserPushPreferences(auth.userId) });
}
