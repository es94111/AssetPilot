// tests/e2e/support/testUser.ts — E2E 測試使用者 fixture
//
// 密碼登入已停用（app/api/auth/login/route.ts 回 410），一般使用者只能透過
// Google／LINE／Passkey 登入，無法在自動化測試中重現且會依賴正式環境憑證。
// 因此改用與 tests/lib/*.test.ts 相同的作法：直接寫入 PostgreSQL 建立使用者，
// 以 lib/sessionHelpers.createLoginSession() 產生合法的 authToken JWT，
// 再由 Playwright 以 context.addCookies() 注入瀏覽器，等效於「已登入」狀態。
// 全程不呼叫任何第三方 OAuth provider，亦不需要任何正式環境密鑰。
import { initDB, getDB, saveDB } from '../../../lib/db';
import { createDefaultsForUser, uid } from '../../../lib/userDefaults';
import { createLoginSession } from '../../../lib/sessionHelpers';

export interface E2ETestUser {
  id: string;
  email: string;
  displayName: string;
  /** 已簽署的 authToken JWT；可直接設為同名 cookie 使用。 */
  token: string;
}

let dbReady: Promise<void> | null = null;

async function ensureDb(): Promise<void> {
  if (!dbReady) dbReady = initDB();
  await dbReady;
}

/**
 * 建立一個全新、彼此獨立的測試使用者（含預設分類／現金帳戶／股票設定等）。
 * 每個使用者 id 皆以 `e2e_` 為前綴並帶隨機亂碼，測試之間不會互相影響，
 * 可放心並行執行。
 */
export async function createE2ETestUser(options: { displayName?: string } = {}): Promise<E2ETestUser> {
  await ensureDb();
  const id = `e2e_${uid()}`;
  const email = `${id}@e2e.assetpilot.test`;
  const displayName = options.displayName || 'E2E Test User';
  const now = new Date().toISOString();

  const db = getDB();
  db.run(
    'INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?,?,?,?,?)',
    [id, email, 'e2e-no-password-login', displayName, now],
  );
  createDefaultsForUser(id);
  saveDB();

  const { token } = createLoginSession(id, 0, {});
  return { id, email, displayName, token };
}

/**
 * 直接在 DB 建立一檔股票（不經過 UI／外部報價 API），供持股相關測試使用，
 * 避免依賴 TWSE／Yahoo Finance 等外部服務的可用性。
 */
export async function createE2EStock(
  userId: string,
  options: { symbol?: string; name?: string; market?: 'TW' | 'US' } = {},
): Promise<{ id: string; symbol: string; name: string }> {
  await ensureDb();
  const id = uid();
  const symbol = options.symbol || '2330';
  const name = options.name || '台積電';
  const market = options.market || 'TW';
  const db = getDB();
  db.run(
    'INSERT INTO stocks (id, user_id, symbol, market, name, shares, avg_cost, currency, created_at) VALUES (?,?,?,?,?,?,?,?,?)',
    [id, userId, symbol, market, name, 0, 0, 'TWD', Date.now()],
  );
  saveDB();
  return { id, symbol, name };
}

/**
 * 直接在 DB 建立一筆交易，供報表／匯出等不需要重複測試「新增交易」流程的
 * 情境快速準備資料。
 */
export async function createE2ETransaction(
  userId: string,
  options: { type?: 'income' | 'expense'; amount?: number; date?: string; note?: string },
): Promise<string> {
  await ensureDb();
  const id = uid();
  const now = Date.now();
  const db = getDB();
  db.run(
    'INSERT INTO transactions (id, user_id, type, amount, currency, date, note, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)',
    [
      id,
      userId,
      options.type || 'expense',
      options.amount ?? 1000,
      'TWD',
      options.date || new Date().toISOString().slice(0, 10),
      options.note || 'E2E seed',
      now,
      now,
    ],
  );
  saveDB();
  return id;
}

/** 刪除測試使用者與其所有關聯資料（best-effort；每個 table 失敗不影響其他 table）。 */
export async function deleteE2ETestUser(userId: string): Promise<void> {
  await ensureDb();
  const db = getDB();
  const userScopedTables = [
    'transactions',
    'budgets',
    'stocks',
    'stock_transactions',
    'stock_dividends',
    'stock_recurring',
    'recurring',
    'accounts',
    'categories',
    'login_sessions',
    'deleted_defaults',
    'user_settings',
    'exchange_rates',
    'exchange_rate_settings',
    'stock_settings',
    'data_operation_audit_log',
    'login_audit_logs',
  ];
  for (const table of userScopedTables) {
    try {
      db.run(`DELETE FROM ${table} WHERE user_id = ?`, [userId]);
    } catch {
      // Table 可能不存在 user_id 欄位或尚未建立；測試資料庫，略過即可。
    }
  }
  try {
    db.run('DELETE FROM users WHERE id = ?', [userId]);
  } catch {
    // ignore
  }
  saveDB();
}
