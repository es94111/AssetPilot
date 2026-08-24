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

import crypto from "crypto";
import { getDB, queryOne } from "./db";
import { purgeUserPhotoFiles } from "./transactionAttachments";

// 所有「以 user_id 為外鍵、屬於該使用者」的資料表。新增使用者相關資料表時，請同步加入此清單。
// 以固定 SQL 清單取代動態表名插值；表名不是使用者輸入，也不應進入 SQL 組字串流程。
const USER_OWNED_DELETE_STATEMENTS = [
  // 記帳核心
  "DELETE FROM transactions WHERE user_id = ?",
  "DELETE FROM accounts WHERE user_id = ?",
  "DELETE FROM categories WHERE user_id = ?",
  "DELETE FROM budgets WHERE user_id = ?",
  "DELETE FROM recurring WHERE user_id = ?",
  "DELETE FROM deleted_defaults WHERE user_id = ?",
  "DELETE FROM credit_card_repayment_summaries WHERE user_id = ?",
  // 股票
  "DELETE FROM stocks WHERE user_id = ?",
  "DELETE FROM stock_transactions WHERE user_id = ?",
  "DELETE FROM stock_dividends WHERE user_id = ?",
  "DELETE FROM stock_recurring WHERE user_id = ?",
  "DELETE FROM stock_settings WHERE user_id = ?",
  // 匯率
  "DELETE FROM exchange_rates WHERE user_id = ?",
  "DELETE FROM exchange_rate_settings WHERE user_id = ?",
  // 使用者設定 / 排程 / 通知綁定
  "DELETE FROM user_settings WHERE user_id = ?",
  "DELETE FROM monthly_report_send_log WHERE user_id = ?",
  "DELETE FROM report_schedules WHERE user_id = ?",
  "DELETE FROM line_expense_reminders WHERE user_id = ?",
  "DELETE FROM line_bot_states WHERE user_id = ?",
  // 驗證 / 工作階段
  "DELETE FROM passkey_credentials WHERE user_id = ?",
  "DELETE FROM login_sessions WHERE user_id = ?",
  // 交易憑證照片（實體檔案另由 purgeUserPhotoFiles 處理）
  "DELETE FROM transaction_attachments WHERE user_id = ?",
  // 照片金鑰（刪除即密碼學銷毀殘留密文）
  "DELETE FROM user_photo_keys WHERE user_id = ?",
  // 稽核
  "DELETE FROM login_audit_logs WHERE user_id = ?",
  "DELETE FROM data_operation_audit_log WHERE user_id = ?",
  // MCP 存取憑證 / OAuth 授權
  "DELETE FROM mcp_oauth_authorization_codes WHERE user_id = ?",
  "DELETE FROM mcp_oauth_tokens WHERE user_id = ?",
  "DELETE FROM mcp_credentials WHERE user_id = ?",
  "DELETE FROM mcp_oauth_connections WHERE user_id = ?",
  "DELETE FROM mcp_transaction_idempotency WHERE user_id = ?",
] as const;

function normalizeEmail(email: string | number | null | undefined): string {
  return String(email || "")
    .trim()
    .toLowerCase();
}

function createHashedEmail(email: string | number | null | undefined): string {
  return crypto
    .createHash("sha256")
    .update(normalizeEmail(email))
    .digest("hex");
}

// 從 system_settings.report_schedule_user_ids（JSON 陣列字串）移除指定使用者。
function removeFromReportScheduleTargets(
  db: ReturnType<typeof getDB>,
  userId: string,
): void {
  const row = queryOne(
    "SELECT report_schedule_user_ids FROM system_settings WHERE id = 1",
  );
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
  db.run(
    "UPDATE system_settings SET report_schedule_user_ids = ? WHERE id = 1",
    [JSON.stringify(next)],
  );
}

// 完整刪除單一使用者的所有資料。呼叫端負責 saveDB()（以便與其後續操作合併存檔）。
export async function deleteUserCompletely(userId: string): Promise<void> {
  const db = getDB();
  const user = queryOne("SELECT email FROM users WHERE id = ?", [userId]);
  const hashedEmail = user ? createHashedEmail(user.email || "") : "";

  // 1) 先刪實體照片檔案（需在 DB 列被刪除前讀取 transaction_attachments）。
  //    檔案層失敗不阻擋帳號刪除；purgeUserPhotoFiles 內部已吞下個別錯誤。
  try {
    await purgeUserPhotoFiles(userId);
  } catch {
    // 即使實體清理整體失敗，仍繼續刪除 DB 資料，避免帳號刪不掉。
  }

  // 2) 在交易內刪除所有 user_id 關聯資料表 + 去識別化登入嘗試紀錄 + 移除全域引用 + 刪除使用者。
  // migrations 已確保下列資料表存在；任何 DB 例外都必須觸發回滾並回報，
  // 不可吞掉錯誤後讓呼叫端誤以為帳號已完整刪除。
  db.run("BEGIN");
  try {
    for (const statement of USER_OWNED_DELETE_STATEMENTS) {
      db.run(statement, [userId]);
    }
    // 登入嘗試：成功的刪除；失敗的保留但去識別化（風控需要）。
    db.run(
      "UPDATE login_attempt_logs SET user_id = '', email = ? WHERE user_id = ? AND is_success = 0",
      [hashedEmail, userId],
    );
    db.run(
      "DELETE FROM login_attempt_logs WHERE user_id = ? AND is_success = 1",
      [userId],
    );
    removeFromReportScheduleTargets(db, userId);
    db.run("DELETE FROM users WHERE id = ?", [userId]);
    db.run("COMMIT");
  } catch (error) {
    try {
      db.run("ROLLBACK");
    } catch (rollbackError) {
      console.error("[userDeletion] rollback failed", rollbackError);
    }
    throw error;
  }
}
