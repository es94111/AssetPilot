import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { queryAll } from '../../../../lib/db';
import { assertTagsUsable } from '../../../../lib/transactionTags';
import { tagErrorResponse } from '../../../../lib/tagApiError';
import { aggregateTagStats, dedupeIds, parseTagMode, type TagStatLink } from '../../../../lib/transactionTagRules';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const sp = new URL(request.url).searchParams;
  const dateFrom = sp.get('dateFrom') || '';
  const dateTo = sp.get('dateTo') || '';
  const tagIds = dedupeIds((sp.get('tagIds') || '').split(','));
  const mode = parseTagMode(sp.get('tagMode'));
  try {
    assertTagsUsable(auth.userId, tagIds, false);
  } catch (e) {
    return tagErrorResponse(e);
  }

  // 排除 exclude_from_stats；僅收入／支出（標籤 v1 不含轉帳、還款、股利）。
  let where = "l.user_id = ? AND t.user_id = l.user_id AND t.type IN ('income','expense') AND COALESCE(t.exclude_from_stats,0) = 0 AND COALESCE(t.is_fx_fee,0) = 0";
  const params: Array<string | number> = [auth.userId];
  if (dateFrom) { where += ' AND t.date >= ?'; params.push(dateFrom); }
  if (dateTo) { where += ' AND t.date <= ?'; params.push(dateTo); }
  const rows = queryAll(
    `SELECT t.id AS tx_id, l.tag_id, t.type, COALESCE(t.twd_amount, t.amount) AS amount, SUBSTR(t.date,1,7) AS month, t.category_id
     FROM transaction_tag_links l JOIN transactions t ON t.id = l.transaction_id WHERE ${where}`,
    params,
  );
  const links: TagStatLink[] = rows.map((r) => ({
    txId: String(r.tx_id), tagId: String(r.tag_id), type: String(r.type),
    amount: Number(r.amount) || 0, month: String(r.month), categoryId: r.category_id ? String(r.category_id) : null,
  }));
  const result = aggregateTagStats(links, tagIds, mode);
  return NextResponse.json({
    ...result,
    mode,
    note: '合計為去重後金額（每筆交易只計一次），不等於各標籤小計相加；已排除「排除統計」交易，且不含轉帳、信用卡還款與股利。',
  });
}
