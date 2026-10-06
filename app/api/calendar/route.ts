import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/apiHelpers';
import { queryAll } from '@/lib/db';
import { buildCalendarEvents, getTodayInTimezone } from '@/lib/calendarEvents';
import { getCalendarRange, isCalendarIsoDate, type CalendarView } from '@/lib/calendarDates';
import { isValidIanaTimezone } from '@/lib/userTime';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const timezone = isValidIanaTimezone(auth.userTimezone) ? auth.userTimezone : 'Asia/Taipei';
  const { searchParams } = new URL(request.url);
  const today = getTodayInTimezone(timezone);
  const anchor = searchParams.get('date') || today;
  const requestedView = searchParams.get('view') || 'month';
  if (!isCalendarIsoDate(anchor)) {
    return NextResponse.json({ error: '日期格式無效', code: 'ValidationError', field: 'date' }, { status: 400 });
  }
  if (requestedView !== 'month' && requestedView !== 'week') {
    return NextResponse.json({ error: '檢視模式無效', code: 'ValidationError', field: 'view' }, { status: 400 });
  }

  const view = requestedView as CalendarView;
  const range = getCalendarRange(anchor, view);
  if (!range) {
    return NextResponse.json({ error: '日期範圍無效', code: 'ValidationError', field: 'date' }, { status: 400 });
  }

  const transactions = queryAll(
    `SELECT t.id, t.date, t.type, COALESCE(NULLIF(t.original_amount, 0), t.amount) AS amount,
            t.currency, t.note, c.name AS category_name, a.name AS account_name
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id AND c.user_id = t.user_id
     LEFT JOIN accounts a ON a.id = t.account_id AND a.user_id = t.user_id
     WHERE t.user_id = ? AND t.date >= ? AND t.date <= ?
     ORDER BY t.date, t.created_at, t.id`,
    [auth.userId, range.from, range.to],
  );
  const dividends = queryAll(
    `SELECT sd.id, sd.date, sd.cash_dividend, sd.stock_dividend_shares, sd.note,
            s.symbol, s.name AS stock_name, s.currency
     FROM stock_dividends sd
     LEFT JOIN stocks s ON s.id = sd.stock_id AND s.user_id = sd.user_id
     WHERE sd.user_id = ? AND sd.date >= ? AND sd.date <= ?
     ORDER BY sd.date, sd.created_at, sd.id`,
    [auth.userId, range.from, range.to],
  );
  const recurringSchedules = queryAll(
    `SELECT r.id, r.type, r.frequency, r.start_date, r.last_generated, r.is_active,
            r.amount, r.fx_rate, r.note, r.currency, c.name AS category_name, a.name AS account_name
     FROM recurring r
     LEFT JOIN categories c ON c.id = r.category_id AND c.user_id = r.user_id
     LEFT JOIN accounts a ON a.id = r.account_id AND a.user_id = r.user_id
     WHERE r.user_id = ? AND r.is_active = 1
     ORDER BY r.start_date, r.id`,
    [auth.userId],
  );

  const events = buildCalendarEvents({ range, transactions, dividends, recurringSchedules });
  return NextResponse.json(
    { anchor, view, range, timezone, today, events },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
