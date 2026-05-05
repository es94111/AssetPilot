'use strict';
// lib/scheduler.js — 排程報表心跳（從 server.js 提取）
// 009 FR-006：per-user 時區判斷觸發
// 注意：報表寄送（runScheduledReportNow）待 Email 服務完整移植後補充

const { queryAll, queryOne, saveDB } = require('./db');
const userTime = require('./userTime');
const crypto = require('crypto');

// ── per-schedule lock set（防重複執行）──
const runningSchedules = new Set();

// ── 求「指定 IANA 時區下、某 YYYY-MM-DD 當地 00:00」對應的 UTC ms ──
function localDayStartMs(tz, ymd) {
  const [y, m, d] = ymd.split('-').map(s => parseInt(s, 10));
  const utcMid = Date.UTC(y, m - 1, d, 0, 0, 0);
  const p = userTime.partsInTz(tz, utcMid);
  let offsetMin = p.hour * 60 + p.minute;
  const localYmd = `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
  if (localYmd < ymd) offsetMin -= 24 * 60;
  else if (localYmd > ymd) offsetMin += 24 * 60;
  return utcMid - offsetMin * 60 * 1000;
}

// ── 判斷某排程是否需要在「nowTs」這個時間點觸發 ──
function shouldRunSchedule(scheduleRow, userTimezone, nowTs = Date.now()) {
  if (!scheduleRow || scheduleRow.enabled === 0) return false;
  // 向後相容：舊呼叫 shouldRunSchedule(scheduleRow, nowTs)（第二參數是數字 ms）
  if (typeof userTimezone === 'number' && nowTs === Date.now()) {
    nowTs = userTimezone;
    userTimezone = 'Asia/Taipei';
  }
  const tz = userTimezone || 'Asia/Taipei';
  const local = userTime.partsInTz(tz, nowTs);
  if (local.hour < (Number(scheduleRow.hour) || 0)) return false;

  const ymd = `${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`;
  const periodStart = localDayStartMs(tz, ymd);

  if (scheduleRow.freq === 'daily') {
    // 每日：無額外條件
  } else if (scheduleRow.freq === 'weekly') {
    if (local.weekday !== (Number(scheduleRow.weekday) || 0)) return false;
  } else if (scheduleRow.freq === 'monthly') {
    if (local.day !== (Number(scheduleRow.day_of_month) || 1)) return false;
  } else {
    return false;
  }
  return (Number(scheduleRow.last_run) || 0) < periodStart;
}

// ── 嘗試寄送單一排程報表 ──
// 完整 Email 寄送邏輯待移植；目前記錄意圖並更新 last_run 防重複觸發
async function runScheduledReportNow(scheduleId, triggeredBy = '排程') {
  if (!scheduleId) return { status: 'invalid', reason: '未指定排程' };
  if (runningSchedules.has(scheduleId)) return { status: 'already_running', reason: '此排程已有任務進行中' };

  runningSchedules.add(scheduleId);
  const startedAt = Date.now();
  try {
    const schedule = queryOne('SELECT * FROM report_schedules WHERE id = ?', [scheduleId]);
    if (!schedule) return { status: 'not_found', reason: '排程不存在' };
    if (schedule.enabled === 0) return { status: 'disabled', reason: '排程已停用' };

    const u = queryOne('SELECT id, email, display_name, is_active, timezone FROM users WHERE id = ?', [schedule.user_id]);
    if (!u) {
      try {
        const db = require('./db').getDB();
        db.run('UPDATE report_schedules SET last_summary = ?, updated_at = ? WHERE id = ?',
          [`${new Date(startedAt).toISOString()} ${triggeredBy}：使用者不存在`, startedAt, scheduleId]);
        saveDB();
      } catch (_) {}
      return { status: 'user_not_found', reason: '使用者不存在' };
    }

    if (u.is_active === 0) {
      try {
        const db = require('./db').getDB();
        db.run('UPDATE report_schedules SET last_summary = ?, updated_at = ? WHERE id = ?',
          [`${new Date(startedAt).toISOString()} ${triggeredBy}：使用者帳號已停用，略過寄送`, startedAt, scheduleId]);
        saveDB();
      } catch (_) {}
      return { status: 'skipped', reason: '使用者帳號已停用' };
    }

    // 待實作：完整 Email 寄送邏輯（buildUserStatsReport + sendStatsEmail）
    // 目前記錄意圖，不實際寄送
    console.log(`[scheduler] ${triggeredBy} 觸發排程 ${scheduleId}（使用者 ${u.email}）— Email 寄送待實作`);
    const summary = `${new Date(startedAt).toISOString()} ${triggeredBy}：待實作 Email 寄送`;
    try {
      const db = require('./db').getDB();
      db.run('UPDATE report_schedules SET last_run = ?, last_summary = ?, updated_at = ? WHERE id = ?',
        [startedAt, summary, startedAt, scheduleId]);
      saveDB();
    } catch (_) {}

    return { status: 'pending', sent: 0, failed: 0, skipped: 0, reason: 'Email 寄送待實作' };
  } finally {
    runningSchedules.delete(scheduleId);
  }
}

// ── 心跳：迭代所有 enabled=1 排程，per-user 時區判斷觸發 ──
function checkAndRunSchedule() {
  try {
    const rows = queryAll(
      'SELECT s.*, u.timezone AS user_timezone FROM report_schedules s JOIN users u ON u.id = s.user_id WHERE s.enabled = 1 AND u.is_active = 1'
    );
    const now = Date.now();
    for (const row of rows) {
      if (runningSchedules.has(row.id)) continue;
      const tz = row.user_timezone || 'Asia/Taipei';
      if (!shouldRunSchedule(row, tz, now)) continue;
      runScheduledReportNow(row.id, '排程').catch(err => console.error('[scheduled-report]', err));
    }
  } catch (e) {
    console.error('[scheduled-report] check error', e);
  }
}

module.exports = { checkAndRunSchedule, shouldRunSchedule, runScheduledReportNow };
