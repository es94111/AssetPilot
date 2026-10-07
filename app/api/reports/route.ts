import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import {
  getTransactionsSummary,
  convertTransactionsSummaryToBaseCurrency,
  InvalidDateRangeError,
} from '../../../lib/dashboardHelpers';
import { resolveReportBaseCurrency } from '../../../lib/reportCurrency';
import { getReportCurrencyContext } from '../../../lib/reportCurrencyContext';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get('type') || '';
  const from = searchParams.get('from') || '';
  const to = searchParams.get('to') || '';

  // 未帶 baseCurrency 時完全不進入多幣別路徑：回應與既有行為一致（TWD 等值、
  // 不含 currency／availableCurrencies 欄位），確保 MCP 與既有呼叫端不受影響。
  const rawBaseCurrency = searchParams.get('baseCurrency');
  const baseCurrency = resolveReportBaseCurrency(rawBaseCurrency);
  if (baseCurrency === null) {
    return NextResponse.json(
      { error: '不是有效的 ISO 4217 幣別代碼', code: 'InvalidCurrency', baseCurrency: rawBaseCurrency },
      { status: 400 },
    );
  }

  try {
    const summary = getTransactionsSummary(auth.userId, { type, from, to }, auth.userTimezone);
    if (rawBaseCurrency === null) return NextResponse.json(summary);

    const context = getReportCurrencyContext(auth.userId, baseCurrency);
    if (!context) {
      return NextResponse.json(
        { error: `無法取得 ${baseCurrency} 匯率，請先於匯率設定新增`, code: 'RateUnavailable', baseCurrency },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ...convertTransactionsSummaryToBaseCurrency(summary, context.rate.rateToBase, baseCurrency),
      currency: context.rate,
      availableCurrencies: context.availableCurrencies,
    });
  } catch (e) {
    if (e instanceof InvalidDateRangeError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    throw e;
  }
}
