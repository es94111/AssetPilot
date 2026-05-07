// lib/auditHelpers.ts — 操作稽核、CSV 工具
import { getDB, saveDB } from './db';
import { uid } from './userDefaults';

const AUDIT_METADATA_ALLOWED_KEYS = new Set([
  'rows', 'imported', 'skipped', 'errors', 'warnings', 'byteSize',
  'dateFrom', 'dateTo', 'failure_stage', 'failure_reason',
  'unknown_columns', 'backup_path', 'before_restore_path',
  'filename', 'filterParams',
  'path', 'normalizedPath', 'next', 'reason', 'rawUrl', 'pattern',
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
