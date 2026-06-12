// app/api/account/settings/language/route.ts — 設定使用者語言偏好
//
// 同時：(1) 寫入 DB（持久真實來源，供排程通知讀取）
//       (2) 寫入 locale cookie（render 期讀取，避免每次查 DB）

import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiHelpers';
import { setUserLanguage } from '@/lib/i18n/userLanguage';
import { isLocale, LOCALE_COOKIE, type Locale } from '@/lib/i18n/config';

export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  let body: { locale?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '無效的請求內容' }, { status: 400 });
  }

  const locale = body?.locale;
  if (!isLocale(locale)) {
    return NextResponse.json({ error: '不支援的語言' }, { status: 400 });
  }

  setUserLanguage(auth.userId, locale as Locale);

  const response = NextResponse.json({ ok: true, locale });
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 年
    sameSite: 'lax',
  });
  return response;
}
