// lib/einvoiceCarrier.ts — 雲端發票載具綁定與同步（DB／稽核層，issue #253）
//
// 分工：
//   lib/einvoiceCore.ts     純邏輯（載具驗證、欄位正規化、去重鍵、退避決策）
//   lib/einvoiceProvider.ts 財政部電子發票 API 用戶端（可注入 fetch）
//   lib/einvoiceSecret.ts   憑證的 AES-256-GCM 加密（比照 photoCrypto／apiTokenCore）
//   本檔                    DB 存取、稽核、同步編排與交易草稿產生
//
// 設計要點（對應 issue #253 驗收條件）：
//  - 憑證明文只在記憶體中短暫存在：`verify_code` 以 AES-256-GCM 加密後存放，
//    對外 API 與稽核日誌只出現遮罩後的載具條碼與驗證碼長度。
//  - 同步失敗保留錯誤狀態（`last_sync_status`／`last_error`／`consecutive_failures`）
//    並設 `next_retry_at` 退避；暫時性錯誤只在下一次排程檢查重試，永久失敗不再排程，
//    並比照 monthly_report_send_log 保留狀態、避免重試風暴。
//  - 以 `(user_id, invoice_number)` 唯一鍵去重；重複匯入不會產生第二列，
//    已綁定交易的草稿也不會被覆蓋回 draft。
//  - 所有同步對象都是 `resolveCarrierOwnerId()` 解出的資料擁有者（帳本資料邊界）。

import { getDB, queryAll, queryOne, saveDB } from './db';
import { uid } from './userDefaults';
import { toIsoUtc, todayInUserTz } from './userTime';
import {
  EINVOICE_DEFAULT_RANGE_DAYS,
  EINVOICE_MAX_RANGE_DAYS,
  fetchCarrierInvoices,
} from './einvoiceProvider';
import {
  isValidCarrierBarcode,
  isValidVerifyCode,
  maskCarrierBarcode,
  nextSyncState,
  normalizeCarrierBarcode,
  normalizeVerifyCode,
  readInvoiceProviderConfig,
  syncBackoffMs,
  syncRetryAfterSeconds,
  type NormalizedInvoice,
  type SyncStatus,
} from './einvoiceCore';
import { decryptCarrierSecret, encryptCarrierSecret } from './einvoiceSecret';

export const MAX_ACTIVE_CARRIERS = 5;
export const EINVOICE_SYNC_LOCK_TTL_MS = 60_000;

export class EinvoiceError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status = 400, code = 'EinvoiceError') {
    super(message);
    this.name = 'EinvoiceError';
    this.status = status;
    this.code = code;
  }
}

// ───────────────────────── 資料形狀 ─────────────────────────

export interface CarrierSummary {
  id: string;
  carrierBarcode: string;
  verifyCodeSet: boolean;
  status: 'active' | 'revoked';
  /** 排程同步開關（預設開啟）。 */
  autoSync: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: SyncStatus | '';
  lastError: string;
  consecutiveFailures: number;
  lastSyncRetryable: boolean;
  retryAfterSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceDraft {
  id: string;
  carrierId: string;
  invoiceNumber: string;
  invoiceDate: string;
  invoiceTime: string;
  sellerName: string;
  amount: number;
  status: 'draft' | 'imported' | 'dismissed';
  transactionId: string;
  createdAt: string;
  updatedAt: string;
}

interface CarrierRow {
  id: string | number;
  user_id: string | number;
  carrier_barcode: string | number;
  carrier_barcode_masked?: string | number | null;
  verify_code_encrypted?: string | number | null;
  status?: string | number | null;
  auto_sync?: string | number | null;
  last_sync_at?: string | number | null;
  last_sync_status?: string | number | null;
  last_error?: string | number | null;
  consecutive_failures?: string | number | null;
  next_retry_at?: string | number | null;
  last_sync_retryable?: string | number | null;
  sync_lock_until?: string | number | null;
  last_invoice_date?: string | number | null;
  created_at?: string | number | null;
  updated_at?: string | number | null;
}

interface InvoiceRow {
  id: string | number;
  carrier_id: string | number;
  invoice_number: string | number;
  invoice_date: string | number;
  invoice_time?: string | number | null;
  seller_name?: string | number | null;
  amount?: string | number | null;
  status?: string | number | null;
  transaction_id?: string | number | null;
  created_at?: string | number | null;
  updated_at?: string | number | null;
}

/** 稽核日誌允許的鍵（見 lib/auditHelpers.ts 的 AUDIT_METADATA_ALLOWED_KEYS）。 */
export const EINVOICE_AUDIT_METADATA_KEYS = [
  'carrier_id',
  'carrier_barcode_masked',
  'invoice_import_id',
  'invoice_number',
  'invoice_count',
  'skipped_count',
  'synced_count',
  'provider',
  'sync_status',
] as const;

/**
 * 解析本次請求實際要操作的資料擁有者。
 * `/api/imports/*` 屬帳本資料路徑，`requireAuth()` 會改寫 `userId` 為帳本的
 * `data_owner_id`；本函式保留該邊界，且不允許以查詢參數指向他人資料。
 */
export function resolveCarrierOwnerId(auth: { userId: string }): string {
  const ownerId = String(auth?.userId || '').trim();
  if (!ownerId) throw new EinvoiceError('未登入', 401, 'Unauthorized');
  return ownerId;
}

/** 發票載具整合不支援共享帳本：一律以個人身分操作。 */
export function isSharedLedgerContext(auth: { isSharedLedger?: boolean }): boolean {
  return !!auth?.isSharedLedger;
}

// ───────────────────────── 查詢 ─────────────────────────

function summarizeCarrier(row: CarrierRow, now = Date.now()): CarrierSummary {
  return {
    id: String(row.id),
    carrierBarcode: String(row.carrier_barcode_masked || maskCarrierBarcode(row.carrier_barcode)),
    verifyCodeSet: !!String(row.verify_code_encrypted || ''),
    status: (String(row.status || 'active') === 'revoked' ? 'revoked' : 'active'),
    autoSync: Number(row.auto_sync ?? 1) === 1,
    lastSyncAt: Number(row.last_sync_at || 0) > 0 ? toIsoUtc(Number(row.last_sync_at)) : null,
    lastSyncStatus: (String(row.last_sync_status || '') as SyncStatus | ''),
    lastError: String(row.last_error || ''),
    consecutiveFailures: Number(row.consecutive_failures) || 0,
    lastSyncRetryable: Number(row.last_sync_retryable ?? 1) === 1,
    // 退避期間前端應停用手動同步按鈕，避免失敗風暴。
    retryAfterSeconds: syncRetryAfterSeconds({
      status: String(row.last_sync_status || ''),
      consecutiveFailures: Number(row.consecutive_failures) || 0,
      nextRetryAt: Number(row.next_retry_at) || 0,
      now,
    }),
    createdAt: toIsoUtc(Number(row.created_at || 0)),
    updatedAt: toIsoUtc(Number(row.updated_at || 0)),
  };
}

function summarizeInvoice(row: InvoiceRow): InvoiceDraft {
  return {
    id: String(row.id),
    carrierId: String(row.carrier_id),
    invoiceNumber: String(row.invoice_number),
    invoiceDate: String(row.invoice_date),
    invoiceTime: String(row.invoice_time || ''),
    sellerName: String(row.seller_name || ''),
    amount: Number(row.amount) || 0,
    status: (String(row.status || 'draft') as InvoiceDraft['status']),
    transactionId: String(row.transaction_id || ''),
    createdAt: toIsoUtc(Number(row.created_at || 0)),
    updatedAt: toIsoUtc(Number(row.updated_at || 0)),
  };
}

export function listCarriers(userId: string): CarrierSummary[] {
  const rows = queryAll(
    'SELECT * FROM invoice_carriers WHERE user_id = ? AND status = ? ORDER BY created_at ASC',
    [userId, 'active'],
  ) as unknown as CarrierRow[];
  return rows.map((row) => summarizeCarrier(row));
}

export function findCarrier(userId: string, carrierId: string): CarrierRow | null {
  const row = queryOne('SELECT * FROM invoice_carriers WHERE id = ? AND user_id = ?', [
    String(carrierId || ''),
    userId,
  ]);
  return (row as unknown as CarrierRow) || null;
}

/** 供 route 使用：讀取載具摘要（未找到時拋 404 的 EinvoiceError）。 */
export function requireCarrierSummary(userId: string, carrierId: string): CarrierSummary {
  const row = findCarrier(userId, carrierId);
  if (!row) throw new EinvoiceError('找不到此手機條碼載具', 404, 'CarrierNotFound');
  return summarizeCarrier(row);
}

export interface ListInvoicesFilter {
  status?: string;
  limit?: number;
}

export function listInvoices(userId: string, filter: ListInvoicesFilter = {}): InvoiceDraft[] {
  const status = String(filter.status || '').trim();
  const limit = Math.min(Math.max(Number(filter.limit) || 100, 1), 500);
  const params: Array<string | number> = [userId];
  let sql = 'SELECT * FROM invoice_imports WHERE user_id = ?';
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  sql += ' ORDER BY invoice_date DESC, invoice_time DESC, created_at DESC LIMIT ?';
  params.push(limit);
  const rows = queryAll(sql, params) as unknown as InvoiceRow[];
  return rows.map(summarizeInvoice);
}

export function findInvoice(userId: string, invoiceId: string): InvoiceRow | null {
  const row = queryOne('SELECT * FROM invoice_imports WHERE id = ? AND user_id = ?', [
    String(invoiceId || ''),
    userId,
  ]);
  return (row as unknown as InvoiceRow) || null;
}

// ───────────────────────── 綁定／解除 ─────────────────────────

export interface BindCarrierInput {
  barcode: unknown;
  verifyCode: unknown;
}

export function bindCarrier(userId: string, input: BindCarrierInput): CarrierSummary {
  const barcode = normalizeCarrierBarcode(input.barcode);
  const verifyCode = normalizeVerifyCode(input.verifyCode);
  if (!isValidCarrierBarcode(barcode)) {
    throw new EinvoiceError('手機條碼載具格式無效（應為 / 加上 7 碼大寫英數字）', 400, 'InvalidCarrierBarcode');
  }
  if (!isValidVerifyCode(verifyCode)) {
    throw new EinvoiceError('驗證碼格式無效（應為 6~20 碼英數字）', 400, 'InvalidVerifyCode');
  }

  const existing = queryOne(
    'SELECT * FROM invoice_carriers WHERE user_id = ? AND carrier_barcode = ?',
    [userId, barcode],
  ) as unknown as CarrierRow | null;

  const now = Date.now();
  if (existing) {
    // 重新綁定同一載具：更新憑證並清掉退避與錯誤狀態，讓使用者可立即重試。
    getDB().run(
      `UPDATE invoice_carriers
       SET verify_code_encrypted = ?, carrier_barcode_masked = ?, status = 'active',
           last_sync_status = '', last_error = '', consecutive_failures = 0,
           next_retry_at = 0, last_sync_retryable = 1, sync_lock_until = 0, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [encryptCarrierSecret(verifyCode), maskCarrierBarcode(barcode), now, String(existing.id), userId],
    );
    saveDB();
    const refreshed = findCarrier(userId, String(existing.id));
    return summarizeCarrier(refreshed as CarrierRow);
  }

  const activeCount = Number(
    queryOne(
      'SELECT COUNT(*) AS cnt FROM invoice_carriers WHERE user_id = ? AND status = ?',
      [userId, 'active'],
    )?.cnt,
  ) || 0;
  if (activeCount >= MAX_ACTIVE_CARRIERS) {
    throw new EinvoiceError(
      `已綁定的手機條碼載具達上限（${MAX_ACTIVE_CARRIERS} 組），請先解除不使用的載具`,
      400,
      'CarrierLimitReached',
    );
  }

  const id = uid();
  getDB().run(
    `INSERT INTO invoice_carriers
     (id, user_id, carrier_barcode, carrier_barcode_masked, verify_code_encrypted, status,
      last_sync_at, last_sync_status, last_error, consecutive_failures, next_retry_at,
      last_invoice_date, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      userId,
      barcode,
      maskCarrierBarcode(barcode),
      encryptCarrierSecret(verifyCode),
      'active',
      0,
      '',
      '',
      0,
      0,
      '',
      now,
      now,
    ],
  );
  saveDB();
  const created = findCarrier(userId, id);
  return summarizeCarrier(created as CarrierRow);
}

/**
 * 解除綁定：標記為 revoked 並清除憑證密文（憑證不可回復），
 * 保留既有發票草稿與已入帳交易，避免使用者失去歷史紀錄。
 */
export function revokeCarrier(userId: string, carrierId: string): boolean {
  const carrier = findCarrier(userId, carrierId);
  if (!carrier) return false;
  if (String(carrier.status || 'active') === 'revoked') return true;
  const now = Date.now();
  getDB().run(
    `UPDATE invoice_carriers
     SET status = 'revoked', verify_code_encrypted = '', last_error = '',
         consecutive_failures = 0, next_retry_at = 0, last_sync_retryable = 1,
         sync_lock_until = 0, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [now, String(carrier.id), userId],
  );
  saveDB();
  return true;
}

// ───────────────────────── 同步 ─────────────────────────

export interface SyncCarrierResult {
  status: SyncStatus;
  carrier: CarrierSummary;
  created: number;
  duplicates: number;
  skipped: number;
  drafts: InvoiceDraft[];
  provider: string;
  errorMessage: string;
  /** 供應商未設定或不可用而優雅降級時為 true。 */
  degraded: boolean;
}

function skippedSyncResult(carrier: CarrierRow, now: number, errorMessage: string): SyncCarrierResult {
  return {
    status: 'skipped',
    carrier: summarizeCarrier(carrier, now),
    created: 0,
    duplicates: 0,
    skipped: 0,
    drafts: [],
    provider: 'einvoice',
    errorMessage,
    degraded: false,
  };
}

/** 查詢區間：預設近 30 天，最多 90 天，避免一次拉取過量。 */
export function resolveSyncRange(
  lastInvoiceDate: string | null | undefined,
  endDate: string,
  rangeDays = EINVOICE_DEFAULT_RANGE_DAYS,
): { startDate: string; endDate: string } {
  const end = /^\d{4}-\d{2}-\d{2}$/.test(String(endDate || '')) ? String(endDate) : '';
  if (!end) throw new EinvoiceError('同步日期格式無效', 400, 'InvalidDate');
  const days = Math.min(Math.max(Number(rangeDays) || EINVOICE_DEFAULT_RANGE_DAYS, 1), EINVOICE_MAX_RANGE_DAYS);
  const [y, m, d] = end.split('-').map(Number);
  const defaultStart = (() => {
    const date = new Date(Date.UTC(y, m - 1, d - (days - 1)));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  })();
  // 已同步過的載具從上次最新發票日前一天續拉，避免每次都重掃整個區間。
  const since = String(lastInvoiceDate || '');
  const start = /^\d{4}-\d{2}-\d{2}$/.test(since) && since > defaultStart && since <= end ? since : defaultStart;
  return { startDate: start, endDate: end };
}

interface InsertInvoiceOutcome {
  created: number;
  duplicates: number;
}

/**
 * 以 `(user_id, invoice_number)` 冪等寫入草稿。
 * `ON CONFLICT DO NOTHING` 讓重複匯入（同一張發票再次被拉取）不產生第二列，
 * 也讓併發的兩個同步請求只有一個能寫入。
 */
function insertInvoiceRows(
  userId: string,
  carrierId: string,
  invoices: NormalizedInvoice[],
  now: number,
): InsertInvoiceOutcome {
  let created = 0;
  let duplicates = 0;
  const db = getDB();
  for (const invoice of invoices) {
    db.run(
      `INSERT INTO invoice_imports
       (id, user_id, carrier_id, invoice_number, invoice_date, invoice_time, seller_name,
        amount, status, transaction_id, created_at, updated_at, imported_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT (user_id, invoice_number) DO NOTHING`,
      [
        uid(),
        userId,
        carrierId,
        invoice.invoiceNumber,
        invoice.invoiceDate,
        invoice.invoiceTime,
        invoice.sellerName,
        invoice.amount,
        'draft',
        '',
        now,
        now,
        0,
      ],
    );
    if (db.getRowsModified() > 0) created += 1;
    else duplicates += 1;
  }
  return { created, duplicates };
}

/**
 * 手動同步單一載具：查詢 → 去重寫入草稿 → 更新同步狀態。
 *
 * 退避期間直接回 `skipped`（不呼叫供應商），這是「不自動重試風暴」的核心：
 * 使用者在失敗後立即連點不會再打出任何外部請求。
 */
export async function syncCarrier(
  auth: { userId: string; userTimezone?: string; isSharedLedger?: boolean },
  carrierId: string,
  options: {
    /** 測試注入點；未提供時使用全域 fetch。 */
    fetchImpl?: typeof fetch;
    /** 測試注入點；未提供時讀取環境變數。 */
    config?: ReturnType<typeof readInvoiceProviderConfig>;
    rangeDays?: number;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<SyncCarrierResult> {
  const userId = resolveCarrierOwnerId(auth);
  const carrier = findCarrier(userId, carrierId);
  if (!carrier) throw new EinvoiceError('找不到此手機條碼載具', 404, 'CarrierNotFound');
  if (String(carrier.status || 'active') === 'revoked') {
    throw new EinvoiceError('此載具已解除綁定，請重新綁定後再同步', 409, 'CarrierRevoked');
  }
  if (isSharedLedgerContext(auth)) {
    // 發票載具憑證屬於個人整合，不隨共享帳本共享；避免以他人的載具憑證寫入帳本資料。
    throw new EinvoiceError('雲端發票整合不支援共享帳本，請切換回個人帳本後再同步', 403, 'SharedLedgerUnsupported');
  }

  const now = Date.now();
  const state = {
    status: String(carrier.last_sync_status || ''),
    consecutiveFailures: Number(carrier.consecutive_failures) || 0,
    nextRetryAt: Number(carrier.next_retry_at) || 0,
    now,
  };
  if (Number(carrier.next_retry_at || 0) > now) {
    // 退避中：保留既有錯誤狀態，不更新 next_retry_at（避免使用者連點延後重試）。
    const remaining = syncRetryAfterSeconds(state);
    return skippedSyncResult(
      carrier,
      now,
      `同步失敗後暫時停止重試，請於 ${remaining} 秒後再試`,
    );
  }

  const lockUntil = now + EINVOICE_SYNC_LOCK_TTL_MS;
  const db = getDB();
  db.run(
    `UPDATE invoice_carriers SET sync_lock_until = ?
     WHERE id = ? AND user_id = ? AND status = 'active'
       AND COALESCE(next_retry_at, 0) <= ? AND COALESCE(sync_lock_until, 0) <= ?`,
    [lockUntil, String(carrier.id), userId, now, now],
  );
  if (db.getRowsModified() === 0) {
    const current = findCarrier(userId, carrierId);
    if (!current) throw new EinvoiceError('找不到此手機條碼載具', 404, 'CarrierNotFound');
    if (Number(current.next_retry_at || 0) > now) {
      return skippedSyncResult(
        current,
        now,
        `同步失敗後暫時停止重試，請於 ${syncRetryAfterSeconds({
          status: String(current.last_sync_status || ''),
          consecutiveFailures: Number(current.consecutive_failures) || 0,
          nextRetryAt: Number(current.next_retry_at) || 0,
          now,
        })} 秒後再試`,
      );
    }
    return skippedSyncResult(current, now, '此載具同步正在進行中，請稍後再試');
  }

  try {
  const env = options.env ?? process.env;
  const config = options.config ?? readInvoiceProviderConfig(env);
  const timezone = String(auth.userTimezone || 'Asia/Taipei');
  const range = resolveSyncRange(
    carrier.last_invoice_date ? String(carrier.last_invoice_date) : '',
    todayInUserTz(timezone),
    options.rangeDays,
  );

  let verifyCode = '';
  try {
    verifyCode = decryptCarrierSecret(String(carrier.verify_code_encrypted || ''), env);
  } catch {
    const message = '載具憑證無法解密，請重新綁定此手機條碼載具';
    applySyncState(carrier, 'failed', message, now, false);
    return {
      status: 'failed',
      carrier: summarizeCarrier(findCarrier(userId, carrierId) as CarrierRow, now),
      created: 0,
      duplicates: 0,
      skipped: 0,
      drafts: [],
      provider: 'einvoice',
      errorMessage: message,
      degraded: false,
    };
  }

  const result = await fetchCarrierInvoices({
    config,
    carrierBarcode: String(carrier.carrier_barcode),
    verifyCode,
    startDate: range.startDate,
    endDate: range.endDate,
    fetchImpl: options.fetchImpl,
  });

  const currentCarrier = findCarrier(userId, carrierId);
  if (
    !currentCarrier
    || String(currentCarrier.status || 'active') === 'revoked'
    || Number(currentCarrier.sync_lock_until || 0) !== lockUntil
  ) {
    return skippedSyncResult(
      currentCarrier || carrier,
      Date.now(),
      '載具已解除綁定或同步已由其他請求接管，本次結果未寫入',
    );
  }

  if (result.status === 'skipped') {
    // 供應商未設定：優雅降級。記錄狀態但不計入失敗、不設退避
    // （使用者補上環境變數後即可立即同步，不必等待退避）。
    getDB().run(
      `UPDATE invoice_carriers SET last_sync_status = ?, last_error = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      ['skipped', result.errorMessage.slice(0, 500), now, String(carrier.id), userId],
    );
    saveDB();
    return {
      status: 'skipped',
      carrier: summarizeCarrier(findCarrier(userId, carrierId) as CarrierRow, now),
      created: 0,
      duplicates: 0,
      skipped: 0,
      drafts: [],
      provider: result.provider,
      errorMessage: result.errorMessage,
      degraded: true,
    };
  }

  if (result.status === 'failed') {
    applySyncState(carrier, 'failed', result.errorMessage, now, result.retryable);
    return {
      status: 'failed',
      carrier: summarizeCarrier(findCarrier(userId, carrierId) as CarrierRow, now),
      created: 0,
      duplicates: 0,
      skipped: 0,
      drafts: [],
      provider: result.provider,
      errorMessage: result.errorMessage,
      degraded: false,
    };
  }

  const inserted = insertInvoiceRows(userId, String(carrier.id), result.invoices, now);
  const latestDate = result.invoices.reduce(
    (acc, invoice) => (invoice.invoiceDate > acc ? invoice.invoiceDate : acc),
    String(carrier.last_invoice_date || ''),
  );
  const finalStatus: SyncStatus = result.skipped > 0 ? 'partial' : 'success';
  const { consecutiveFailures, nextRetryAt } = nextSyncState(
    carrier.consecutive_failures,
    finalStatus,
    now,
  );
  getDB().run(
    `UPDATE invoice_carriers
     SET last_sync_at = ?, last_sync_status = ?, last_error = ?, consecutive_failures = ?,
         next_retry_at = ?, last_sync_retryable = 1, last_invoice_date = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [
      now,
      finalStatus,
      result.errorMessage.slice(0, 500),
      consecutiveFailures,
      nextRetryAt,
      latestDate,
      now,
      String(carrier.id),
      userId,
    ],
  );
  saveDB();

  const drafts = listInvoices(userId, { status: 'draft', limit: inserted.created });
  return {
    status: finalStatus,
    carrier: summarizeCarrier(findCarrier(userId, carrierId) as CarrierRow, now),
    created: inserted.created,
    duplicates: inserted.duplicates,
    skipped: result.skipped,
    drafts,
    provider: result.provider,
    errorMessage: result.errorMessage,
    degraded: false,
  };
  } finally {
    try {
      const releaseDb = getDB();
      releaseDb.run(
        `UPDATE invoice_carriers SET sync_lock_until = 0
         WHERE id = ? AND user_id = ? AND sync_lock_until = ?`,
        [String(carrier.id), userId, lockUntil],
      );
      if (releaseDb.getRowsModified() > 0) saveDB();
    } catch {
      // The lease expires automatically if the database becomes unavailable during cleanup.
    }
  }
}

/** 寫入失敗狀態與退避；不可重試錯誤保留狀態但不排程重試。 */
function applySyncState(
  carrier: CarrierRow,
  status: SyncStatus,
  message: string,
  now: number,
  retryable = true,
): void {
  const failures = (Number(carrier.consecutive_failures) || 0) + 1;
  const { consecutiveFailures, nextRetryAt } = retryable
    ? nextSyncState(carrier.consecutive_failures, status, now)
    : { consecutiveFailures: failures, nextRetryAt: now + syncBackoffMs(failures) };
  getDB().run(
    `UPDATE invoice_carriers
     SET last_sync_at = ?, last_sync_status = ?, last_error = ?,
         consecutive_failures = ?, next_retry_at = ?, last_sync_retryable = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [
      now,
      status,
      String(message).slice(0, 500),
      consecutiveFailures,
      nextRetryAt,
      retryable ? 1 : 0,
      now,
      String(carrier.id),
      String(carrier.user_id),
    ],
  );
  saveDB();
}

// ───────────────────────── 交易草稿 ─────────────────────────

export interface ConfirmInvoiceInput {
  invoiceId: string;
  accountId?: string | null;
  categoryId?: string | null;
  note?: string;
}

/** 發票草稿轉為交易時使用的備註前綴，讓使用者看得出款項來源。 */
export function invoiceNote(invoice: InvoiceRow, extra = ''): string {
  const seller = String(invoice.seller_name || '').trim();
  const number = String(invoice.invoice_number || '');
  const base = seller ? `${seller}（雲端發票 ${number}）` : `雲端發票 ${number}`;
  const note = String(extra || '').trim();
  return (note ? `${note} ` : '') + base;
}

/**
 * 將草稿標記為已略過。已入帳（imported）的草稿不可略過，
 * 避免使用者誤以為交易被移除。
 */
export function dismissInvoice(userId: string, invoiceId: string): InvoiceDraft {
  const invoice = findInvoice(userId, invoiceId);
  if (!invoice) throw new EinvoiceError('找不到此發票', 404, 'InvoiceNotFound');
  const status = String(invoice.status || 'draft');
  if (status === 'imported') {
    throw new EinvoiceError('此發票已入帳，無法略過', 409, 'InvoiceAlreadyImported');
  }
  if (status !== 'dismissed') {
    const now = Date.now();
    getDB().run(
      'UPDATE invoice_imports SET status = ?, updated_at = ? WHERE id = ? AND user_id = ?',
      ['dismissed', now, String(invoice.id), userId],
    );
    saveDB();
  }
  return summarizeInvoice(findInvoice(userId, invoiceId) as InvoiceRow);
}

/** 供 route 使用：讀取草稿的資料列（未找到時拋對應的 EinvoiceError）。 */
export function requireInvoice(userId: string, invoiceId: string): InvoiceRow {
  const invoice = findInvoice(userId, invoiceId);
  if (!invoice) throw new EinvoiceError('找不到此發票', 404, 'InvoiceNotFound');
  return invoice;
}

export function markInvoiceImported(
  userId: string,
  invoiceId: string,
  transactionId: string,
): InvoiceDraft {
  const now = Date.now();
  getDB().run(
    `UPDATE invoice_imports
     SET status = 'imported', transaction_id = ?, imported_at = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [String(transactionId), now, now, String(invoiceId), userId],
  );
  saveDB();
  return summarizeInvoice(findInvoice(userId, invoiceId) as InvoiceRow);
}

/** 稽核用的同步摘要（不含任何憑證內容）。 */
export function syncAuditMetadata(
  carrier: { id: string; carrierBarcode: string },
  result: Pick<SyncCarrierResult, 'status' | 'created' | 'duplicates' | 'skipped' | 'provider'>,
): Record<string, unknown> {
  return {
    carrier_id: String(carrier.id),
    carrier_barcode_masked: String(carrier.carrierBarcode),
    sync_status: result.status,
    invoice_count: result.created + result.duplicates,
    synced_count: result.created,
    skipped_count: result.skipped,
    provider: result.provider,
  };
}

/** 綁定／解除綁定的稽核摘要：只保留遮罩後的條碼與載具 id。 */
export function carrierAuditMetadata(carrier: { id: string; carrierBarcode: string }): Record<string, unknown> {
  return {
    carrier_id: String(carrier.id),
    carrier_barcode_masked: String(carrier.carrierBarcode),
  };
}

/** 發票草稿確認入帳／略過的稽核摘要。 */
export function invoiceAuditMetadata(invoice: { id: string; invoiceNumber: string }): Record<string, unknown> {
  return {
    invoice_import_id: String(invoice.id),
    invoice_number: String(invoice.invoiceNumber),
  };
}
