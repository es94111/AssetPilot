// lib/resourceHelpers.js — IDOR 保護、樂觀鎖共用邏輯（從 server.js 提取）

import { NextResponse } from 'next/server';
import { queryOne } from './db';

type ResourceTable = 'accounts' | 'transactions' | 'user_settings';
type ResourceIdColumn = 'id' | 'user_id';

interface LockError {
  status?: number;
  error?: string;
  message?: string;
  serverUpdatedAt?: number;
}

const ALLOWED_TABLES: Record<ResourceTable, true> = { accounts: true, transactions: true, user_settings: true };
const ALLOWED_COLUMNS: Record<ResourceIdColumn, true> = { id: true, user_id: true };

function isResourceTable(value: string): value is ResourceTable {
  return value in ALLOWED_TABLES;
}

function isResourceIdColumn(value: string): value is ResourceIdColumn {
  return value in ALLOWED_COLUMNS;
}

export function ownsResource(table: string, idColumn: string, idValue: unknown, userId: unknown): Record<string, string | number | null> | null {
  if (!table || !idColumn || idValue == null || !userId) return null;
  if (!isResourceTable(table) || !isResourceIdColumn(idColumn)) return null;
  return queryOne(`SELECT * FROM ${table} WHERE ${idColumn} = ? AND user_id = ? LIMIT 1`, [String(idValue), String(userId)]);
}

export function assertOptimisticLock(table: string, idColumn: string, idValue: unknown, expectedUpdatedAt: unknown): void {
  if (!isResourceTable(table) || !isResourceIdColumn(idColumn)) throw { status: 500, error: 'InvalidLockTarget' };
  const row = queryOne(`SELECT updated_at FROM ${table} WHERE ${idColumn} = ? LIMIT 1`, [String(idValue)]);
  if (!row) throw { status: 404, error: 'NotFound' };
  const expected = Number(expectedUpdatedAt);
  if (!Number.isFinite(expected) || expected <= 0) throw { status: 400, error: 'MissingExpectedUpdatedAt', message: '請帶 expected_updated_at' };
  if (Number(row.updated_at) !== expected) {
    throw { status: 409, error: 'OptimisticLockConflict', serverUpdatedAt: Number(row.updated_at), message: '此筆已被其他裝置修改，請重新整理後再操作' };
  }
}

export function lockErrorResponse(e: unknown): NextResponse {
  const err = e as LockError;
  if (err && typeof err === 'object' && err.status) {
    const body: { error: string; code: string; serverUpdatedAt?: number } = {
      error: err.message || err.error || 'Error',
      code: err.error || 'Error',
    };
    if (err.serverUpdatedAt) body.serverUpdatedAt = err.serverUpdatedAt;
    return NextResponse.json(body, { status: err.status });
  }
  return NextResponse.json({ error: '伺服器內部錯誤', code: 'InternalServerError' }, { status: 500 });
}
