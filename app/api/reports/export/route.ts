import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { queryOne } from '../../../../lib/db';
import {
  getTransactionsSummary,
  convertTransactionsSummaryToBaseCurrency,
  InvalidDateRangeError,
} from '../../../../lib/dashboardHelpers';
import { buildCsv, isValidIso8601Date, writeOperationAudit } from '../../../../lib/auditHelpers';
import { getRequestIpFromHeaders } from '../../../../lib/loginHelpers';
import { resolveReportBaseCurrency, reportRateSourceLabel } from '../../../../lib/reportCurrency';
import { getReportCurrencyContext } from '../../../../lib/reportCurrencyContext';

type CsvCell = string | number | null;

const TX_TYPE_LABELS: Record<string, string> = { income: '收入', expense: '支出' };

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const requestedType = searchParams.get('type') || '';
  const type = requestedType === 'income' ? 'income' : 'expense';
  const rawFrom = searchParams.get('from') || '';
  const rawTo = searchParams.get('to') || '';
  const from = isValidIso8601Date(rawFrom) ? rawFrom : '';
  const to = isValidIso8601Date(rawTo) ? rawTo : '';

  const baseCurrency = resolveReportBaseCurrency(searchParams.get('baseCurrency'));
  if (baseCurrency === null) {
    return NextResponse.json(
      { error: '不是有效的 ISO 4217 幣別代碼', code: 'InvalidCurrency' },
      { status: 400 },
    );
  }

  try {
    const summary = getTransactionsSummary(auth.userId, { type, from, to }, auth.userTimezone);

    // 匯出金額與畫面上所選基準幣別一致：與 /api/reports 共用同一條換算路徑。
    const context = baseCurrency === 'TWD' ? null : getReportCurrencyContext(auth.userId, baseCurrency);
    if (baseCurrency !== 'TWD' && !context) {
      return NextResponse.json(
        { error: `無法取得 ${baseCurrency} 匯率，請先於匯率設定新增`, code: 'RateUnavailable', baseCurrency },
        { status: 400 },
      );
    }

    const report = context
      ? convertTransactionsSummaryToBaseCurrency(summary, context.rate.rateToBase, baseCurrency)
      : summary;
    const rateSource = context ? reportRateSourceLabel(context.rate.source) : 'TWD（既有基準）';
    const rateTime = context ? (context.rate.fetchedAt || '未提供') : '無須換算';

    const headers = ['期間起始', '期間結束', '類型', '上層分類', '分類', '金額', '幣別', '匯率來源', '匯率時間'];
    const dataRows: CsvCell[][] = report.categoryBreakdown
      .filter(row => Number(row.total) > 0)
      .sort((a, b) => Number(b.total) - Number(a.total))
      .map(row => [
        report.periodStart, report.periodEnd, TX_TYPE_LABELS[type] || type,
        row.parentName || '', row.name || '', Number(row.total) || 0,
        baseCurrency, rateSource, rateTime,
      ]);
    dataRows.push([
      report.periodStart, report.periodEnd, TX_TYPE_LABELS[type] || type,
      '', '合計', Number(report.total) || 0, baseCurrency, rateSource, rateTime,
    ]);

    const csv = buildCsv(headers, dataRows);
    const filename = `reports-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.csv`;

    const userRow = queryOne('SELECT is_admin FROM users WHERE id = ?', [auth.actorUserId]);
    writeOperationAudit({
      userId: auth.actorUserId,
      role: userRow?.is_admin ? 'admin' : 'user',
      action: 'export_reports',
      ipAddress: getRequestIpFromHeaders(request.headers),
      userAgent: request.headers.get('user-agent') || '',
      result: 'success',
      isAdminOperation: false,
      metadata: {
        rows: dataRows.length,
        byteSize: Buffer.byteLength(csv, 'utf8'),
        dateFrom: report.periodStart,
        dateTo: report.periodEnd,
        filename,
        scope: auth.isSharedLedger ? 'shared_ledger' : 'personal',
        filterParams: { type, baseCurrency, rateSource },
      },
    });

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    if (e instanceof InvalidDateRangeError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error('export_reports failed', e);
    return NextResponse.json({ error: '匯出失敗' }, { status: 500 });
  }
}
