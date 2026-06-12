// @ts-nocheck
// lib/scheduler.js — 排程報表心跳（從 server.js 提取）
// 009 FR-006：per-user 時區判斷觸發

import crypto from 'crypto';
import { getDB, queryAll, queryOne, saveDB } from './db';
import { getActiveEmailProviders, sendStatsEmail } from './emailService';
import { LINE_MESSAGING_CHANNEL_ACCESS_TOKEN, buildExpenseReminderFlex, buildStatsReportFlex, pushLineMessage } from './lineMessaging';
import { buildUserStatsReport, renderStatsEmailHtml } from './statsEmailReport';
import * as userTime from './userTime';

// ── per-schedule lock set（防重複執行）──
const runningSchedules = new Set();
const runningExpenseReminders = new Set();

// ── 某年某月（1-based）的天數，即該月最後一天 ──
function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

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
  // 分鐘級觸發：當地時刻須已達排定的 時:分（例如 23:59）
  const nowMinutes = local.hour * 60 + local.minute;
  const schedMinutes = (Number(scheduleRow.hour) || 0) * 60 + (Number(scheduleRow.minute) || 0);
  if (nowMinutes < schedMinutes) return false;

  const ymd = `${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`;
  const periodStart = localDayStartMs(tz, ymd);

  if (scheduleRow.freq === 'daily') {
    // 每日：無額外條件
  } else if (scheduleRow.freq === 'weekly') {
    if (local.weekday !== (Number(scheduleRow.weekday) || 0)) return false;
  } else if (scheduleRow.freq === 'monthly') {
    const dom = Number(scheduleRow.day_of_month);
    if (dom === 0) {
      // 0 = 每月最後一天
      if (local.day !== daysInMonth(local.year, local.month)) return false;
    } else if (local.day !== (dom || 1)) {
      return false;
    }
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

function scheduleWantsEmail(schedule) {
  return schedule.notify_email !== 0;
}

function scheduleWantsLine(schedule) {
  return schedule.notify_line === 1;
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

    const u = queryOne('SELECT id, email, display_name, is_active, timezone, line_id FROM users WHERE id = ?', [schedule.user_id]);
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

    const wantsEmail = scheduleWantsEmail(schedule);
    const wantsLine = scheduleWantsLine(schedule);
    if (!wantsEmail && !wantsLine) {
      const summary = `${formatLocalSummaryTime(startedAt)} ${triggeredBy}：未選擇通知方式`;
      db.run('UPDATE report_schedules SET last_summary = ?, updated_at = ? WHERE id = ?', [summary, startedAt, scheduleId]);
      saveDB();
      return { status: 'no_channel', sent: 0, failed: 1, skipped: 0, reason: '未選擇通知方式' };
    }

    const invalidEmail = wantsEmail && !isValidEmail(u.email);
    const noEmailService = wantsEmail && !getActiveEmailProviders().hasAny;
    const noLineService = wantsLine && !LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
    const lineNotLinked = wantsLine && !u.line_id;

    if (invalidEmail && !wantsLine) {
      const summary = `${formatLocalSummaryTime(startedAt)} ${triggeredBy}：Email 格式錯誤或未設定`;
      db.run('UPDATE report_schedules SET last_run = ?, last_summary = ?, updated_at = ? WHERE id = ?',
        [startedAt, summary, startedAt, scheduleId]);
      saveDB();
      return { status: 'invalid_email', sent: 0, failed: 1, skipped: 0, reason: 'Email 格式錯誤或未設定' };
    }

    if (noEmailService && !wantsLine) {
      const summary = `${formatLocalSummaryTime(startedAt)} ${triggeredBy}：寄信服務未設定（請設定 EMAIL_PROVIDER_PRIMARY 環境變數）`;
      db.run('UPDATE report_schedules SET last_summary = ?, updated_at = ? WHERE id = ?', [summary, startedAt, scheduleId]);
      saveDB();
      return { status: 'no_email_service', sent: 0, failed: 1, skipped: 0, reason: '寄信服務未設定' };
    }

    if (noLineService && !wantsEmail) {
      const summary = `${formatLocalSummaryTime(startedAt)} ${triggeredBy}：LINE Messaging API 未設定`;
      db.run('UPDATE report_schedules SET last_summary = ?, updated_at = ? WHERE id = ?', [summary, startedAt, scheduleId]);
      saveDB();
      return { status: 'no_line_service', sent: 0, failed: 1, skipped: 0, reason: 'LINE Messaging API 未設定' };
    }

    if (lineNotLinked && !wantsEmail) {
      const summary = `${formatLocalSummaryTime(startedAt)} ${triggeredBy}：使用者尚未綁定 LINE`;
      db.run('UPDATE report_schedules SET last_run = ?, last_summary = ?, updated_at = ? WHERE id = ?',
        [startedAt, summary, startedAt, scheduleId]);
      saveDB();
      return { status: 'line_not_linked', sent: 0, failed: 1, skipped: 0, reason: '使用者尚未綁定 LINE' };
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
    const channelResults = [];
    const stats = buildUserStatsReport(u.id, schedule.freq, u.timezone || 'Asia/Taipei');

    if (wantsEmail) {
      if (invalidEmail) {
        failed += 1;
        channelResults.push('Email 失敗：Email 格式錯誤或未設定');
      } else if (noEmailService) {
        failed += 1;
        channelResults.push('Email 失敗：寄信服務未設定');
      } else {
      try {
        const html = renderStatsEmailHtml(u.display_name, u.email, stats);
        const subject = stats.subject || `${stats.month} 個人資產統計報表`;
        const result = await sendStatsEmail({ to: u.email, subject, html });
        if (result) {
          sent += 1;
          provider = result.provider;
          channelResults.push(`Email 成功(${provider || ''})`);
        } else {
          failed += 1;
          channelResults.push('Email 失敗');
          errMsg = '寄信服務未設定';
        }
      } catch (e) {
        failed += 1;
        const msg = e?.message || '未知錯誤';
        channelResults.push(`Email 失敗：${msg}`);
        errMsg = [errMsg, msg].filter(Boolean).join('；');
      }
      }
    }

    if (wantsLine) {
      if (noLineService) {
        failed += 1;
        channelResults.push('LINE 失敗：LINE Messaging API 未設定');
      } else if (lineNotLinked) {
        failed += 1;
        channelResults.push('LINE 失敗：使用者尚未綁定 LINE');
      } else {
      try {
        const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || `https://${process.env.APP_HOST || 'localhost'}`;
        await pushLineMessage(u.line_id, [buildStatsReportFlex(u.display_name, stats, appUrl)]);
        sent += 1;
        channelResults.push('LINE 成功');
      } catch (e) {
        failed += 1;
        const msg = e?.message || '未知錯誤';
        channelResults.push(`LINE 失敗：${msg}`);
        errMsg = [errMsg, msg].filter(Boolean).join('；');
      }
      }
    }

    if (dedupRowId && failed) {
      db.run('UPDATE monthly_report_send_log SET send_status = \'failed\', error_message = ? WHERE id = ?',
        [String(errMsg).slice(0, 500), dedupRowId]);
    }

    const finishedAt = Date.now();
    const summaryParts = [`${formatLocalSummaryTime(startedAt)} ${triggeredBy}：${channelResults.join(' / ') || (sent ? '寄送成功' : '寄送失敗')}（完成於 ${formatLocalSummaryTime(finishedAt)}）`];
    if (errMsg) summaryParts.push(`錯誤：${errMsg}`);
    const summary = summaryParts.join(' | ');
    db.run('UPDATE report_schedules SET last_run = ?, last_summary = ?, updated_at = ? WHERE id = ?',
      [startedAt, summary, startedAt, scheduleId]);
    saveDB();

    return { status: sent ? (failed ? 'partial' : 'completed') : 'failed', sent, failed, skipped: 0, provider, channels: channelResults, reason: errMsg };
  } finally {
    runningSchedules.delete(scheduleId);
  }
}

async function runLineExpenseReminderNow(reminderId, triggeredBy = '排程') {
  if (!reminderId) return { status: 'invalid', sent: 0, failed: 0, skipped: 0, reason: '未指定提醒' };
  if (runningExpenseReminders.has(reminderId)) return { status: 'already_running', sent: 0, failed: 0, skipped: 0, reason: '此提醒已有任務進行中' };

  runningExpenseReminders.add(reminderId);
  const startedAt = Date.now();
  try {
    const db = getDB();
    const reminder = queryOne('SELECT * FROM line_expense_reminders WHERE id = ?', [reminderId]);
    if (!reminder) return { status: 'not_found', sent: 0, failed: 0, skipped: 0, reason: '提醒不存在' };
    if (reminder.enabled === 0) return { status: 'disabled', sent: 0, failed: 0, skipped: 0, reason: '提醒已停用' };

    const u = queryOne('SELECT id, display_name, is_active, line_id FROM users WHERE id = ?', [reminder.user_id]);
    if (!u) {
      db.run('UPDATE line_expense_reminders SET last_summary = ?, updated_at = ? WHERE id = ?',
        [`${formatLocalSummaryTime(startedAt)} ${triggeredBy}：使用者不存在`, startedAt, reminderId]);
      saveDB();
      return { status: 'user_not_found', sent: 0, failed: 0, skipped: 1, reason: '使用者不存在' };
    }
    if (u.is_active === 0) {
      db.run('UPDATE line_expense_reminders SET last_summary = ?, updated_at = ? WHERE id = ?',
        [`${formatLocalSummaryTime(startedAt)} ${triggeredBy}：使用者帳號已停用，略過提醒`, startedAt, reminderId]);
      saveDB();
      return { status: 'skipped', sent: 0, failed: 0, skipped: 1, reason: '使用者帳號已停用' };
    }
    if (!LINE_MESSAGING_CHANNEL_ACCESS_TOKEN) {
      const summary = `${formatLocalSummaryTime(startedAt)} ${triggeredBy}：LINE Messaging API 未設定`;
      db.run('UPDATE line_expense_reminders SET last_summary = ?, updated_at = ? WHERE id = ?', [summary, startedAt, reminderId]);
      saveDB();
      return { status: 'no_line_service', sent: 0, failed: 1, skipped: 0, reason: 'LINE Messaging API 未設定' };
    }
    if (!u.line_id) {
      const summary = `${formatLocalSummaryTime(startedAt)} ${triggeredBy}：使用者尚未綁定 LINE`;
      db.run('UPDATE line_expense_reminders SET last_run = ?, last_summary = ?, updated_at = ? WHERE id = ?',
        [startedAt, summary, startedAt, reminderId]);
      saveDB();
      return { status: 'line_not_linked', sent: 0, failed: 1, skipped: 0, reason: '使用者尚未綁定 LINE' };
    }

    try {
      await pushLineMessage(u.line_id, [buildExpenseReminderFlex(u.display_name)]);
      const finishedAt = Date.now();
      const summary = `${formatLocalSummaryTime(startedAt)} ${triggeredBy}：LINE 提醒成功（完成於 ${formatLocalSummaryTime(finishedAt)}）`;
      db.run('UPDATE line_expense_reminders SET last_run = ?, last_summary = ?, updated_at = ? WHERE id = ?',
        [startedAt, summary, startedAt, reminderId]);
      saveDB();
      return { status: 'completed', sent: 1, failed: 0, skipped: 0 };
    } catch (e) {
      const msg = e?.message || '未知錯誤';
      const summary = `${formatLocalSummaryTime(startedAt)} ${triggeredBy}：LINE 提醒失敗 | 錯誤：${msg}`;
      db.run('UPDATE line_expense_reminders SET last_run = ?, last_summary = ?, updated_at = ? WHERE id = ?',
        [startedAt, summary, startedAt, reminderId]);
      saveDB();
      return { status: 'failed', sent: 0, failed: 1, skipped: 0, reason: msg };
    }
  } finally {
    runningExpenseReminders.delete(reminderId);
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

    const reminders = queryAll(
      'SELECT r.*, u.timezone AS user_timezone FROM line_expense_reminders r JOIN users u ON u.id = r.user_id WHERE r.enabled = 1 AND u.is_active = 1'
    );
    for (const row of reminders) {
      if (runningExpenseReminders.has(row.id)) continue;
      const tz = row.user_timezone || 'Asia/Taipei';
      if (!shouldRunSchedule(row, tz, now)) continue;
      runLineExpenseReminderNow(row.id, '排程').catch(err => console.error('[line-expense-reminder]', err));
    }
  } catch (e) {
    console.error('[scheduled-report] check error', e);
  }
}

export { checkAndRunSchedule, shouldRunSchedule, runScheduledReportNow, runLineExpenseReminderNow };
