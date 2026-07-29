// lib/mcpServer.ts — MCP Server 組裝：註冊唯讀查詢工具，一律以憑證所屬 userId 限定範圍
// 所有工具皆重用既有 lib/*Helpers.ts 計算邏輯，不重新實作財務規則（見 research.md 第 4 節）
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { queryAll, queryOne } from './db';
import { writeOperationAudit } from './auditHelpers';
import { getTransactionsSummary, getStockPortfolioStatus } from './dashboardHelpers';
import { getStockRealizedPl } from './stockHelpers';
import { createReadOnlyOAuthToolDescriptor } from './mcpOpenAiCompatibility';
import type { VerifyMcpTokenResult } from './mcpAuth';

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 20;

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

// 每次工具呼叫成功後寫入既有稽核紀錄（FR-005）；metadata 僅含資料範圍摘要，不含實際查得的金額或明細。
function withAudit<T>(credential: VerifyMcpTokenResult, scope: string, fn: () => T): T {
  const result = fn();
  writeOperationAudit({
    userId: credential.userId,
    role: 'user',
    action: 'mcp_query',
    result: 'success',
    metadata: {
      scope,
      mcp_credential_id: credential.credentialId,
      mcp_credential_name: credential.name,
    },
  });
  return result;
}

const paginationShape = {
  page: z.number().int().min(1).optional().describe('頁碼，從 1 起算，預設 1'),
  pageSize: z.number().int().min(1).optional().describe(`單頁筆數，預設 ${DEFAULT_PAGE_SIZE}，上限 ${MAX_PAGE_SIZE}`),
};

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
        const items = rows.map((r) => ({
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
        }));
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

  return server;
}
