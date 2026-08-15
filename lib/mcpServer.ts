// lib/mcpServer.ts — MCP Server 組裝：註冊唯讀查詢工具，一律以憑證所屬 userId 限定範圍
// 所有工具皆重用既有 lib/*Helpers.ts 計算邏輯，不重新實作財務規則（見 research.md 第 4 節）
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getDB, queryAll, queryOne, saveDB } from './db';
import { writeOperationAudit } from './auditHelpers';
import { getTransactionsSummary, getStockPortfolioStatus } from './dashboardHelpers';
import { getStockRealizedPl } from './stockHelpers';
import { createReadOnlyOAuthToolDescriptor, createWriteOAuthToolDescriptor, createUpdateOAuthToolDescriptor } from './mcpOpenAiCompatibility';
import { normalizeCurrency, convertToTwd, normalizeDate, resolveOverseasFee } from './accountHelpers';
import { todayInUserTz, isValidIsoDate, toIsoUtc } from './userTime';
import { computeTwdAmount } from './moneyDecimal';
import { insertIncomeExpenseTransaction, insertTransferPair } from './transactionWriteCore';
import { uid } from './userDefaults';
import type { VerifyMcpTokenResult } from './mcpAuth';
import { TRANSACTION_NOTE_MAX_LENGTH, findTransactionEditBlock } from './transactionEditRules';

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 20;
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const TRANSACTION_TYPE_LABELS: Record<string, string> = { income: '收入', expense: '支出', transfer: '轉帳' };

interface PaginationInput {
  page?: number;
  pageSize?: number;
}

function resolvePagination({ page, pageSize }: PaginationInput): { page: number; pageSize: number; offset: number } {
  const p = Number.isFinite(page) && Number(page) >= 1 ? Math.floor(Number(page)) : 1;
  const ps = Number.isFinite(pageSize) && Number(pageSize) >= 1 ? Math.floor(Number(pageSize)) : DEFAULT_PAGE_SIZE;
  if (ps > MAX_PAGE_SIZE) {
    throw new Error(`pageSize 不可超過 ${MAX_PAGE_SIZE}`);
  }
  return { page: p, pageSize: ps, offset: (p - 1) * ps };
}

function toolResult(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}

// 每次工具呼叫成功後寫入既有稽核紀錄（FR-005）；讀取類工具 metadata 僅含資料範圍摘要，
// 不含實際查得的金額或明細。action 預設 'mcp_query' 使既有唯讀工具呼叫端不需異動；
// create_transaction（003-mcp-write-no-delete）傳入 action='mcp_create_transaction' 與
// extraMetadata（transaction_id／transaction_summary），此時不需要 scope，可傳 undefined
// （JSON.stringify 會捨棄 undefined 鍵，metadata 內不會出現多餘的 scope 欄位）。
function withAudit<T>(
  credential: VerifyMcpTokenResult,
  scope: string | undefined,
  fn: () => T,
  action = 'mcp_query',
  extraMetadata?: Record<string, unknown>
): T {
  const result = fn();
  writeOperationAudit({
    userId: credential.userId,
    role: 'user',
    action,
    result: 'success',
    metadata: {
      scope,
      mcp_credential_id: credential.credentialId,
      mcp_credential_name: credential.name,
      ...extraMetadata,
    },
  });
  return result;
}

const paginationShape = {
  page: z.number().int().min(1).optional().describe('頁碼，從 1 起算，預設 1'),
  pageSize: z.number().int().min(1).optional().describe(`單頁筆數，預設 ${DEFAULT_PAGE_SIZE}，上限 ${MAX_PAGE_SIZE}`),
};

// 檔案內區域映射函式：list_transactions 與 update_transaction_note 共用同一形狀，讓 AI 端能直接
// 比對「更新前後其他欄位未變」（FR-015）。抽出範圍限於同一檔案內，輸出鍵、順序與數值逐字元不變
// （Principle V 第 3 款）；不 export 以限縮可見範圍。
function mapTransactionRowForMcp(r: Record<string, string | number | null>) {
  return {
    id: r.id,
    type: r.type,
    amount: Number(r.amount) || 0,
    currency: r.currency || 'TWD',
    date: r.date,
    categoryId: r.category_id || null,
    categoryName: r.category_name || null,
    accountId: r.account_id || null,
    accountName: r.account_name || null,
    note: r.note || '',
  };
}

export function buildMcpServer(credential: VerifyMcpTokenResult): McpServer {
  const { userId } = credential;
  const server = new McpServer({ name: 'assetpilot-mcp', version: '1.0.0' });

  server.registerTool(
    'list_transactions',
    {
      ...createReadOnlyOAuthToolDescriptor('查詢交易明細', '正在查詢交易…', '交易明細已載入'),
      description: '查詢一般收支交易明細（分頁），對應既有交易列表頁',
      inputSchema: {
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        type: z.enum(['income', 'expense', 'transfer_in', 'transfer_out']).optional(),
        categoryId: z.string().optional(),
        accountId: z.string().optional(),
        keyword: z.string().optional(),
        excludeTransfer: z.boolean().optional(),
        ...paginationShape,
      },
    },
    async ({ dateFrom, dateTo, type, categoryId, accountId, keyword, excludeTransfer, page, pageSize }) => {
      const { page: p, pageSize: ps, offset } = resolvePagination({ page, pageSize });
      let where = 't.user_id = ?';
      const params: Array<string | number | null> = [userId];
      if (dateFrom) { where += ' AND t.date >= ?'; params.push(dateFrom); }
      if (dateTo) { where += ' AND t.date <= ?'; params.push(dateTo); }
      if (type) { where += ' AND t.type = ?'; params.push(type); }
      if (excludeTransfer) { where += " AND t.type NOT IN ('transfer_in', 'transfer_out')"; }
      if (categoryId) { where += ' AND t.category_id = ?'; params.push(categoryId); }
      if (accountId) { where += ' AND t.account_id = ?'; params.push(accountId); }
      if (keyword) { where += ' AND LOWER(t.note) LIKE LOWER(?)'; params.push(`%${keyword}%`); }

      return withAudit(credential, 'transactions_list', () => {
        const total = Number(queryOne(`SELECT COUNT(*) AS cnt FROM transactions t WHERE ${where}`, params)?.cnt) || 0;
        const rows = queryAll(
          `SELECT t.*, c.name AS category_name, a.name AS account_name
           FROM transactions t
           LEFT JOIN categories c ON c.id = t.category_id
           LEFT JOIN accounts a ON a.id = t.account_id
           WHERE ${where} ORDER BY t.date DESC, t.created_at DESC LIMIT ${ps} OFFSET ${offset}`,
          params
        );
        const items = rows.map(mapTransactionRowForMcp);
        return toolResult({ items, total, page: p, pageSize: ps, totalPages: Math.ceil(total / ps) });
      });
    }
  );

  server.registerTool(
    'get_transactions_summary',
    {
      ...createReadOnlyOAuthToolDescriptor('彙整收支', '正在彙整收支…', '收支彙總已完成'),
      description: '查詢指定期間的收支彙總（依分類彙總、每日/每月彙總、總計），不受筆數上限',
      inputSchema: {
        type: z.enum(['income', 'expense']).optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      },
    },
    async ({ type, from, to }) => withAudit(credential, 'reports_summary', () =>
      toolResult(getTransactionsSummary(userId, { type, from, to }))
    )
  );

  server.registerTool(
    'list_accounts',
    {
      ...createReadOnlyOAuthToolDescriptor('查詢帳戶', '正在查詢帳戶…', '帳戶清單已載入'),
      description: '查詢帳戶清單（含餘額、幣別）',
      inputSchema: { ...paginationShape },
    },
    async ({ page, pageSize }) => {
      const { page: p, pageSize: ps, offset } = resolvePagination({ page, pageSize });
      return withAudit(credential, 'accounts_list', () => {
        const total = Number(queryOne('SELECT COUNT(*) AS cnt FROM accounts WHERE user_id = ?', [userId])?.cnt) || 0;
        const rows = queryAll(
          'SELECT * FROM accounts WHERE user_id = ? ORDER BY created_at LIMIT ? OFFSET ?',
          [userId, ps, offset]
        );
        const items = rows.map((r) => ({
          id: r.id,
          name: r.name,
          category: r.category || null,
          accountType: r.account_type || null,
          currency: r.currency || 'TWD',
          initialBalance: Number(r.initial_balance) || 0,
          excludeFromTotal: r.exclude_from_total === 1,
        }));
        return toolResult({ items, total, page: p, pageSize: ps, totalPages: Math.ceil(total / ps) });
      });
    }
  );

  server.registerTool(
    'list_categories',
    {
      ...createReadOnlyOAuthToolDescriptor('查詢收支分類', '正在查詢分類…', '分類清單已載入'),
      description: '查詢收支分類清單（含階層 parentId）',
      inputSchema: { ...paginationShape },
    },
    async ({ page, pageSize }) => {
      const { page: p, pageSize: ps, offset } = resolvePagination({ page, pageSize });
      return withAudit(credential, 'categories_list', () => {
        const total = Number(queryOne('SELECT COUNT(*) AS cnt FROM categories WHERE user_id = ?', [userId])?.cnt) || 0;
        const rows = queryAll(
          'SELECT id, name, type, color, parent_id FROM categories WHERE user_id = ? ORDER BY sort_order LIMIT ? OFFSET ?',
          [userId, ps, offset]
        );
        const items = rows.map((r) => ({
          id: r.id,
          name: r.name,
          type: r.type,
          color: r.color,
          parentId: r.parent_id || null,
        }));
        return toolResult({ items, total, page: p, pageSize: ps, totalPages: Math.ceil(total / ps) });
      });
    }
  );

  server.registerTool(
    'list_budgets',
    {
      ...createReadOnlyOAuthToolDescriptor('查詢預算', '正在查詢預算…', '預算資料已載入'),
      description: '查詢預算設定與期間內執行狀況',
      inputSchema: { yearMonth: z.string().optional(), ...paginationShape },
    },
    async ({ yearMonth, page, pageSize }) => {
      const { page: p, pageSize: ps, offset } = resolvePagination({ page, pageSize });
      return withAudit(credential, 'budgets_list', () => {
        let where = 'user_id = ?';
        const params: Array<string | number | null> = [userId];
        if (yearMonth) { where += ' AND year_month = ?'; params.push(yearMonth); }
        const total = Number(queryOne(`SELECT COUNT(*) AS cnt FROM budgets WHERE ${where}`, params)?.cnt) || 0;
        const rows = queryAll(`SELECT * FROM budgets WHERE ${where} ORDER BY year_month DESC LIMIT ? OFFSET ?`, [...params, ps, offset]);
        const items = rows.map((b) => {
          let usedSql = "SELECT COALESCE(SUM(twd_amount),0) AS used FROM transactions WHERE user_id = ? AND type='expense' AND date LIKE ? AND exclude_from_stats = 0";
          const usedParams: Array<string | number | null> = [userId, `${b.year_month}%`];
          if (b.category_id) { usedSql += ' AND category_id = ?'; usedParams.push(b.category_id as string); }
          const used = Number(queryOne(usedSql, usedParams)?.used) || 0;
          return {
            id: b.id,
            categoryId: b.category_id || null,
            yearMonth: b.year_month,
            amount: Number(b.amount) || 0,
            used,
          };
        });
        return toolResult({ items, total, page: p, pageSize: ps, totalPages: Math.ceil(total / ps) });
      });
    }
  );

  server.registerTool(
    'list_recurring',
    {
      ...createReadOnlyOAuthToolDescriptor('查詢固定收支', '正在查詢固定收支…', '固定收支已載入'),
      description: '查詢固定收支排程清單',
      inputSchema: { ...paginationShape },
    },
    async ({ page, pageSize }) => {
      const { page: p, pageSize: ps, offset } = resolvePagination({ page, pageSize });
      return withAudit(credential, 'recurring_list', () => {
        const total = Number(queryOne('SELECT COUNT(*) AS cnt FROM recurring WHERE user_id = ?', [userId])?.cnt) || 0;
        const rows = queryAll(
          'SELECT * FROM recurring WHERE user_id = ? ORDER BY start_date DESC LIMIT ? OFFSET ?',
          [userId, ps, offset]
        );
        const items = rows.map((r) => ({
          id: r.id,
          type: r.type,
          amount: Number(r.amount) || 0,
          currency: r.currency || 'TWD',
          categoryId: r.category_id || null,
          accountId: r.account_id || null,
          frequency: r.frequency,
          startDate: r.start_date,
          note: r.note || '',
          isActive: r.is_active === 1,
        }));
        return toolResult({ items, total, page: p, pageSize: ps, totalPages: Math.ceil(total / ps) });
      });
    }
  );

  server.registerTool(
    'list_stock_holdings',
    {
      ...createReadOnlyOAuthToolDescriptor('查詢股票持股', '正在查詢股票持股…', '股票持股已載入'),
      description: '查詢目前股票持股（股數/均價/現價/未實現損益/幣別）',
      inputSchema: {},
    },
    async () => withAudit(credential, 'stock_holdings', () => {
      const status = getStockPortfolioStatus(userId);
      return toolResult({ holdings: status.holdings, marketValue: status.marketValue, health: status.health });
    })
  );

  server.registerTool(
    'list_stock_transactions',
    {
      ...createReadOnlyOAuthToolDescriptor('查詢股票交易', '正在查詢股票交易…', '股票交易已載入'),
      description: '查詢股票買賣交易明細（分頁）',
      inputSchema: {
        stockId: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        type: z.enum(['buy', 'sell']).optional(),
        ...paginationShape,
      },
    },
    async ({ stockId, dateFrom, dateTo, type, page, pageSize }) => {
      const { page: p, pageSize: ps, offset } = resolvePagination({ page, pageSize });
      let where = 'st.user_id = ?';
      const params: Array<string | number | null> = [userId];
      if (stockId) { where += ' AND st.stock_id = ?'; params.push(stockId); }
      if (dateFrom) { where += ' AND st.date >= ?'; params.push(dateFrom); }
      if (dateTo) { where += ' AND st.date <= ?'; params.push(dateTo); }
      if (type) { where += ' AND st.type = ?'; params.push(type); }

      return withAudit(credential, 'stock_transactions_list', () => {
        const total = Number(queryOne(`SELECT COUNT(*) AS cnt FROM stock_transactions st WHERE ${where}`, params)?.cnt) || 0;
        const rows = queryAll(
          `SELECT st.*, s.symbol, s.name AS stock_name
           FROM stock_transactions st LEFT JOIN stocks s ON st.stock_id = s.id
           WHERE ${where} ORDER BY st.date DESC, st.created_at DESC LIMIT ? OFFSET ?`,
          [...params, ps, offset]
        );
        const items = rows.map((r) => ({
          id: r.id,
          stockId: r.stock_id,
          symbol: r.symbol || '',
          name: r.stock_name || '',
          type: r.type,
          shares: Number(r.shares) || 0,
          price: Number(r.price) || 0,
          fee: Number(r.fee) || 0,
          tax: Number(r.tax) || 0,
          date: r.date,
          note: r.note || '',
        }));
        return toolResult({ items, total, page: p, pageSize: ps, totalPages: Math.ceil(total / ps) });
      });
    }
  );

  server.registerTool(
    'list_stock_dividends',
    {
      ...createReadOnlyOAuthToolDescriptor('查詢股票股利', '正在查詢股票股利…', '股票股利已載入'),
      description: '查詢股利發放紀錄（分頁）',
      inputSchema: {
        stockId: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        ...paginationShape,
      },
    },
    async ({ stockId, dateFrom, dateTo, page, pageSize }) => {
      const { page: p, pageSize: ps, offset } = resolvePagination({ page, pageSize });
      let where = 'sd.user_id = ?';
      const params: Array<string | number | null> = [userId];
      if (stockId) { where += ' AND sd.stock_id = ?'; params.push(stockId); }
      if (dateFrom) { where += ' AND sd.date >= ?'; params.push(dateFrom); }
      if (dateTo) { where += ' AND sd.date <= ?'; params.push(dateTo); }

      return withAudit(credential, 'stock_dividends_list', () => {
        const total = Number(queryOne(`SELECT COUNT(*) AS cnt FROM stock_dividends sd WHERE ${where}`, params)?.cnt) || 0;
        const rows = queryAll(
          `SELECT sd.*, s.symbol, s.name AS stock_name
           FROM stock_dividends sd LEFT JOIN stocks s ON sd.stock_id = s.id
           WHERE ${where} ORDER BY sd.date DESC LIMIT ? OFFSET ?`,
          [...params, ps, offset]
        );
        const items = rows.map((r) => ({
          id: r.id,
          stockId: r.stock_id,
          symbol: r.symbol || '',
          name: r.stock_name || '',
          date: r.date,
          cashDividend: Number(r.cash_dividend) || 0,
          stockDividendShares: Number(r.stock_dividend_shares) || 0,
          note: r.note || '',
        }));
        return toolResult({ items, total, page: p, pageSize: ps, totalPages: Math.ceil(total / ps) });
      });
    }
  );

  server.registerTool(
    'list_stock_recurring',
    {
      ...createReadOnlyOAuthToolDescriptor('查詢股票定期定額', '正在查詢定期定額…', '定期定額已載入'),
      description: '查詢股票定期定額排程清單',
      inputSchema: { ...paginationShape },
    },
    async ({ page, pageSize }) => {
      const { page: p, pageSize: ps, offset } = resolvePagination({ page, pageSize });
      return withAudit(credential, 'stock_recurring_list', () => {
        const total = Number(queryOne('SELECT COUNT(*) AS cnt FROM stock_recurring WHERE user_id = ?', [userId])?.cnt) || 0;
        const rows = queryAll(
          `SELECT sr.*, s.symbol, s.name AS stock_name
           FROM stock_recurring sr LEFT JOIN stocks s ON sr.stock_id = s.id
           WHERE sr.user_id = ? ORDER BY sr.start_date DESC LIMIT ? OFFSET ?`,
          [userId, ps, offset]
        );
        const items = rows.map((r) => ({
          id: r.id,
          stockId: r.stock_id,
          symbol: r.symbol || '',
          name: r.stock_name || '',
          amount: Number(r.amount) || 0,
          frequency: r.frequency,
          startDate: r.start_date,
          isActive: r.is_active === 1,
          note: r.note || '',
        }));
        return toolResult({ items, total, page: p, pageSize: ps, totalPages: Math.ceil(total / ps) });
      });
    }
  );

  server.registerTool(
    'get_stock_realized_pl',
    {
      ...createReadOnlyOAuthToolDescriptor('查詢股票已實現損益', '正在計算已實現損益…', '已實現損益已載入'),
      description: '查詢已實現損益（逐筆明細分頁，彙總總計不受限）',
      inputSchema: {
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
        stockId: z.string().optional(),
        ...paginationShape,
      },
    },
    async ({ dateFrom, dateTo, stockId, page, pageSize }) => withAudit(credential, 'stock_realized_pl', () => {
      const { page: p, pageSize: ps, offset } = resolvePagination({ page, pageSize });
      const result = getStockRealizedPl(userId, { dateFrom, dateTo, stockId });
      const total = result.entries.length;
      const items = result.entries.slice(offset, offset + ps);
      return toolResult({ items, total, page: p, pageSize: ps, totalPages: Math.ceil(total / ps), summary: result.summary });
    })
  );

  // create_transaction 僅在憑證已開啟「允許新增資料」時才註冊；未開啟的連線的 tools/list
  // 結果裡不存在這個工具（FR-005／FR-006，見 research.md 第 1 節）。update_transaction_note 則在
  // 「允許更新備註」開啟時另行獨立註冊——兩個 if 各自獨立判斷、不巢狀、不串接，使兩種寫入權限
  // 彼此獨立（FR-005）。刪除／修改其他欄位的工具則永遠不存在於任何程式碼路徑，不因權限而有例外
  // ——不在本檔任何地方出現。
  if (credential.allowCreate === true) {
    server.registerTool(
      'create_transaction',
      {
        ...createWriteOAuthToolDescriptor('新增交易', '正在新增交易…', '交易已新增'),
        description: '新增一筆一般交易紀錄（收入、支出或轉帳），視同使用者本人手動建立；僅能新增，無法修改或刪除既有資料。',
        inputSchema: {
          type: z.string().optional().describe("交易類型：'income'（收入）｜'expense'（支出）｜'transfer'（轉帳）"),
          amount: z.union([z.number(), z.string()]).optional().describe('交易金額，必須大於 0（以 currency 欄位所指定的幣別計）'),
          currency: z.string().optional().describe("ISO 4217 幣別碼，預設 'TWD'"),
          fxRate: z.number().optional().describe('手動指定匯率；未提供時自動查匯率；type=transfer 時忽略'),
          date: z.string().optional().describe('交易日期 YYYY-MM-DD；未提供時為使用者所屬時區的今天'),
          categoryId: z.string().optional().describe('分類 id（僅 income/expense 有意義；找不到本人所屬分類時視為未分類，不拒絕建立）'),
          accountId: z.string().optional().describe('帳戶 id（income/expense 用；使用者僅一個帳戶時可省略，自動代入）'),
          fromAccountId: z.string().optional().describe('轉出帳戶 id（type=transfer 時必填，須為本人所有）'),
          toAccountId: z.string().optional().describe('轉入帳戶 id（type=transfer 時必填，須為本人所有，不可與 fromAccountId 相同）'),
          note: z.string().optional().describe('備註全文；會存入交易本身，但不會寫入稽核日誌'),
          idempotencyKey: z.string().optional().describe('冪等鍵；同一憑證 24 小時內以相同值重複呼叫，回傳先前建立結果，不重複建立'),
        },
      },
      async ({ type, amount, currency, fxRate, date: rawDate, categoryId, accountId, fromAccountId, toAccountId, note, idempotencyKey }) => {
        if (idempotencyKey) {
          const cached = queryOne(
            'SELECT response_json FROM mcp_transaction_idempotency WHERE credential_id = ? AND idempotency_key = ? AND expires_at > ?',
            [credential.credentialId, idempotencyKey, Date.now()]
          );
          if (cached) {
            return toolResult(JSON.parse(String(cached.response_json)));
          }
        }

        if (type !== 'income' && type !== 'expense' && type !== 'transfer') {
          throw new Error('交易類型無效');
        }
        const numAmount = Number(amount);
        if (!Number.isFinite(numAmount) || numAmount <= 0) {
          throw new Error('金額必須大於 0');
        }
        let date: string;
        if (rawDate == null || String(rawDate).trim() === '') {
          const userRow = queryOne('SELECT timezone FROM users WHERE id = ?', [userId]);
          date = todayInUserTz((userRow?.timezone as string) || 'Asia/Taipei');
        } else {
          date = normalizeDate(rawDate);
        }
        if (!date || !isValidIsoDate(date)) {
          throw new Error('日期格式無效');
        }

        let response: Record<string, unknown> = {};
        let transactionIdForAudit = '';
        let linkedTransactionIdForAudit = '';
        let summary = '';

        if (type === 'transfer') {
          if (!fromAccountId || !toAccountId) throw new Error('缺少帳戶資訊');
          if (fromAccountId === toAccountId) throw new Error('轉出與轉入帳戶不可相同');
          const fromAccount = queryOne('SELECT id, currency FROM accounts WHERE id = ? AND user_id = ?', [fromAccountId, userId]);
          const toAccount = queryOne('SELECT id, currency FROM accounts WHERE id = ? AND user_id = ?', [toAccountId, userId]);
          if (!fromAccount || !toAccount) throw new Error('帳戶不存在或無權限');
          const fromCurrency = normalizeCurrency(fromAccount.currency as string | null);
          const toCurrency = normalizeCurrency(toAccount.currency as string | null);
          if (fromCurrency !== toCurrency) {
            throw new Error('CrossCurrencyTransfer：跨幣別請分開記一筆支出＋一筆收入');
          }

          const converted = convertToTwd(numAmount, fromCurrency, null, userId);
          const pair = insertTransferPair({
            userId, fromAccountId, toAccountId, fromCurrency, toCurrency,
            twdAmount: converted.twdAmount, originalAmount: converted.originalAmount, fxRate: converted.fxRate,
            date, note: note || '轉帳',
          });
          response = { transferOut: pair.transferOut, transferIn: pair.transferIn };
          transactionIdForAudit = pair.transferOut.id;
          linkedTransactionIdForAudit = pair.transferIn.id;
          summary = `轉帳 ${converted.originalAmount} 元`;
        } else {
          const accounts = queryAll('SELECT id FROM accounts WHERE user_id = ?', [userId]);
          let resolvedAccountId: string;
          if (accountId) {
            if (!accounts.some((a) => String(a.id) === accountId)) throw new Error('帳戶不存在或無權限');
            resolvedAccountId = accountId;
          } else if (accounts.length === 1) {
            resolvedAccountId = String(accounts[0].id);
          } else if (accounts.length === 0) {
            throw new Error('帳戶不存在或無權限');
          } else {
            throw new Error('使用者名下有多個帳戶，請指定 accountId');
          }

          let resolvedCategoryId: string | null = null;
          if (categoryId) {
            const owned = queryOne('SELECT id FROM categories WHERE id = ? AND user_id = ?', [categoryId, userId]);
            resolvedCategoryId = owned ? categoryId : null;
          }

          const converted = convertToTwd(numAmount, currency || 'TWD', fxRate, userId);
          const fxFee = resolveOverseasFee({
            userId, accountId: resolvedAccountId, currency: converted.currency, twdBase: converted.twdAmount, clientFxFee: undefined,
          });
          const twdAmountInt = computeTwdAmount(Math.round(converted.originalAmount * 100) / 100, converted.fxRate, 0);

          const created = insertIncomeExpenseTransaction({
            userId, type, twdAmount: twdAmountInt, currency: converted.currency, originalAmount: converted.originalAmount,
            fxRate: converted.fxRate, fxFee, date, categoryId: resolvedCategoryId, accountId: resolvedAccountId,
            note: note || '', excludeFromStats: false,
          });
          response = {
            id: created.id, type, amount: converted.originalAmount, currency: converted.currency, date,
            categoryId: resolvedCategoryId, accountId: resolvedAccountId, note: note || '',
            createdAt: toIsoUtc(created.updatedAt),
          };
          transactionIdForAudit = created.id;
          summary = `${TRANSACTION_TYPE_LABELS[type]} ${converted.originalAmount} 元`;
        }

        if (idempotencyKey) {
          const idemNow = Date.now();
          getDB().run(
            `INSERT INTO mcp_transaction_idempotency
             (id, credential_id, user_id, idempotency_key, transaction_id, linked_transaction_id, response_json, created_at, expires_at)
             VALUES (?,?,?,?,?,?,?,?,?)
             ON CONFLICT (credential_id, idempotency_key) DO NOTHING`,
            [uid(), credential.credentialId, userId, idempotencyKey, transactionIdForAudit, linkedTransactionIdForAudit, JSON.stringify(response), idemNow, idemNow + IDEMPOTENCY_TTL_MS]
          );
          saveDB();
          // 極端併發：兩個相同 key 的請求同時通過命中檢查，衝突後改讀已存在列，確保回應與稽核不重複建立。
          const stored = queryOne(
            'SELECT response_json FROM mcp_transaction_idempotency WHERE credential_id = ? AND idempotency_key = ?',
            [credential.credentialId, idempotencyKey]
          );
          if (stored) response = JSON.parse(String(stored.response_json));
        }

        return withAudit(
          credential,
          undefined,
          () => toolResult(response),
          'mcp_create_transaction',
          { transaction_id: transactionIdForAudit, transaction_summary: summary }
        );
      }
    );
  }

  // update_transaction_note 僅在憑證已開啟「允許更新備註」時才註冊；與上面的 create_transaction
  // 各自獨立判斷，不巢狀、不串接（FR-005 權限獨立性）。
  if (credential.allowUpdateNote === true) {
    server.registerTool(
      'update_transaction_note',
      {
        ...createUpdateOAuthToolDescriptor('更新交易備註', '正在更新備註…', '備註已更新'),
        description: '更新一筆既有交易紀錄的備註文字，視同使用者本人手動編輯備註；僅能修改備註，無法變更日期、類型、分類、金額、帳戶，也無法刪除任何資料。',
        // 不得改用 .strict()：zod 物件預設剝除未宣告鍵，正是 FR-002／User Story 3 情境 2 要求的
        // 「夾帶其他欄位不失敗也不生效」行為。不提供陣列／批次參數（FR-001）、idempotencyKey
        // （research.md 第 8 節）或 expectedUpdatedAt（research.md 第 5 節）。
        inputSchema: {
          transactionId: z.string().describe('要更新備註的交易 id（須為本人名下既有交易，可由 list_transactions 取得）'),
          note: z.string().describe('新的備註全文；空字串代表清空備註；長度上限 200 字'),
        },
      },
      async ({ transactionId, note }) => {
        // 處理順序第 1-3 步：前置檢查，順序不可調換，任一失敗皆不變更任何資料、不寫入稽核。
        if (String(note).length > TRANSACTION_NOTE_MAX_LENGTH) {
          throw new Error(`備註長度不可超過 ${TRANSACTION_NOTE_MAX_LENGTH} 字`);
        }
        // 欄位清單須逐一列舉、禁止省略號；須涵蓋 findTransactionEditBlock() 讀取的所有欄位。
        const row = queryOne(
          'SELECT id, is_fx_fee FROM transactions WHERE id = ? AND user_id = ?',
          [transactionId, userId]
        );
        if (!row) {
          throw new Error('交易不存在或無權限');
        }
        const editBlock = findTransactionEditBlock({ is_fx_fee: row.is_fx_fee as number | null });
        if (editBlock) {
          throw new Error(editBlock.message);
        }

        // 處理順序第 4 步：單一 SQL 陳述式只寫 note 與 updated_at，嚴禁讀改寫（FR-002、並行編輯保證）。
        getDB().run(
          'UPDATE transactions SET note = ?, updated_at = ? WHERE id = ? AND user_id = ?',
          [note, Date.now(), transactionId, userId]
        );
        saveDB();

        // 處理順序第 5 步：重新查詢該列以組出回應（FR-015），比照 list_transactions 的查詢形狀。
        const updated = queryOne(
          `SELECT t.*, c.name AS category_name, a.name AS account_name
           FROM transactions t
           LEFT JOIN categories c ON c.id = t.category_id
           LEFT JOIN accounts a ON a.id = t.account_id
           WHERE t.id = ? AND t.user_id = ?`,
          [transactionId, userId]
        );
        const transaction = mapTransactionRowForMcp(updated as Record<string, string | number | null>);
        const response = { ok: true, transaction };

        // 處理順序第 6 步：寫入稽核（僅成功時，FR-012）。metadata 只放 transaction_id——刻意不加
        // transaction_summary（本功能不變更金額，違反 FR-012 保守揭露原則），更絕對不得放備註內容。
        return withAudit(
          credential,
          undefined,
          () => toolResult(response),
          'mcp_update_transaction_note',
          { transaction_id: transactionId }
        );
      }
    );
  }

  return server;
}
