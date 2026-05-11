// @ts-nocheck
// lib/scheduler.js — 排程報表心跳（從 server.js 提取）
// 009 FR-006：per-user 時區判斷觸發

import crypto from 'crypto';
import { getDB, queryAll, queryOne, saveDB } from './db';
import { getActiveEmailProviders, sendStatsEmail } from './emailService';
import { buildUserStatsReport, renderStatsEmailHtml } from './statsEmailReport';
import * as userTime from './userTime';

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

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

function formatLocalSummaryTime(ms) {
  return new Date(ms).toISOString();
}

// ── 嘗試寄送單一排程報表 ──
// 完整 Email 寄送邏輯待移植；目前記錄意圖並更新 last_run 防重複觸發
async function runScheduledReportNow(scheduleId, triggeredBy = '排程') {
  if (!scheduleId) return { status: 'invalid', sent: 0, failed: 0, skipped: 0, reason: '未指定排程' };
  if (runningSchedules.has(scheduleId)) return { status: 'already_running', sent: 0, failed: 0, skipped: 0, reason: '此排程已有任務進行中' };

  runningSchedules.add(scheduleId);
  const startedAt = Date.now();
  try {
    const db = getDB();
    const schedule = queryOne('SELECT * FROM report_schedules WHERE id = ?', [scheduleId]);
    if (!schedule) return { status: 'not_found', sent: 0, failed: 0, skipped: 0, reason: '排程不存在' };
    if (schedule.enabled === 0) return { status: 'disabled', sent: 0, failed: 0, skipped: 0, reason: '排程已停用' };

    const u = queryOne('SELECT id, email, display_name, is_active, timezone FROM users WHERE id = ?', [schedule.user_id]);
    if (!u) {
      db.run('UPDATE report_schedules SET last_summary = ?, updated_at = ? WHERE id = ?',
        [`${formatLocalSummaryTime(startedAt)} ${triggeredBy}：使用者不存在`, startedAt, scheduleId]);
      saveDB();
      return { status: 'user_not_found', sent: 0, failed: 0, skipped: 1, reason: '使用者不存在' };
    }

    if (u.is_active === 0) {
      db.run('UPDATE report_schedules SET last_summary = ?, updated_at = ? WHERE id = ?',
        [`${formatLocalSummaryTime(startedAt)} ${triggeredBy}：使用者帳號已停用，略過寄送`, startedAt, scheduleId]);
      saveDB();
      return { status: 'skipped', sent: 0, failed: 0, skipped: 1, reason: '使用者帳號已停用' };
    }

    if (!isValidEmail(u.email)) {
      const summary = `${formatLocalSummaryTime(startedAt)} ${triggeredBy}：Email 格式錯誤或未設定`;
      db.run('UPDATE report_schedules SET last_run = ?, last_summary = ?, updated_at = ? WHERE id = ?',
        [startedAt, summary, startedAt, scheduleId]);
      saveDB();
      return { status: 'invalid_email', sent: 0, failed: 1, skipped: 0, reason: 'Email 格式錯誤或未設定' };
    }

    if (!getActiveEmailProviders().hasAny) {
      const summary = `${formatLocalSummaryTime(startedAt)} ${triggeredBy}：寄信服務未設定（請設定 EMAIL_PROVIDER_PRIMARY 環境變數）`;
      db.run('UPDATE report_schedules SET last_summary = ?, updated_at = ? WHERE id = ?', [summary, startedAt, scheduleId]);
      saveDB();
      return { status: 'no_email_service', sent: 0, failed: 1, skipped: 0, reason: '寄信服務未設定' };
    }

    let dedupRowId = null;
    if (schedule.freq === 'monthly') {
      const ym = userTime.monthInUserTz(u.timezone || 'Asia/Taipei', startedAt);
      try {
        dedupRowId = crypto.randomUUID().replace(/-/g, '');
        db.run(
          'INSERT INTO monthly_report_send_log (id, user_id, year_month, schedule_id, sent_at_utc) VALUES (?,?,?,?,?)',
          [dedupRowId, u.id, ym, scheduleId, new Date(startedAt).toISOString()]
        );
      } catch (e) {
        if (/UNIQUE|constraint/i.test(String(e?.message || ''))) {
          const summary = `${formatLocalSummaryTime(startedAt)} ${triggeredBy}：本月份已寄送過（dedup skip）`;
          db.run('UPDATE report_schedules SET last_summary = ?, updated_at = ? WHERE id = ?', [summary, startedAt, scheduleId]);
          saveDB();
          return { status: 'skipped', sent: 0, failed: 0, skipped: 1, reason: '本月份已寄送過' };
        }
        throw e;
      }
    }

    let sent = 0;
    let failed = 0;
    let provider = null;
    let errMsg = '';

    try {
      const stats = buildUserStatsReport(u.id, schedule.freq, u.timezone || 'Asia/Taipei');
      const html = renderStatsEmailHtml(u.display_name, u.email, stats);
      const subject = `${stats.month} 個人資產統計報表`;
      const result = await sendStatsEmail({ to: u.email, subject, html });
      if (result) {
        sent = 1;
        provider = result.provider;
      } else {
        failed = 1;
        errMsg = '寄信服務未設定';
      }
    } catch (e) {
      failed = 1;
      errMsg = e?.message || '未知錯誤';
    }

    if (dedupRowId && failed) {
      db.run('UPDATE monthly_report_send_log SET send_status = \'failed\', error_message = ? WHERE id = ?',
        [String(errMsg).slice(0, 500), dedupRowId]);
    }

    const finishedAt = Date.now();
    const summaryParts = [`${formatLocalSummaryTime(startedAt)} ${triggeredBy}：${sent ? `寄送成功(${provider || ''})` : '寄送失敗'}（完成於 ${formatLocalSummaryTime(finishedAt)}）`];
    if (errMsg) summaryParts.push(`錯誤：${errMsg}`);
    const summary = summaryParts.join(' | ');
    db.run('UPDATE report_schedules SET last_run = ?, last_summary = ?, updated_at = ? WHERE id = ?',
      [startedAt, summary, startedAt, scheduleId]);
    saveDB();

    return { status: sent ? 'completed' : 'failed', sent, failed, skipped: 0, provider, reason: errMsg };
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

export { checkAndRunSchedule, shouldRunSchedule, runScheduledReportNow };
