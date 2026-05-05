'use strict';
// lib/resourceHelpers.js — IDOR 保護、樂觀鎖共用邏輯（從 server.js 提取）

const { queryOne } = require('./db');
const { NextResponse } = require('next/server');

const ALLOWED_TABLES = { accounts: 1, transactions: 1, user_settings: 1 };
const ALLOWED_COLUMNS = { id: 1, user_id: 1 };

function ownsResource(table, idColumn, idValue, userId) {
  if (!table || !idColumn || idValue == null || !userId) return null;
  if (!ALLOWED_TABLES[table] || !ALLOWED_COLUMNS[idColumn]) return null;
  return queryOne(`SELECT * FROM ${table} WHERE ${idColumn} = ? AND user_id = ? LIMIT 1`, [String(idValue), String(userId)]);
}

function assertOptimisticLock(table, idColumn, idValue, expectedUpdatedAt) {
  if (!ALLOWED_TABLES[table] || !ALLOWED_COLUMNS[idColumn]) throw { status: 500, error: 'InvalidLockTarget' };
  const row = queryOne(`SELECT updated_at FROM ${table} WHERE ${idColumn} = ? LIMIT 1`, [String(idValue)]);
  if (!row) throw { status: 404, error: 'NotFound' };
  const expected = Number(expectedUpdatedAt);
  if (!Number.isFinite(expected) || expected <= 0) throw { status: 400, error: 'MissingExpectedUpdatedAt', message: '請帶 expected_updated_at' };
  if (Number(row.updated_at) !== expected) {
    throw { status: 409, error: 'OptimisticLockConflict', serverUpdatedAt: Number(row.updated_at), message: '此筆已被其他裝置修改，請重新整理後再操作' };
  }
}

function lockErrorResponse(e) {
  if (e && typeof e === 'object' && e.status) {
    const body = { error: e.message || e.error || 'Error', code: e.error || 'Error' };
    if (e.serverUpdatedAt) body.serverUpdatedAt = e.serverUpdatedAt;
    return NextResponse.json(body, { status: e.status });
  }
  return NextResponse.json({ error: '伺服器內部錯誤', code: 'InternalServerError' }, { status: 500 });
}

module.exports = { ownsResource, assertOptimisticLock, lockErrorResponse };
