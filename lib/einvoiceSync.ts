// lib/einvoiceSync.ts — 雲端發票的「排程」同步入口（issue #253）
//
// 設計沿用既有慣例（見 instrumentation.ts 與 lib/requestMaintenance.ts）：
// 本專案刻意不在伺服器啟動時建立計時器（讓服務可休眠），所有週期性工作都由
// 「已驗證的使用者請求」順帶觸發，並以資料庫中的每載具 `last_sync_at` 冷卻，
// 因此多個 server instance 也會共用同一個排程間隔。
//
// 因此排程同步的語意為：
//  - 使用者啟用 `auto_sync`（預設開啟）且有綁定中的載具時，每次已驗證請求
//    最多每 `SYNC_INTERVAL_MS` 檢查一次
//  - 查詢期間落在退避（`next_retry_at`）內的載具一律略過，不發出任何外部請求
//  - 網路／408／429／5xx 等可重試失敗，只在退避到期後的下次排程檢查重試；
//    401／403 與格式錯誤保留狀態但不再排程重試，避免無效憑證造成重試風暴
//  - 供應商未設定時整體略過（優雅降級）

import { queryAll, queryOne, saveDB } from './db';
import { getDB } from './db';
import { syncCarrier } from './einvoiceCarrier';
import { readInvoiceProviderConfig } from './einvoiceCore';

/** 每個載具兩次排程同步間的最小間隔（跨 server instance 共用）。 */
export const EINVOICE_SYNC_INTERVAL_MS = 60 * 60 * 1000;

interface CarrierSyncRow {
  id: string | number;
  user_id: string | number;
  auto_sync?: string | number | null;
  last_sync_at?: string | number | null;
  next_retry_at?: string | number | null;
  last_sync_status?: string | null;
  last_sync_retryable?: string | number | null;
}

/**
 * 由已驗證的請求觸發：為該使用者排程同步到期（且未退避）的載具。
 * 回傳實際同步的載具數，供測試與診斷使用。
 */
export async function runDueInvoiceSyncsForUser(
  userId: string,
  userTimezone = 'Asia/Taipei',
  options: {
    now?: number;
    fetchImpl?: typeof fetch;
    env?: NodeJS.ProcessEnv;
    /** 測試用：略過以資料庫 last_sync_at 實作的排程冷卻。 */
    force?: boolean;
  } = {},
): Promise<number> {
  const now = Number(options.now ?? Date.now());
  const userKey = String(userId || '').trim();
  if (!userKey) return 0;

  const env = options.env ?? process.env;
  // 供應商未設定時完全不查詢、不寫入任何狀態（優雅降級）。
  if (!readInvoiceProviderConfig(env).configured) return 0;

  let rows: CarrierSyncRow[];
  const params: Array<string | number> = [userKey];
  const scheduleCooldown = options.force
    ? ''
    : 'AND COALESCE(last_sync_at, 0) <= ?';
  if (!options.force) params.push(now - EINVOICE_SYNC_INTERVAL_MS);
  params.push(now);
  try {
    rows = queryAll(
      `SELECT id, user_id, auto_sync, last_sync_at, next_retry_at,
              last_sync_status, last_sync_retryable
       FROM invoice_carriers
       WHERE user_id = ? AND status = 'active' AND auto_sync = 1
         ${scheduleCooldown}
         AND COALESCE(next_retry_at, 0) <= ?
         AND NOT (last_sync_status = 'failed' AND last_sync_retryable = 0)`,
      params,
    ) as unknown as CarrierSyncRow[];
  } catch {
    // 資料表尚未建立（例如極早期啟動）：略過而非讓請求失敗。
    return 0;
  }
  if (rows.length === 0) return 0;

  let synced = 0;
  for (const row of rows) {
    // 退避中的載具不重試，這是「不自動重試風暴」的關鍵。
    if (Number(row.next_retry_at || 0) > now) continue;
    try {
      await syncCarrier(
        { userId: userKey, userTimezone },
        String(row.id),
        { fetchImpl: options.fetchImpl, env },
      );
      synced += 1;
    } catch (error) {
      // 單一載具失敗不應影響其他載具或使用者請求。
      console.error(
        JSON.stringify({
          event: 'einvoice_auto_sync_failed',
          carrierId: String(row.id),
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
  return synced;
}

/** 使用者層級的排程同步開關（預設開啟）。 */
export function isAutoSyncEnabled(userId: string): boolean {
  const row = queryOne(
    `SELECT COUNT(*) AS cnt FROM invoice_carriers
     WHERE user_id = ? AND status = 'active' AND auto_sync = 1`,
    [userId],
  );
  return (Number(row?.cnt) || 0) > 0;
}

/** 設定某個載具的排程同步開關。 */
export function setCarrierAutoSync(userId: string, carrierId: string, enabled: boolean): boolean {
  const now = Date.now();
  getDB().run(
    'UPDATE invoice_carriers SET auto_sync = ?, updated_at = ? WHERE id = ? AND user_id = ?',
    [enabled ? 1 : 0, now, String(carrierId), userId],
  );
  saveDB();
  return true;
}
