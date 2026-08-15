// lib/auditHelpers.ts — 操作稽核、CSV 工具
import { getDB, saveDB } from './db';
import { uid } from './userDefaults';
import { getRequestIpFromHeaders, getUserAgentFromHeaders } from './loginHelpers';

const AUDIT_METADATA_ALLOWED_KEYS = new Set([
  'rows', 'imported', 'skipped', 'errors', 'warnings', 'byteSize',
  'dateFrom', 'dateTo', 'failure_stage', 'failure_reason',
  'unknown_columns', 'backup_path', 'before_restore_path',
  'filename', 'filterParams',
  'bucket', 'object_key', 'endpoint', 'region',
  'transaction_id', 'attachment_id', 'storage', 'mime_type',
  'linked_transaction_id',
  'path', 'normalizedPath', 'next', 'reason', 'rawUrl', 'pattern',
  // 敏感操作（管理員權限／設定／稽核維運）詳細記錄用的欄位。
  'target_user_id', 'target_email', 'was_admin', 'is_admin',
  'old_role', 'new_role', 'changed_fields', 'setting', 'cert_type',
  'deleted_count', 'requested_count', 'scope', 'log_id', 'self',
  // MCP 查詢稽核（見 data-model.md：稽核紀錄擴充）
  'mcp_credential_id', 'mcp_credential_name',
  // MCP 新增交易稽核（003-mcp-write-no-delete，見 data-model.md：稽核紀錄擴充）
  'transaction_summary',
]);

export interface WriteAuditArgs {
  userId?: string;
  role?: string;
  action: string;
  ipAddress?: string;
  userAgent?: string;
  result?: string;
  isAdminOperation?: boolean;
  metadata?: Record<string, unknown>;
}

export function writeOperationAudit({ userId, role, action, ipAddress, userAgent, result, isAdminOperation, metadata }: WriteAuditArgs): void {
  try {
    const id = uid();
    const timestamp = new Date().toISOString();
    const safeMetadata: Record<string, unknown> = {};
    if (metadata && typeof metadata === 'object') {
      Object.keys(metadata).forEach(k => {
        if (AUDIT_METADATA_ALLOWED_KEYS.has(k)) safeMetadata[k] = metadata[k];
      });
    }
    const ua = (userAgent || '').slice(0, 500);
    getDB().run(
      'INSERT INTO data_operation_audit_log (id, user_id, role, action, ip_address, user_agent, timestamp, result, is_admin_operation, metadata) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [id, userId || '', role || 'user', action, ipAddress || '', ua, timestamp, result || 'success', isAdminOperation ? 1 : 0, JSON.stringify(safeMetadata)]
    );
    saveDB();
  } catch (e) {
    try {
      console.error(JSON.stringify({ event: 'audit_write_failed', userId, action, result, error: String((e as Error)?.message || e) }));
    } catch (_) { /* noop */ }
  }
}

/**
 * 從 request + 認證結果記錄一筆敏感操作稽核，自動帶入 IP、User-Agent 與角色。
 * 用於管理員權限變更、系統設定、稽核維運等敏感操作的「詳細記錄」。
 */
export function auditSensitiveAction(
  request: { headers?: unknown } | null | undefined,
  auth: { userId?: string; isAdmin?: boolean; isSuperAdmin?: boolean } | null | undefined,
  args: { action: string; result?: string; metadata?: Record<string, unknown> }
): void {
  const headers = (request?.headers || {}) as Parameters<typeof getRequestIpFromHeaders>[0];
  const role = auth?.isSuperAdmin ? 'super_admin' : (auth?.isAdmin ? 'admin' : 'user');
  writeOperationAudit({
    userId: auth?.userId || '',
    role,
    action: args.action,
    ipAddress: getRequestIpFromHeaders(headers),
    userAgent: getUserAgentFromHeaders(headers),
    result: args.result || 'success',
    isAdminOperation: !!auth?.isAdmin,
    metadata: args.metadata,
  });
}

function formulaInjectionEscape(value: string): string {
  if (typeof value !== 'string') return value;
  if (/^[=+\-@]/.test(value)) return "'" + value;
  return value;
}

function csvCell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const escaped = formulaInjectionEscape(raw);
  if (/[",\n\r]/.test(escaped)) return '"' + escaped.replace(/"/g, '""') + '"';
  return escaped;
}

export function buildCsv(headers: string[], rows: unknown[][]): string {
  const BOM = '﻿';
  const headerLine = headers.map(csvCell).join(',');
  const lines = [headerLine];
  for (const row of rows) {
    lines.push(row.map(csvCell).join(','));
  }
  return BOM + lines.join('\r\n') + '\r\n';
}

const HASH_SEP = '\x01';

export function makeTxHash(
  date: string,
  type: string,
  categoryId: string,
  amount: number | string,
  accountId: string,
  note: string
): string {
  return [date || '', type || '', categoryId || '', String(amount || ''), accountId || '', note || ''].join(HASH_SEP);
}

export function isValidIso8601Date(s: unknown): boolean {
  if (typeof s !== 'string') return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const ts = Date.parse(s);
  return !Number.isNaN(ts);
}
