// @ts-nocheck
// lib/scheduler.js — 排程報表心跳（從 server.js 提取）
// 009 FR-006：per-user 時區判斷觸發

import crypto from 'crypto';
import { getDB, queryAll, queryOne, saveDB } from './db';
import { getActiveEmailProviders, sendStatsEmail } from './emailService';
import { buildUserStatsReport, renderStatsEmailHtml } from './statsEmailReport';
import { resolveLedgerScope } from './ledgerScope';
import { getUserLanguage } from './i18n/userLanguage';
import * as userTime from './userTime';

// ── per-schedule lock set（防重複執行）──
const runningSchedules = new Set();

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
  if (!scheduleRow || scheduleRow.enabled === 0 || scheduleRow.notify_email === 0) return false;
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

// ── 排程通知的帳本授權（issue #281）──
// 排程列上的 ledger_id 決定通知要以哪個帳本為資料範圍；寄送／提醒當下重新查詢
// 成員角色，被移除或離開後（resolveLedgerScope 找不到成員）即拒絕寄送。
// 舊資料列或後台建立的排程沒有 ledger_id，一律回退到收件者自己的個人帳本，
// 維持既有「寄給自己」的行為不變。
function resolveScheduleDelivery({ schedule, recipientId, action }) {
  const ledgerId = String(schedule?.ledger_id || '').trim() || `personal:${recipientId}`;
  const scope = resolveLedgerScope({ userId: recipientId, ledgerId });
  if (!scope.ok) {
    return {
      allowed: false,
      reason: `已失去此帳本權限，略過${action}（請重新選擇帳本或移除排程）`,
    };
  }
  if (scope.role === 'viewer') {
    return {
      allowed: false,
      reason: `此帳本為唯讀，檢視者不接收${action}`,
    };
  }
  return {
    allowed: true,
    dataOwnerId: scope.dataOwnerId,
    timezone: scope.timezone,
    ledgerId: scope.ledgerId,
  };
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
    if (schedule.enabled === 0 || schedule.notify_email === 0) return { status: 'disabled', sent: 0, failed: 0, skipped: 0, reason: '排程已停用' };

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

    // issue #281：寄送當下重新授權。排程綁定帳本；若收件者已離開或被移出該帳本，
    // 或角色降為 viewer，就不再寄送共享帳本資料（不寄給無權限的收件者）。
    const delivery = resolveScheduleDelivery({
      schedule,
      recipientId: u.id,
      action: '寄送',
    });
    if (!delivery.allowed) {
      const summary = `${formatLocalSummaryTime(startedAt)} ${triggeredBy}：${delivery.reason}`;
      db.run('UPDATE report_schedules SET last_summary = ?, updated_at = ? WHERE id = ?', [summary, startedAt, scheduleId]);
      saveDB();
      return { status: 'unauthorized', sent: 0, failed: 0, skipped: 1, reason: delivery.reason };
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
          'INSERT INTO monthly_report_send_log (id, user_id, ledger_id, year_month, schedule_id, sent_at_utc) VALUES (?,?,?,?,?,?)',
          [dedupRowId, u.id, delivery.ledgerId, ym, scheduleId, new Date(startedAt).toISOString()]
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
    const locale = getUserLanguage(u.id);
    // 報表內容以「帳本資料擁有者」為範圍：個人帳本即收件者本人，共享帳本為帳本資料，
    // 與 Web／MCP／API 對同一帳本看到的數字一致。
    const stats = buildUserStatsReport(
      delivery.dataOwnerId,
      schedule.freq,
      delivery.timezone || u.timezone || 'Asia/Taipei',
      locale,
    );

    try {
      // 最後一次角色檢查緊貼著外部寄送呼叫；成員離開／被撤銷後即使排程已啟動，
      // 也不得再收到共享帳本的統計資料。
      const sendScope = resolveScheduleDelivery({ schedule, recipientId: u.id, action: '寄送' });
      if (!sendScope.allowed) {
        failed += 1;
        channelResults.push(`Email 略過：${sendScope.reason}`);
        errMsg = sendScope.reason;
      } else {
        const html = renderStatsEmailHtml(u.display_name, u.email, stats, locale);
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
      }
    } catch (e) {
      failed += 1;
      const msg = e?.message || '未知錯誤';
      channelResults.push(`Email 失敗：${msg}`);
      errMsg = [errMsg, msg].filter(Boolean).join('；');
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

    return { status: sent ? 'completed' : 'failed', sent, failed, skipped: 0, provider, channels: channelResults, reason: errMsg };
  } finally {
    runningSchedules.delete(scheduleId);
  }
}

// ── 使用者請求觸發：只檢查目前使用者的排程 ──
// 不使用 setInterval / setTimeout，沒有使用者請求時不會查詢資料庫或寄送通知。
const USER_SCHEDULE_CHECK_COOLDOWN_MS = 30 * 1000;
const lastUserScheduleCheckAt = new Map();

function runDueSchedulesForUser(userId, userTimezone = 'Asia/Taipei', now = Date.now()) {
  if (!userId) return;

  const key = String(userId);
  const lastCheckAt = Number(lastUserScheduleCheckAt.get(key) || 0);
  if (now - lastCheckAt < USER_SCHEDULE_CHECK_COOLDOWN_MS) return;
  lastUserScheduleCheckAt.set(key, now);

  try {
    const rows = queryAll(
      'SELECT * FROM report_schedules WHERE enabled = 1 AND notify_email <> 0 AND user_id = ?',
      [userId],
    );
    for (const row of rows) {
      if (runningSchedules.has(row.id)) continue;
      if (!shouldRunSchedule(row, userTimezone, now)) continue;
      runScheduledReportNow(row.id, '使用者操作').catch(err => console.error('[scheduled-report]', err));
    }
  } catch (e) {
    lastUserScheduleCheckAt.delete(key);
    console.error('[scheduled-report] user-triggered check error', e);
  }
}

export { runDueSchedulesForUser, shouldRunSchedule, runScheduledReportNow };
