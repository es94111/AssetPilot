import { NextResponse } from 'next/server';
import { normalizeCurrency, convertToTwd, normalizeDate } from '../../../../lib/accountHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../../lib/db';
import {
  LINE_MESSAGING_CHANNEL_ACCESS_TOKEN,
  LINE_MESSAGING_CHANNEL_SECRET,
  buildMainMenuFlex,
  buildQueryFlex,
  buildQueryMenuFlex,
  buildRecordPromptFlex,
  buildRecordWizardStepFlex,
  buildRecordFlex,
  replyLineMessage,
  textMessage,
  verifyLineSignature,
  type LineReplyMessage,
} from '../../../../lib/lineMessaging';
import { computeTwdAmount } from '../../../../lib/moneyDecimal';
import { uid } from '../../../../lib/userDefaults';
import { getOrCreateUserCurrencySettings } from '../../../../lib/userCurrencySettings';
import { isValidIsoDate, todayInUserTz } from '../../../../lib/userTime';

export const runtime = 'nodejs';

type TxType = 'income' | 'expense';

interface LineWebhookEvent {
  type: string;
  replyToken?: string;
  source?: { userId?: string };
  message?: { type?: string; text?: string };
  postback?: { data?: string };
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

interface LineBotStateRow {
  line_user_id: string;
  user_id: string;
  action: string;
  tx_type: string | null;
  payload: string | null;
  updated_at: number;
}

interface RecordDraft {
  date?: string;
  type?: TxType;
  amount?: number;
  categoryId?: string;
  categoryName?: string;
  categoryPage?: number;
  accountId?: string;
  accountName?: string;
  accountPage?: number;
  currency?: string;
  note?: string;
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

function parseRecordCommand(input: string, timezone: string, fallbackCurrency = 'TWD'): { type: TxType; amount: number; currency: string; date: string; note: string } | null {
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
  const currency = normalizeCurrency(currencyMatch?.[1] || fallbackCurrency);
  if (currencyMatch) text = text.replace(currencyMatch[0], '').trim();

  return {
    type,
    amount,
    currency,
    date: dateParsed.date,
    note: text || (type === 'expense' ? 'LINE 支出' : 'LINE 收入'),
  };
}

function parseRecordDetail(input: string, type: TxType, timezone: string, fallbackCurrency = 'TWD'): { type: TxType; amount: number; currency: string; date: string; note: string } | null {
  const normalized = normalizeCommandText(input);
  const dateParsed = parseDateToken(normalized, timezone);
  let text = dateParsed.text;
  const amountMatch = text.match(/^(\d+(?:\.\d+)?)/);
  if (!amountMatch) return null;

  const amount = Number(amountMatch[1]);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  text = text.slice(amountMatch[0].length).trim();

  const currencyMatch = text.match(/\b(TWD|USD|JPY|CNY|EUR|HKD)\b/i);
  const currency = normalizeCurrency(currencyMatch?.[1] || fallbackCurrency);
  if (currencyMatch) text = text.replace(currencyMatch[0], '').trim();

  return {
    type,
    amount,
    currency,
    date: dateParsed.date,
    note: text || (type === 'expense' ? 'LINE 支出' : 'LINE 收入'),
  };
}

function getLineBotState(lineUserId: string): LineBotStateRow | null {
  return asRow<LineBotStateRow>(queryOne('SELECT * FROM line_bot_states WHERE line_user_id = ?', [lineUserId]));
}

function parseStatePayload(state: LineBotStateRow | null): RecordDraft {
  if (!state?.payload) return {};
  try {
    const parsed = JSON.parse(String(state.payload));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function setLineBotState(lineUserId: string, userId: string, action: string, txType = '', payload: RecordDraft = {}): void {
  getDB().run(
    'INSERT OR REPLACE INTO line_bot_states (line_user_id, user_id, action, tx_type, payload, updated_at) VALUES (?,?,?,?,?,?)',
    [lineUserId, userId, action, txType, JSON.stringify(payload), Date.now()]
  );
  saveDB();
}

function clearLineBotState(lineUserId: string): void {
  getDB().run('DELETE FROM line_bot_states WHERE line_user_id = ?', [lineUserId]);
  saveDB();
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

function listCategories(userId: string, type: TxType): CategoryRow[] {
  return asRows<CategoryRow>(queryAll(
    `SELECT c.id, c.name, p.name AS parent_name
     FROM categories c
     LEFT JOIN categories p ON p.id = c.parent_id
     LEFT JOIN (
       SELECT category_id, COUNT(*) AS usage_count, MAX(COALESCE(updated_at, created_at, 0)) AS last_used
       FROM transactions
       WHERE user_id = ? AND type = ? AND category_id IS NOT NULL AND category_id != ''
       GROUP BY category_id
     ) usage ON usage.category_id = c.id
     WHERE c.user_id = ? AND c.type = ? AND c.parent_id IS NOT NULL AND c.parent_id != ''
     ORDER BY COALESCE(usage.usage_count, 0) DESC, COALESCE(usage.last_used, 0) DESC, p.sort_order ASC, c.sort_order ASC, c.name ASC`,
    [userId, type, userId, type]
  ));
}

function listAccounts(userId: string): AccountRow[] {
  return asRows<AccountRow>(queryAll(
    `SELECT a.id, a.name, a.currency
     FROM accounts a
     LEFT JOIN (
       SELECT account_id, COUNT(*) AS usage_count, MAX(COALESCE(updated_at, created_at, 0)) AS last_used
       FROM transactions
       WHERE user_id = ? AND account_id IS NOT NULL AND account_id != ''
       GROUP BY account_id
     ) usage ON usage.account_id = a.id
     WHERE a.user_id = ? AND COALESCE(a.is_active, 1) = 1
     ORDER BY COALESCE(usage.usage_count, 0) DESC, COALESCE(usage.last_used, 0) DESC, a.sort_order ASC, a.created_at ASC`,
    [userId, userId]
  ));
}

function pageItems<T>(items: T[], page: number, pageSize = 7): { page: number; totalPages: number; items: T[] } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(0, Number(page) || 0), totalPages - 1);
  return {
    page: safePage,
    totalPages,
    items: items.slice(safePage * pageSize, safePage * pageSize + pageSize),
  };
}

function pageActions(kind: 'category' | 'account', page: number, totalPages: number) {
  const actions: Array<{ label: string; data: string; displayText?: string; primary?: boolean }> = [];
  if (page > 0) {
    actions.push({ label: '上一頁', data: `action=wizard_page&target=${kind}&page=${page - 1}`, displayText: '上一頁' });
  }
  if (page < totalPages - 1) {
    actions.push({ label: '下一頁', data: `action=wizard_page&target=${kind}&page=${page + 1}`, displayText: '下一頁' });
  }
  return actions;
}

function recordDraftSummary(draft: RecordDraft): string[] {
  return [
    `日期：${draft.date || '未填'}`,
    `類型：${draft.type === 'income' ? '收入' : draft.type === 'expense' ? '支出' : '未填'}`,
    `金額：${draft.amount ? formatMoney(Number(draft.amount)) : '未填'}`,
    `分類：${draft.categoryName || '未填'}`,
    `帳戶：${draft.accountName || '未填'}`,
    `幣別：${draft.currency || 'TWD'}`,
    `備註：${draft.note || '無'}`,
  ];
}

function buildWizardStep(user: UserRow, step: string, draft: RecordDraft): LineReplyMessage {
  const tz = user.timezone || 'Asia/Taipei';
  const today = todayInUserTz(tz);
  if (step === 'record_date') {
    const yesterday = (() => {
      const d = new Date(`${today}T00:00:00.000Z`);
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().slice(0, 10);
    })();
    return buildRecordWizardStepFlex('新增記錄：日期', ['請選擇日期，或直接輸入 YYYY-MM-DD。'], [
      { label: '今天', data: `action=wizard&step=date&value=${today}`, displayText: '今天', primary: true },
      { label: '昨天', data: `action=wizard&step=date&value=${yesterday}`, displayText: '昨天' },
    ]);
  }
  if (step === 'record_type') {
    return buildRecordWizardStepFlex('新增記錄：類型', recordDraftSummary(draft), [
      { label: '支出', data: 'action=wizard&step=type&value=expense', displayText: '支出', primary: true },
      { label: '收入', data: 'action=wizard&step=type&value=income', displayText: '收入' },
    ]);
  }
  if (step === 'record_amount') {
    return buildRecordWizardStepFlex('新增記錄：金額', [...recordDraftSummary(draft), '請直接輸入金額，例如：120'], [
      { label: '回選單', data: 'action=menu', displayText: '選單' },
    ]);
  }
  if (step === 'record_category') {
    const categories = draft.type ? listCategories(user.id, draft.type) : [];
    const page = pageItems(categories, draft.categoryPage || 0);
    const optionActions = page.items.map((category, index) => ({
      label: `${category.parent_name ? `${category.parent_name}/` : ''}${category.name}`.slice(0, 20),
      data: `action=wizard&step=category&value=${encodeURIComponent(category.id)}`,
      displayText: category.name,
      primary: index === 0,
    }));
    return buildRecordWizardStepFlex(
      '新增記錄：分類',
      [...recordDraftSummary(draft), `第 ${page.page + 1} / ${page.totalPages} 頁，常用分類優先顯示。`],
      [...optionActions, ...pageActions('category', page.page, page.totalPages)]
    );
  }
  if (step === 'record_account') {
    const accounts = listAccounts(user.id);
    const page = pageItems(accounts, draft.accountPage || 0);
    const optionActions = page.items.map((account, index) => ({
      label: account.name.slice(0, 20),
      data: `action=wizard&step=account&value=${encodeURIComponent(account.id)}`,
      displayText: account.name,
      primary: index === 0,
    }));
    return buildRecordWizardStepFlex(
      '新增記錄：帳戶',
      [...recordDraftSummary(draft), `第 ${page.page + 1} / ${page.totalPages} 頁，常用帳戶優先顯示。`],
      [...optionActions, ...pageActions('account', page.page, page.totalPages)]
    );
  }
  if (step === 'record_currency') {
    return buildRecordWizardStepFlex('新增記錄：幣別', recordDraftSummary(draft), ['TWD', 'USD', 'JPY', 'CNY', 'EUR', 'HKD'].map((currency, index) => ({
      label: currency,
      data: `action=wizard&step=currency&value=${currency}`,
      displayText: currency,
      primary: index === 0,
    })));
  }
  if (step === 'record_note') {
    return buildRecordWizardStepFlex('新增記錄：備註', [...recordDraftSummary(draft), '請直接輸入備註；若不需要備註，按「無備註」。'], [
      { label: '無備註', data: 'action=wizard&step=note&value=', displayText: '無備註', primary: true },
    ]);
  }
  return buildRecordWizardStepFlex('確認新增記錄', recordDraftSummary(draft), [
    { label: '確認新增', data: 'action=wizard&step=confirm&value=yes', displayText: '確認新增', primary: true },
    { label: '重新填寫', data: 'action=record_wizard', displayText: '重新填寫' },
  ]);
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

function createTransactionFromDraft(user: UserRow, draft: RecordDraft): LineReplyMessage {
  if (!draft.date || !isValidIsoDate(draft.date)) return textMessage('日期格式無效，請重新新增記錄。');
  if (draft.type !== 'income' && draft.type !== 'expense') return textMessage('類型無效，請重新新增記錄。');
  const amount = Number(draft.amount);
  if (!Number.isFinite(amount) || amount <= 0) return textMessage('金額必須大於 0，請重新新增記錄。');
  if (!draft.categoryId) return textMessage('尚未選擇分類，請重新新增記錄。');
  if (!draft.accountId) return textMessage('尚未選擇帳戶，請重新新增記錄。');

  const category = asRow<CategoryRow>(queryOne(
    `SELECT c.id, c.name, p.name AS parent_name
     FROM categories c
     LEFT JOIN categories p ON p.id = c.parent_id
     WHERE c.id = ? AND c.user_id = ? AND c.type = ?`,
    [draft.categoryId, user.id, draft.type]
  ));
  if (!category) return textMessage('分類不存在或無權限，請重新新增記錄。');
  const account = asRow<AccountRow>(queryOne(
    'SELECT id, name, currency FROM accounts WHERE id = ? AND user_id = ?',
    [draft.accountId, user.id]
  ));
  if (!account) return textMessage('帳戶不存在或無權限，請重新新增記錄。');

  let converted;
  const currency = normalizeCurrency(draft.currency || 'TWD');
  try {
    converted = convertToTwd(amount, currency, currency === 'TWD' ? '1' : undefined, user.id);
  } catch (e) {
    return textMessage(e instanceof Error ? e.message : '金額格式錯誤');
  }

  const twdAmount = computeTwdAmount(converted.originalAmount, converted.fxRate, 0);
  const now = Date.now();
  const id = uid();
  const note = String(draft.note || '').trim();
  getDB().run(
    'INSERT INTO transactions (id, user_id, type, amount, currency, original_amount, fx_rate, fx_fee, twd_amount, date, category_id, account_id, note, exclude_from_stats, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, user.id, draft.type, twdAmount, converted.currency, converted.originalAmount, converted.fxRate, 0, twdAmount, draft.date, category.id, account.id, note, 0, now, now]
  );
  saveDB();

  return buildRecordFlex('已新增收支紀錄', [
    `日期：${draft.date}`,
    `類型：${draft.type === 'income' ? '收入' : '支出'}`,
    `金額：TWD ${formatMoney(twdAmount)}`,
    `分類：${category.parent_name ? `${category.parent_name}/` : ''}${category.name}`,
    `帳戶：${account.name}`,
    `幣別：${converted.currency}`,
    `備註：${note || '無'}`,
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

function queryTextFromPeriod(period: string): string {
  if (period === 'today') return '查詢 今天';
  if (period === 'yesterday') return '查詢 昨天';
  return '查詢 本月';
}

function recordRuleText(type: TxType): string {
  return type === 'income'
    ? '收入輸入規則：金額 備註 日期（日期可省略）。例如：5000 薪資'
    : '支出輸入規則：金額 備註 日期（日期可省略）。例如：120 午餐';
}

function nextRecordStep(step: string): string {
  if (step === 'date') return 'record_type';
  if (step === 'type') return 'record_amount';
  if (step === 'amount') return 'record_category';
  if (step === 'category') return 'record_account';
  if (step === 'account') return 'record_currency';
  if (step === 'currency') return 'record_note';
  if (step === 'note') return 'record_confirm';
  return 'record_date';
}

function stateStepToField(action: string): string {
  return String(action || '').replace(/^record_/, '');
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
  const postbackData = event.postback?.data || '';

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
    await replyLineMessage(event.replyToken, [buildMainMenuFlex(appUrl, false)]);
    return;
  }
  const userDefaultCurrency = getOrCreateUserCurrencySettings(user.id).defaultCurrency;

  if (postbackData) {
    const params = new URLSearchParams(postbackData);
    const action = params.get('action') || '';
    if (action === 'menu') {
      clearLineBotState(lineUserId);
      await replyLineMessage(event.replyToken, [buildMainMenuFlex(appUrl, true)]);
      return;
    }
    if (action === 'record_wizard') {
      const draft: RecordDraft = { date: todayInUserTz(user.timezone || 'Asia/Taipei'), currency: userDefaultCurrency };
      setLineBotState(lineUserId, user.id, 'record_date', '', draft);
      await replyLineMessage(event.replyToken, [buildWizardStep(user, 'record_date', draft)]);
      return;
    }
    if (action === 'wizard_page') {
      const target = params.get('target') || '';
      const page = Math.max(0, Number(params.get('page')) || 0);
      const state = getLineBotState(lineUserId);
      const draft = parseStatePayload(state);
      const nextStep = target === 'account' ? 'record_account' : 'record_category';
      if (target === 'account') draft.accountPage = page;
      else draft.categoryPage = page;
      setLineBotState(lineUserId, user.id, nextStep, draft.type || '', draft);
      await replyLineMessage(event.replyToken, [buildWizardStep(user, nextStep, draft)]);
      return;
    }
    if (action === 'wizard') {
      const step = params.get('step') || '';
      const value = params.get('value') || '';
      const state = getLineBotState(lineUserId);
      const draft = parseStatePayload(state);
      if (step === 'date') draft.date = normalizeDate(value) || todayInUserTz(user.timezone || 'Asia/Taipei');
      if (step === 'type') {
        draft.type = value === 'income' ? 'income' : 'expense';
        draft.categoryId = undefined;
        draft.categoryName = undefined;
        draft.categoryPage = 0;
      }
      if (step === 'category') {
        const category = asRow<CategoryRow>(queryOne(
          `SELECT c.id, c.name, p.name AS parent_name
           FROM categories c
           LEFT JOIN categories p ON p.id = c.parent_id
           WHERE c.id = ? AND c.user_id = ?`,
          [value, user.id]
        ));
        if (category) {
          draft.categoryId = category.id;
          draft.categoryName = `${category.parent_name ? `${category.parent_name}/` : ''}${category.name}`;
          draft.accountPage = 0;
        }
      }
      if (step === 'account') {
        const account = asRow<AccountRow>(queryOne('SELECT id, name, currency FROM accounts WHERE id = ? AND user_id = ?', [value, user.id]));
        if (account) {
          draft.accountId = account.id;
          draft.accountName = account.name;
          draft.currency = draft.currency || normalizeCurrency(account.currency);
        }
      }
      if (step === 'currency') draft.currency = normalizeCurrency(value || userDefaultCurrency);
      if (step === 'note') draft.note = value;
      if (step === 'confirm') {
        clearLineBotState(lineUserId);
        await replyLineMessage(event.replyToken, [createTransactionFromDraft(user, draft)]);
        return;
      }
      const nextStep = nextRecordStep(step);
      setLineBotState(lineUserId, user.id, nextStep, draft.type || '', draft);
      await replyLineMessage(event.replyToken, [buildWizardStep(user, nextStep, draft)]);
      return;
    }
    if (action === 'record') {
      const txType = params.get('type') === 'income' ? 'income' : 'expense';
      const draft: RecordDraft = { date: todayInUserTz(user.timezone || 'Asia/Taipei'), type: txType, currency: userDefaultCurrency };
      setLineBotState(lineUserId, user.id, 'record_date', txType, draft);
      await replyLineMessage(event.replyToken, [buildWizardStep(user, 'record_date', draft)]);
      return;
    }
    if (action === 'query_menu') {
      clearLineBotState(lineUserId);
      await replyLineMessage(event.replyToken, [buildQueryMenuFlex()]);
      return;
    }
    if (action === 'query') {
      clearLineBotState(lineUserId);
      await replyLineMessage(event.replyToken, [queryTransactions(user, queryTextFromPeriod(params.get('period') || 'month'))]);
      return;
    }
  }

  if (!normalized || /^(開始|說明|help|綁定|bind|選單|menu|取消)$/i.test(normalized)) {
    clearLineBotState(lineUserId);
    await replyLineMessage(event.replyToken, [buildMainMenuFlex(appUrl, true)]);
    return;
  }

  const state = getLineBotState(lineUserId);
  if (state?.action?.startsWith('record_')) {
    const draft = parseStatePayload(state);
    const field = stateStepToField(state.action);
    if (field === 'date') {
      const date = normalizeDate(normalized);
      if (!date) {
        await replyLineMessage(event.replyToken, [textMessage('日期格式請使用 YYYY-MM-DD，例如 2026-05-11'), buildWizardStep(user, state.action, draft)]);
        return;
      }
      draft.date = date;
    } else if (field === 'type') {
      if (/收入|income|\+/.test(normalized)) draft.type = 'income';
      else if (/支出|expense|花費|-/.test(normalized)) draft.type = 'expense';
      else {
        await replyLineMessage(event.replyToken, [textMessage('請選擇或輸入「收入」或「支出」。'), buildWizardStep(user, state.action, draft)]);
        return;
      }
      draft.categoryId = undefined;
      draft.categoryName = undefined;
      draft.categoryPage = 0;
    } else if (field === 'amount') {
      const amount = Number(normalized.replace(/,/g, ''));
      if (!Number.isFinite(amount) || amount <= 0) {
        await replyLineMessage(event.replyToken, [textMessage('金額必須大於 0，請只輸入數字。'), buildWizardStep(user, state.action, draft)]);
        return;
      }
      draft.amount = amount;
    } else if (field === 'category') {
      if (!draft.type) {
        setLineBotState(lineUserId, user.id, 'record_type', '', draft);
        await replyLineMessage(event.replyToken, [buildWizardStep(user, 'record_type', draft)]);
        return;
      }
      const categories = listCategories(user.id, draft.type);
      const matched = categories.find((category) => {
        const label = `${category.parent_name || ''}${category.name}`.toLowerCase();
        return label.includes(normalized.toLowerCase()) || normalized.toLowerCase().includes(category.name.toLowerCase());
      });
      if (!matched) {
        await replyLineMessage(event.replyToken, [textMessage('找不到這個分類，請按按鈕選擇或輸入分類名稱。'), buildWizardStep(user, state.action, draft)]);
        return;
      }
      draft.categoryId = matched.id;
      draft.categoryName = `${matched.parent_name ? `${matched.parent_name}/` : ''}${matched.name}`;
      draft.accountPage = 0;
    } else if (field === 'account') {
      const accounts = listAccounts(user.id);
      const matched = accounts.find((account) => account.name.toLowerCase().includes(normalized.toLowerCase()) || normalized.toLowerCase().includes(account.name.toLowerCase()));
      if (!matched) {
        await replyLineMessage(event.replyToken, [textMessage('找不到這個帳戶，請按按鈕選擇或輸入帳戶名稱。'), buildWizardStep(user, state.action, draft)]);
        return;
      }
      draft.accountId = matched.id;
      draft.accountName = matched.name;
      draft.currency = draft.currency || normalizeCurrency(matched.currency);
    } else if (field === 'currency') {
      draft.currency = normalizeCurrency(normalized);
    } else if (field === 'note') {
      draft.note = normalized === '無備註' ? '' : normalized;
    } else if (field === 'confirm') {
      if (/確認|新增|yes|ok/i.test(normalized)) {
        clearLineBotState(lineUserId);
        await replyLineMessage(event.replyToken, [createTransactionFromDraft(user, draft)]);
        return;
      }
      await replyLineMessage(event.replyToken, [buildWizardStep(user, 'record_confirm', draft)]);
      return;
    }

    const nextStep = nextRecordStep(field);
    setLineBotState(lineUserId, user.id, nextStep, draft.type || '', draft);
    await replyLineMessage(event.replyToken, [buildWizardStep(user, nextStep, draft)]);
    return;
  }

  if (state?.action === 'await_record' && (state.tx_type === 'income' || state.tx_type === 'expense')) {
    const detail = parseRecordDetail(normalized, state.tx_type, user.timezone || 'Asia/Taipei', userDefaultCurrency);
    if (!detail) {
      await replyLineMessage(event.replyToken, [
        textMessage(recordRuleText(state.tx_type)),
        buildRecordPromptFlex(state.tx_type),
      ]);
      return;
    }
    clearLineBotState(lineUserId);
    await replyLineMessage(event.replyToken, [createTransactionFromLine(user, detail)]);
    return;
  }

  if (/^(查詢|查|明細|最近)/.test(normalized)) {
    clearLineBotState(lineUserId);
    await replyLineMessage(event.replyToken, [queryTransactions(user, normalized)]);
    return;
  }

  const parsed = parseRecordCommand(normalized, user.timezone || 'Asia/Taipei', userDefaultCurrency);
  if (parsed) {
    clearLineBotState(lineUserId);
    await replyLineMessage(event.replyToken, [createTransactionFromLine(user, parsed)]);
    return;
  }

  await replyLineMessage(event.replyToken, [
    textMessage('請從選單選擇功能，或輸入：支出 120 午餐、收入 5000 薪資、查詢 本月。'),
    buildMainMenuFlex(appUrl, true),
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
