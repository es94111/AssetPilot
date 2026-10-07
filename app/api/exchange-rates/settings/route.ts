// @ts-nocheck
import { withLedgerWriteAudit } from '../../../../lib/ledgerContext';
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { setExchangeRateAutoUpdate } from '../../../../lib/exchangeRateHelpers';

async function handlePUT(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  if (auth.isSharedLedger) {
    return NextResponse.json({ error: '共享帳本不支援個人匯率自動更新設定' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const autoUpdate = !!body?.autoUpdate;
  const settings = setExchangeRateAutoUpdate(auth.userId, autoUpdate);
  return NextResponse.json({ success: true, settings });
}

export const PUT = withLedgerWriteAudit(handlePUT);
