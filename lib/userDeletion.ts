// lib/userDeletion.ts — 單一可信賴的「完整刪除使用者資料」流程。
// 自助刪除帳號（/api/account/delete）與管理員刪除使用者（/api/admin/users/[id]）
// 一律走此函式，避免兩條路徑各自維護、各自漏表。
//
// 完整刪除涵蓋三層：
//  1) 交易憑證照片的「實體檔案」（本機 + S3）— 不只密碼學銷毀，連檔案/物件都移除。
//  2) 所有以 user_id 關聯的資料表列（含 transaction_attachments、user_photo_keys 等）。
//  3) 全域設定中對該使用者的引用（report_schedule_user_ids）。
//
// 登入嘗試紀錄（login_attempt_logs）採「保留但去識別化」：成功紀錄刪除，
// 失敗紀錄保留以維持風控/速率限制，但清除 user_id 並以雜湊信箱取代明文 email。

import crypto from 'crypto';
import { getDB, queryOne } from './db';
import { purgeUserPhotoFiles } from './transactionAttachments';

// 所有「以 user_id 為外鍵、屬於該使用者」的資料表。新增使用者相關資料表時，請同步加入此清單。
const USER_OWNED_TABLES = [
  // 記帳核心
  'transactions', 'accounts', 'categories', 'budgets', 'recurring',
  'deleted_defaults',
  // 股票
  'stocks', 'stock_transactions', 'stock_dividends', 'stock_recurring', 'stock_settings',
  // 匯率
  'exchange_rates', 'exchange_rate_settings',
  // 使用者設定 / 排程 / 通知綁定
  'user_settings', 'report_schedules', 'line_expense_reminders', 'line_bot_states',
  // 驗證 / 工作階段
  'passkey_credentials', 'login_sessions',
  // 交易憑證照片（實體檔案另由 purgeUserPhotoFiles 處理）
  'transaction_attachments',
  // 照片金鑰（刪除即密碼學銷毀殘留密文）
  'user_photo_keys',
  // 稽核
  'login_audit_logs', 'data_operation_audit_log',
  // MCP 存取憑證
  'mcp_credentials',
];

function normalizeEmail(email: string | number | null | undefined): string {
  return String(email || '').trim().toLowerCase();
}

function createHashedEmail(email: string | number | null | undefined): string {
  return crypto.createHash('sha256').update(normalizeEmail(email)).digest('hex');
}

// 從 system_settings.report_schedule_user_ids（JSON 陣列字串）移除指定使用者。
function removeFromReportScheduleTargets(db: ReturnType<typeof getDB>, userId: string): void {
  const row = queryOne('SELECT report_schedule_user_ids FROM system_settings WHERE id = 1');
  const raw = row?.report_schedule_user_ids;
  if (!raw) return;
  let list: string[] = [];
  try {
    const parsed = JSON.parse(String(raw));
    if (Array.isArray(parsed)) list = parsed.map(String).filter(Boolean);
  } catch {
    return; // 格式異常時不更動，避免破壞既有值
  }
  if (!list.includes(userId)) return;
  const next = list.filter((id) => id !== userId);
  db.run('UPDATE system_settings SET report_schedule_user_ids = ? WHERE id = 1', [JSON.stringify(next)]);
}

// 完整刪除單一使用者的所有資料。呼叫端負責 saveDB()（以便與其後續操作合併存檔）。
export async function deleteUserCompletely(userId: string): Promise<void> {
  const db = getDB();
  const user = queryOne('SELECT email FROM users WHERE id = ?', [userId]);
  const hashedEmail = user ? createHashedEmail(user.email || '') : '';

  // 1) 先刪實體照片檔案（需在 DB 列被刪除前讀取 transaction_attachments）。
  //    檔案層失敗不阻擋帳號刪除；purgeUserPhotoFiles 內部已吞下個別錯誤。
  try {
    await purgeUserPhotoFiles(userId);
  } catch {
    // 即使實體清理整體失敗，仍繼續刪除 DB 資料，避免帳號刪不掉。
  }

  // 2) 在交易內刪除所有 user_id 關聯資料表 + 去識別化登入嘗試紀錄 + 移除全域引用 + 刪除使用者。
  try { db.run('BEGIN'); } catch {}
  for (const table of USER_OWNED_TABLES) {
    try { db.run(`DELETE FROM ${table} WHERE user_id = ?`, [userId]); } catch {}
  }
  // 登入嘗試：成功的刪除；失敗的保留但去識別化（風控需要）。
  try {
    db.run("UPDATE login_attempt_logs SET user_id = '', email = ? WHERE user_id = ? AND is_success = 0", [hashedEmail, userId]);
    db.run('DELETE FROM login_attempt_logs WHERE user_id = ? AND is_success = 1', [userId]);
  } catch {}
  removeFromReportScheduleTargets(db, userId);
  db.run('DELETE FROM users WHERE id = ?', [userId]);
  try { db.run('COMMIT'); } catch {}
}
