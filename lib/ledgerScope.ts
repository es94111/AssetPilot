// lib/ledgerScope.ts — 非 Web 用戶端（MCP／API Token／LINE／排程）的帳本範圍解析
//
// Web 端以 `x-ledger-id` 標頭走 lib/ledgerContext.ts 的 applyLedgerContext()；
// 這些用戶端沒有 Cookie 與標頭，改以「明確傳入的帳本 ID」解析出：
//   - dataOwnerId：實際擁有資料列的 user_id（共享帳本為 ledger 的 data_owner_id）
//   - role：呼叫者在該帳本當下的成員角色（每次呼叫都重新查詢，不信任先前結果）
//
// 未指定帳本時一律回退到呼叫者自己的個人帳本，維持既有個人整合行為不變。
// 憑證本身（MCP PAT／API Token／LINE 綁定／登入 session）永遠屬於個人，不隨帳本轉移。
import { queryAll, queryOne } from "./db";
import { canWriteLedger, isLedgerRole, type LedgerRole } from "./ledgerPolicy";
import { ensurePersonalLedger } from "./ledgerContext";

export type LedgerScopeFailureReason = "not-a-member" | "read-only" | "not-found";

export type LedgerScope = {
  ledgerId: string;
  dataOwnerId: string;
  role: LedgerRole;
  isShared: boolean;
  ledgerName: string;
  timezone: string;
};

export type LedgerScopeResolution =
  | ({ ok: true } & LedgerScope)
  | { ok: false; reason: LedgerScopeFailureReason };

export type LedgerSummary = {
  ledgerId: string;
  name: string;
  role: LedgerRole;
  isShared: boolean;
};

type LedgerScopeRow = Record<string, string | number | null>;

export function personalLedgerId(userId: string): string {
  return `personal:${userId}`;
}

/**
 * 解析呼叫者對指定帳本的存取範圍。
 *
 * @param userId   憑證所屬使用者（絕不代換成帳本資料擁有者）
 * @param ledgerId 明確指定的帳本；空字串／undefined 代表個人帳本
 * @param write    是否為寫入操作（viewer 會被拒絕）
 */
export function resolveLedgerScope(input: {
  userId: string;
  ledgerId?: string | null;
  write?: boolean;
}): LedgerScopeResolution {
  const userId = String(input.userId || "").trim();
  if (!userId) return { ok: false, reason: "not-found" };
  const requested = String(input.ledgerId || "").trim();
  const ledgerId = requested || ensurePersonalLedger(userId);

  const row = queryOne(
    `SELECT l.id, l.name, l.data_owner_id, l.is_shared, l.timezone, m.role
       FROM financial_ledgers l
       JOIN ledger_members m ON m.ledger_id = l.id AND m.user_id = ?
      WHERE l.id = ?`,
    [userId, ledgerId],
  ) as LedgerScopeRow | null;

  if (!row || !isLedgerRole(row.role)) {
    return { ok: false, reason: "not-a-member" };
  }
  if (input.write && !canWriteLedger(row.role)) {
    return { ok: false, reason: "read-only" };
  }
  return {
    ok: true,
    ledgerId: String(row.id),
    dataOwnerId: String(row.data_owner_id || userId),
    role: row.role,
    isShared: Number(row.is_shared) === 1,
    ledgerName: String(row.name || ""),
    timezone: String(row.timezone || "Asia/Taipei"),
  };
}

/**
 * 解析「呼叫者仍是成員」的帳本清單；離開／被移除的帳本不會出現。
 * 供 MCP 工具與 LINE 選單顯示可選帳本，選取後仍會逐次重新解析授權。
 */
export function listAuthorizedLedgers(userId: string): LedgerSummary[] {
  const actorId = String(userId || "").trim();
  if (!actorId) return [];
  ensurePersonalLedger(actorId);
  const rows = queryAll(
    `SELECT l.id, l.name, l.is_shared, m.role
       FROM financial_ledgers l
       JOIN ledger_members m ON m.ledger_id = l.id
      WHERE m.user_id = ?
      ORDER BY l.is_shared DESC, l.created_at DESC, l.id`,
    [actorId],
  );
  const summaries: LedgerSummary[] = [];
  for (const row of rows) {
    if (!isLedgerRole(row.role)) continue;
    summaries.push({
      ledgerId: String(row.id),
      name: String(row.name || ""),
      role: row.role,
      isShared: Number(row.is_shared) === 1,
    });
  }
  return summaries;
}

/**
 * 共享帳本備份／還原的擁有者授權（issue #281）。
 *
 * 個人 bundle 只涵蓋呼叫者自己的個人帳本，行為不變；一旦指定共享帳本，就必須是
 * 該帳本的 owner——editor／viewer 不得匯出他人的共享帳本，也不得用備份覆寫它。
 */
export function resolveBundleLedger(input: {
  userId: string;
  ledgerId?: string | null;
}):
  | { ok: true; dataOwnerId: string; ledgerId: string; isShared: boolean }
  | { ok: false; reason: "not-a-member" | "not-owner" | "not-found" } {
  const resolved = resolveLedgerScope({ userId: input.userId, ledgerId: input.ledgerId });
  if (!resolved.ok) {
    return { ok: false, reason: resolved.reason === "read-only" ? "not-a-member" : resolved.reason };
  }
  if (resolved.isShared && resolved.role !== "owner") {
    return { ok: false, reason: "not-owner" };
  }
  return {
    ok: true,
    dataOwnerId: resolved.dataOwnerId,
    ledgerId: resolved.ledgerId,
    isShared: resolved.isShared,
  };
}

/**
 * 排程／通知寄送當下的重新授權：
 * 接收者必須仍是該帳本成員，否則不得再收到共享帳本資料。
 */
export function authorizeLedgerRecipient(input: {
  ledgerId: string;
  userId: string;
}): LedgerScopeResolution {
  return resolveLedgerScope({ userId: input.userId, ledgerId: input.ledgerId });
}
