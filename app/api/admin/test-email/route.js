import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/apiHelpers';
import { queryOne } from '../../../../lib/db';
import { sendStatsEmail } from '../../../../lib/emailService';

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth instanceof NextResponse) return auth;

  const me = queryOne('SELECT email, display_name FROM users WHERE id = ?', [auth.userId]);
  if (!me?.email) return NextResponse.json({ error: '目前管理員未設定 Email，無法寄送測試信' }, { status: 400 });

  try {
    const result = await sendStatsEmail({
      to: me.email,
      subject: 'AssetPilot 寄信設定測試',
      html: '<p>這是一封測試信，用來驗證寄信設定正確。</p><p>若您能收到此信，代表「寄送資產統計報表」功能已可正常使用。</p>',
    });
    if (!result) return NextResponse.json({ error: '寄信服務未設定（請設定 EMAIL_PROVIDER_PRIMARY 環境變數）' }, { status: 503 });
    return NextResponse.json({ success: true, provider: result.provider, to: me.email });
  } catch (e) {
    return NextResponse.json({ error: e.message || '測試信寄送失敗' }, { status: 500 });
  }
}
