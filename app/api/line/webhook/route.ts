import { NextResponse } from 'next/server';
import { normalizeCurrency, convertToTwd, normalizeDate } from '../../../../lib/accountHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../../lib/db';
import {
  LINE_MESSAGING_CHANNEL_ACCESS_TOKEN,
  LINE_MESSAGING_CHANNEL_SECRET,
  buildActionFlex,
  buildQueryFlex,
  buildRecordFlex,
  replyLineMessage,
  textMessage,
  verifyLineSignature,
  type LineReplyMessage,
} from '../../../../lib/lineMessaging';
import { computeTwdAmount } from '../../../../lib/moneyDecimal';
import { uid } from '../../../../lib/userDefaults';
import { isValidIsoDate, todayInUserTz } from '../../../../lib/userTime';

export const runtime = 'nodejs';

type TxType = 'income' | 'expense';

interface LineWebhookEvent {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type?: string; text?: string };
}

interface UserRow {
  id: string;
  display_name: string;
  timezone: string | null;
}

interface CategoryRow {
  id: string;
  name: string;
  parent_name: string | null;
}

interface AccountRow {
  id: string;
  name: string;
  currency: string | null;
}

interface TxRow {
  date: string;
  type: string;
  amount: number;
  note: string | null;
  category_name: string | null;
  account_name: string | null;
}

function asRows<T>(rows: Array<Record<string, string | number | null>>): T[] {
  return rows as unknown as T[];
}

function asRow<T>(row: Record<string, string | number | null> | null): T | null {
  return row as unknown as T | null;
}

function appUrlFromRequest(request: Request): string {
  const configured = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '';
  if (configured) return configured;
  const url = new URL(request.url);
  const proto = request.headers.get('x-forwarded-proto') || url.protocol.replace(':', '');
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || url.host;
  return `${proto}://${host}`;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(Math.round(value * 100) / 100);
}

function normalizeCommandText(text: string): string {
  return text.replace(/\u3000/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseDateToken(raw: string, timezone: string): { date: string; text: string } {
  let text = raw;
  const today = todayInUserTz(timezone);
  if (/\b今天\b/.test(text)) return { date: today, text: text.replace(/\b今天\b/g, '').trim() };
  if (/\b昨日\b|\b昨天\b/.test(text)) {
    const d = new Date(`${today}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    const date = d.toISOString().slice(0, 10);
    return { date, text: text.replace(/\b昨日\b|\b昨天\b/g, '').trim() };
  }
  const match = text.match(/\b(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{8})\b/);
  if (!match) return { date: today, text };
  const date = normalizeDate(match[1]);
  text = text.replace(match[1], '').trim();
  return { date: date || today, text };
}

function parseRecordCommand(input: string, timezone: string): { type: TxType; amount: number; currency: string; date: string; note: string } | null {
  const normalized = normalizeCommandText(input);
  const dateParsed = parseDateToken(normalized, timezone);
  let text = dateParsed.text;
  let type: TxType | null = null;
  let amountText = '';

  const signed = text.match(/^([+-])\s*(\d+(?:\.\d+)?)/);
  if (signed) {
    type = signed[1] === '+' ? 'income' : 'expense';
    amountText = signed[2];
    text = text.slice(signed[0].length).trim();
  } else {
    const explicit = text.match(/^(支出|花費|收入|入帳|expense|income)\s*(\d+(?:\.\d+)?)/i);
    if (!explicit) return null;
    type = /收入|入帳|income/i.test(explicit[1]) ? 'income' : 'expense';
    amountText = explicit[2];
    text = text.slice(explicit[0].length).trim();
  }

  const amount = Number(amountText);
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const currencyMatch = text.match(/\b(TWD|USD|JPY|CNY|EUR|HKD)\b/i);
  const currency = normalizeCurrency(currencyMatch?.[1] || 'TWD');
  if (currencyMatch) text = text.replace(currencyMatch[0], '').trim();

  return {
    type,
    amount,
    currency,
    date: dateParsed.date,
    note: text || (type === 'expense' ? 'LINE 支出' : 'LINE 收入'),
  };
}

function findMatchedCategory(userId: string, type: TxType, text: string): CategoryRow | null {
  const rows = asRows<CategoryRow>(queryAll(
    `SELECT c.id, c.name, p.name AS parent_name
     FROM categories c
     LEFT JOIN categories p ON p.id = c.parent_id
     WHERE c.user_id = ? AND c.type = ? AND c.parent_id IS NOT NULL AND c.parent_id != ''
     ORDER BY LENGTH(c.name) DESC`,
    [userId, type]
  ));
  const haystack = text.toLowerCase();
  return rows.find((row) => {
    const name = String(row.name || '').toLowerCase();
    const parent = String(row.parent_name || '').toLowerCase();
    return (!!name && haystack.includes(name)) || (!!parent && haystack.includes(parent));
  }) || rows.find((row) => row.name === (type === 'expense' ? '雜支' : '雜項')) || rows[0] || null;
}

function defaultAccount(userId: string): AccountRow | null {
  return asRow<AccountRow>(queryOne(
    'SELECT id, name, currency FROM accounts WHERE user_id = ? AND COALESCE(is_active, 1) = 1 ORDER BY sort_order ASC, created_at ASC LIMIT 1',
    [userId]
  ));
}

function createTransactionFromLine(user: UserRow, parsed: NonNullable<ReturnType<typeof parseRecordCommand>>): LineReplyMessage {
  if (!isValidIsoDate(parsed.date)) {
    return textMessage('日期格式無效，請使用 YYYY-MM-DD，例如：支出 120 午餐 2026-05-11');
  }
  const account = defaultAccount(user.id);
  if (!account) {
    return textMessage('找不到可用帳戶，請先到 AssetPilot 新增帳戶。');
  }
  const category = findMatchedCategory(user.id, parsed.type, parsed.note);
  let converted;
  try {
    converted = convertToTwd(parsed.amount, parsed.currency, parsed.currency === 'TWD' ? '1' : undefined, user.id);
  } catch (e) {
    return textMessage(e instanceof Error ? e.message : '金額格式錯誤');
  }

  const twdAmount = computeTwdAmount(converted.originalAmount, converted.fxRate, 0);
  const now = Date.now();
  const id = uid();
  getDB().run(
    'INSERT INTO transactions (id, user_id, type, amount, currency, original_amount, fx_rate, fx_fee, twd_amount, date, category_id, account_id, note, exclude_from_stats, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, user.id, parsed.type, twdAmount, converted.currency, converted.originalAmount, converted.fxRate, 0, twdAmount, parsed.date, category?.id || null, account.id, parsed.note, 0, now, now]
  );
  saveDB();

  return buildRecordFlex('已新增收支紀錄', [
    `類型：${parsed.type === 'income' ? '收入' : '支出'}`,
    `金額：TWD ${formatMoney(twdAmount)}`,
    `日期：${parsed.date}`,
    `分類：${category ? `${category.parent_name || ''}/${category.name}`.replace(/^\//, '') : '未分類'}`,
    `帳戶：${account.name}`,
    `備註：${parsed.note}`,
  ]);
}

function queryPeriod(input: string, timezone: string): { title: string; dateFrom: string; dateTo: string } {
  const text = normalizeCommandText(input);
  const today = todayInUserTz(timezone);
  if (/今天|今日/.test(text)) return { title: '今天收支', dateFrom: today, dateTo: today };
  if (/昨天|昨日/.test(text)) {
    const d = new Date(`${today}T00:00:00.000Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    const y = d.toISOString().slice(0, 10);
    return { title: '昨天收支', dateFrom: y, dateTo: y };
  }
  const monthMatch = text.match(/\b(\d{4})[-/](\d{1,2})\b/);
  const ym = monthMatch ? `${monthMatch[1]}-${monthMatch[2].padStart(2, '0')}` : today.slice(0, 7);
  const start = `${ym}-01`;
  const endDate = new Date(Date.UTC(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0));
  return { title: `${ym} 收支`, dateFrom: start, dateTo: endDate.toISOString().slice(0, 10) };
}

function queryTransactions(user: UserRow, input: string): LineReplyMessage {
  const period = queryPeriod(input, user.timezone || 'Asia/Taipei');
  const totals = asRow<{ income: number; expense: number }>(queryOne(
    `SELECT
       SUM(CASE WHEN type = 'income' THEN COALESCE(twd_amount, amount) ELSE 0 END) AS income,
       SUM(CASE WHEN type = 'expense' THEN COALESCE(twd_amount, amount) ELSE 0 END) AS expense
     FROM transactions
     WHERE user_id = ? AND date >= ? AND date <= ?`,
    [user.id, period.dateFrom, period.dateTo]
  )) || { income: 0, expense: 0 };
  const rows = asRows<TxRow>(queryAll(
    `SELECT t.date, t.type, COALESCE(t.twd_amount, t.amount) AS amount, t.note, c.name AS category_name, a.name AS account_name
     FROM transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN accounts a ON a.id = t.account_id
     WHERE t.user_id = ? AND t.date >= ? AND t.date <= ?
     ORDER BY t.date DESC, t.created_at DESC
     LIMIT 5`,
    [user.id, period.dateFrom, period.dateTo]
  ));

  const income = Number(totals.income) || 0;
  const expense = Number(totals.expense) || 0;
  return buildQueryFlex(
    period.title,
    [`收入：TWD ${formatMoney(income)}`, `支出：TWD ${formatMoney(expense)}`, `淨額：TWD ${formatMoney(income - expense)}`],
    rows.map((row) => {
      const sign = row.type === 'income' ? '+' : '-';
      const note = row.note ? `｜${row.note}` : '';
      const category = row.category_name ? `｜${row.category_name}` : '';
      return `${row.date} ${sign}${formatMoney(Number(row.amount) || 0)}${category}${note}`;
    })
  );
}

async function handleEvent(event: LineWebhookEvent, request: Request): Promise<void> {
  if (!event.replyToken) return;
  const lineUserId = event.source?.userId || '';
  const appUrl = appUrlFromRequest(request);
  const incomingText = event.message?.type === 'text' ? String(event.message.text || '') : '';

  if (!lineUserId) {
    await replyLineMessage(event.replyToken, [textMessage('無法取得 LINE 使用者 ID。')]);
    return;
  }

  const user = asRow<UserRow>(queryOne(
    "SELECT id, display_name, timezone FROM users WHERE line_id = ? AND COALESCE(is_active, 1) = 1",
    [lineUserId]
  ));

  const normalized = normalizeCommandText(incomingText);
  if (!user) {
    await replyLineMessage(event.replyToken, [buildActionFlex(appUrl)]);
    return;
  }

  if (!normalized || /^(開始|說明|help|綁定|bind)$/i.test(normalized)) {
    await replyLineMessage(event.replyToken, [buildActionFlex(appUrl)]);
    return;
  }

  if (/^(查詢|查|明細|最近)/.test(normalized)) {
    await replyLineMessage(event.replyToken, [queryTransactions(user, normalized)]);
    return;
  }

  const parsed = parseRecordCommand(normalized, user.timezone || 'Asia/Taipei');
  if (parsed) {
    await replyLineMessage(event.replyToken, [createTransactionFromLine(user, parsed)]);
    return;
  }

  await replyLineMessage(event.replyToken, [
    textMessage('我看不懂這個指令。可以輸入：支出 120 午餐、收入 5000 薪資、查詢 本月。'),
    buildActionFlex(appUrl),
  ]);
}

export async function POST(request: Request) {
  if (!LINE_MESSAGING_CHANNEL_SECRET || !LINE_MESSAGING_CHANNEL_ACCESS_TOKEN) {
    return NextResponse.json({ error: 'LINE Messaging API is not configured' }, { status: 503 });
  }

  const body = await request.text();
  if (!verifyLineSignature(body, request.headers.get('x-line-signature'))) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 401 });
  }

  const payload = JSON.parse(body || '{}') as { events?: LineWebhookEvent[] };
  const events = Array.isArray(payload.events) ? payload.events : [];
  await Promise.all(events.map((event) => handleEvent(event, request).catch((e) => {
    console.error('LINE webhook event failed:', e);
  })));
  return NextResponse.json({ ok: true });
}
