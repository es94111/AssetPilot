'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPut, apiPost, apiDelete } from '@/lib/clientApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const SCHEDULE_FREQ_OPTIONS = [
  { value: 'daily', label: '每日' },
  { value: 'weekly', label: '每週' },
  { value: 'monthly', label: '每月' },
];

const RETENTION_OPTIONS = ['30', '90', '180', '365', 'forever'];

// 每月日期下拉選項：0 = 最後一天，1-28 = 指定日期
const DAY_OF_MONTH_OPTIONS = [{ value: '0', label: '最後一天' }, ...Array.from({ length: 28 }, (_, i) => ({ value: String(i + 1), label: `${i + 1} 日` }))];

// 排程時間描述（時:分 + 頻率細節），item 來自 API 序列化結果
function fmtScheduleTime(item: { hour: number; minute?: number; freq: string; weekday?: number; dayOfMonth?: number }) {
  const time = `${String(item.hour).padStart(2, '0')}:${String(item.minute || 0).padStart(2, '0')}`;
  if (item.freq === 'weekly') return `${time} (週 ${item.weekday})`;
  if (item.freq === 'monthly') return `${time} (${Number(item.dayOfMonth) === 0 ? '每月最後一天' : `每月 ${item.dayOfMonth} 日`})`;
  return time;
}

function fmtTs(ts: number | string) {
  if (!ts) return '—';
  const date = typeof ts === 'number' || /^\d+$/.test(String(ts)) ? new Date(Number(ts)) : new Date(ts);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-TW');
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  export_accounts: '匯出帳戶資料',
  import_accounts: '匯入帳戶資料',
  export_categories: '匯出分類資料',
  import_categories: '匯入分類資料',
  export_transactions: '匯出交易資料',
  import_transactions: '匯入交易資料',
  export_stock_transactions: '匯出台股交易資料',
  import_stock_transactions: '匯入台股交易資料',
  export_stock_dividends: '匯出台股股利資料',
  import_stock_dividends: '匯入台股股利資料',
  download_backup: '下載資料庫備份',
  restore_backup: '還原資料庫備份',
  restore_failed: '資料庫還原失敗',
  'user.timezone.update': '更新使用者時區',
};

const AUDIT_RESULT_LABELS: Record<string, string> = {
  success: '成功',
  failed: '失敗',
  rolled_back: '已復原',
};

function formatAuditAction(action: string) {
  if (!action) return '—';
  return AUDIT_ACTION_LABELS[action] || action;
}

function formatAuditResult(result: string) {
  if (!result) return '—';
  return AUDIT_RESULT_LABELS[result] || result;
}

function getAuditUserEmail(log: any, users: any[]) {
  const user = users.find((u) => u.id === log.user_id);
  return user?.email || log.user_email || log.email || log.user_id || '—';
}

function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

async function downloadFromUrl(url: string) {
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || data.message || `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const disposition = res.headers.get('Content-Disposition') || '';
  const filenameMatch = disposition.match(/filename="([^"]+)"/);
  const a = document.createElement('a');
  a.href = href;
  a.download = filenameMatch?.[1] || 'download.bin';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

export default function AdminClient(_props: { user?: any } = {}) {
  const [activeTab, setActiveTab] = useState('system');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  const [publicRegistration, setPublicRegistration] = useState(false);
  const [lineLoginEnabled, setLineLoginEnabled] = useState(false);
  const [allowedEmails, setAllowedEmails] = useState('');
  const [ipAllowlist, setIpAllowlist] = useState('');
  const [transactionPhotoStorage, setTransactionPhotoStorage] = useState<'' | 'local' | 's3'>('');
  const [transactionPhotoMaxMb, setTransactionPhotoMaxMb] = useState('');
  const [photoCompressing, setPhotoCompressing] = useState(false);
  const [photoCompressMsg, setPhotoCompressMsg] = useState('');
  const [stockAutoUpdateEnabled, setStockAutoUpdateEnabled] = useState(true);
  const [stockAutoUpdateIntervalMin, setStockAutoUpdateIntervalMin] = useState('10');
  const [stockAutoUpdateLastRun, setStockAutoUpdateLastRun] = useState(0);
  const [stockAutoUpdateLastSummary, setStockAutoUpdateLastSummary] = useState('');
  const [stockUpdateMsg, setStockUpdateMsg] = useState('');
  const [stockUpdating, setStockUpdating] = useState(false);

  const [serverTime, setServerTime] = useState<any>(null);
  const [serverTimeMsg, setServerTimeMsg] = useState('');

  const [emailProviders, setEmailProviders] = useState<any>(null);
  const [emailMsg, setEmailMsg] = useState('');

  const [certInfo, setCertInfo] = useState<any>(null);
  const [originCaPem, setOriginCaPem] = useState('');
  const [originCertPem, setOriginCertPem] = useState('');
  const [originKeyPem, setOriginKeyPem] = useState('');
  const [certMsg, setCertMsg] = useState('');

  const [schedules, setSchedules] = useState<any[]>([]);
  const [scheduleForm, setScheduleForm] = useState({ userId: '', freq: 'daily', hour: '9', minute: '0', weekday: '1', dayOfMonth: '1', notifyEmail: true, notifyLine: false });
  const [scheduleMsg, setScheduleMsg] = useState('');
  const [expenseReminders, setExpenseReminders] = useState<any[]>([]);
  const [expenseReminderForm, setExpenseReminderForm] = useState({ userId: '', freq: 'daily', hour: '21', minute: '0', weekday: '0', dayOfMonth: '1' });

  const [adminSelfLogs, setAdminSelfLogs] = useState<any[]>([]);
  const [allLogs, setAllLogs] = useState<any[]>([]);
  const [selectedLogIds, setSelectedLogIds] = useState<string[]>([]);
  const [logMsg, setLogMsg] = useState('');

  const [auditRetention, setAuditRetention] = useState('90');
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditMsg, setAuditMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settings, userList, timeInfo, providers, certs, scheduleList, expenseReminderList, adminLogs, userLogs, retention, auditResp] = await Promise.all([
        apiGet('/api/admin/system-settings'),
        apiGet('/api/admin/users').catch(() => []),
        apiGet('/api/admin/server-time').catch(() => null),
        apiGet('/api/admin/email-providers').catch(() => null),
        apiGet('/api/admin/certs').catch(() => null),
        apiGet('/api/admin/report-schedules').catch(() => []),
        apiGet('/api/admin/line-expense-reminders').catch(() => []),
        apiGet('/api/admin/login-audit?scope=admin-self').catch(() => ({ logs: [] })),
        apiGet('/api/admin/login-audit').catch(() => ({ logs: [] })),
        apiGet('/api/admin/data-audit/retention').catch(() => ({ retention_days: '90' })),
        apiGet('/api/admin/data-audit').catch(() => ({ data: [], total: 0 })),
      ]);

      setPublicRegistration(!!settings.publicRegistration);
      setLineLoginEnabled(!!settings.lineLoginEnabled);
      setAllowedEmails(Array.isArray(settings.allowedRegistrationEmails) ? settings.allowedRegistrationEmails.join('\n') : '');
      setIpAllowlist(Array.isArray(settings.adminIpAllowlist) ? settings.adminIpAllowlist.join('\n') : '');
      setTransactionPhotoStorage((settings.transactionPhotoStorage as '' | 'local' | 's3') || '');
      setTransactionPhotoMaxMb(settings.transactionPhotoMaxBytes ? String(Math.round(settings.transactionPhotoMaxBytes / 1024 / 1024)) : '');
      setStockAutoUpdateEnabled(settings.stockAutoUpdateEnabled !== false);
      setStockAutoUpdateIntervalMin(String(settings.stockAutoUpdateIntervalMin || 10));
      setStockAutoUpdateLastRun(Number(settings.stockAutoUpdateLastRun) || 0);
      setStockAutoUpdateLastSummary(String(settings.stockAutoUpdateLastSummary || ''));
      setUsers(userList || []);
      setServerTime(timeInfo);
      setEmailProviders(providers);
      setCertInfo(certs);
      setSchedules(scheduleList || []);
      setExpenseReminders(expenseReminderList || []);
      setAdminSelfLogs(adminLogs.logs || []);
      setAllLogs(userLogs.logs || []);
      setAuditRetention(String(retention.retention_days || '90'));
      setAuditLogs(auditResp.data || []);
      setAuditTotal(auditResp.total || 0);
      setScheduleForm((prev) => ({ ...prev, userId: userList?.[0]?.id || prev.userId || '' }));
      setExpenseReminderForm((prev) => ({ ...prev, userId: userList?.[0]?.id || prev.userId || '' }));
    } catch (e: any) {
      setSaveMsg('載入失敗：' + e.message);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveSystemSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    try {
      const maxMbNum = parseFloat(transactionPhotoMaxMb);
      await apiPut('/api/admin/system-settings', {
        publicRegistration,
        lineLoginEnabled,
        allowedRegistrationEmails: allowedEmails.split('\n').map((s) => s.trim()).filter(Boolean),
        adminIpAllowlist: ipAllowlist.split('\n').map((s) => s.trim()).filter(Boolean),
        transactionPhotoStorage,
        transactionPhotoMaxBytes: transactionPhotoMaxMb === '' ? 0 : Math.round(maxMbNum * 1024 * 1024),
        stockAutoUpdateEnabled,
        stockAutoUpdateIntervalMin: Math.min(1440, Math.max(1, parseInt(stockAutoUpdateIntervalMin, 10) || 10)),
      });
      setSaveMsg('設定已儲存');
    } catch (e: any) {
      setSaveMsg('儲存失敗：' + e.message);
    }
    setSaving(false);
  }

  async function handleStockPriceUpdateNow() {
    setStockUpdating(true);
    setStockUpdateMsg('');
    try {
      const result = await apiPost('/api/admin/stock-price-update/run-now', {});
      if (result?.status === 'completed') {
        setStockUpdateMsg(`已更新 ${result.updatedSymbols}/${result.totalSymbols ?? result.updatedSymbols} 檔（${result.updatedRows} 筆持股）${result.failed ? `，失敗 ${result.failed} 檔` : ''}`);
      } else if (result?.status === 'already_running') {
        setStockUpdateMsg('已有更新任務進行中');
      } else {
        setStockUpdateMsg(result?.reason || '更新失敗');
      }
      const settings = await apiGet('/api/admin/system-settings').catch(() => null);
      if (settings) {
        setStockAutoUpdateLastRun(Number(settings.stockAutoUpdateLastRun) || 0);
        setStockAutoUpdateLastSummary(String(settings.stockAutoUpdateLastSummary || ''));
      }
    } catch (e: any) {
      setStockUpdateMsg('更新失敗：' + e.message);
    }
    setStockUpdating(false);
  }

  async function handleCompressS3Photos() {
    if (!confirm('將重新壓縮 S3 上所有尚未壓縮的交易照片，並「原地覆寫」原檔，此動作無法復原。確定執行？')) return;
    setPhotoCompressing(true);
    setPhotoCompressMsg('');
    try {
      const r = await apiPost('/api/admin/transaction-photos/compress', {});
      const savedMb = Math.max(0, (Number(r.bytesBefore) - Number(r.bytesAfter)) / 1024 / 1024);
      setPhotoCompressMsg(
        `掃描 ${r.scanned} 張，壓縮 ${r.recompressed} 張，略過 ${r.skipped} 張${r.failed ? `，失敗 ${r.failed} 張` : ''}；省下約 ${savedMb.toFixed(1)} MB`
      );
    } catch (e: any) {
      setPhotoCompressMsg('壓縮失敗：' + e.message);
    }
    setPhotoCompressing(false);
  }

  async function handleToggleAdmin(userId: string) {
    const target = users.find((u) => u.id === userId);
    if (!target) return;
    try {
      await apiPut(`/api/admin/users/${userId}`, { isAdmin: !target.isAdmin });
      await load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm('確定要刪除此使用者嗎？其所有資料將一併刪除。')) return;
    try {
      await apiDelete(`/api/admin/users/${userId}`);
      await load();
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleResetPassword(userId: string) {
    const newPassword = window.prompt('輸入新密碼（至少 8 碼，含大小寫、數字、特殊符號）');
    if (!newPassword) return;
    try {
      await apiPut(`/api/admin/users/${userId}/password`, { newPassword });
      alert('密碼已重設');
    } catch (e: any) {
      alert(e.message);
    }
  }

  async function handleCreateSchedule(e: React.FormEvent) {
    e.preventDefault();
    setScheduleMsg('');
    try {
      await apiPost('/api/admin/report-schedules', {
        userId: scheduleForm.userId,
        freq: scheduleForm.freq,
        hour: Number(scheduleForm.hour),
        minute: Number(scheduleForm.minute),
        weekday: Number(scheduleForm.weekday),
        dayOfMonth: Number(scheduleForm.dayOfMonth),
        notifyEmail: scheduleForm.notifyEmail,
        notifyLine: scheduleForm.notifyLine,
      });
      setScheduleMsg('排程已新增');
      await load();
    } catch (e: any) {
      setScheduleMsg(e.message || '新增排程失敗');
    }
  }

  async function handleToggleSchedule(id: string, enabled: boolean) {
    try {
      await apiPut(`/api/admin/report-schedules/${id}`, { enabled: !enabled });
      await load();
    } catch (e: any) {
      setScheduleMsg(e.message || '更新排程失敗');
    }
  }

  async function handleDeleteSchedule(id: string) {
    if (!confirm('確定要刪除此排程嗎？')) return;
    try {
      await apiDelete(`/api/admin/report-schedules/${id}`);
      await load();
    } catch (e: any) {
      setScheduleMsg(e.message || '刪除排程失敗');
    }
  }

  async function handleRunScheduleNow(id: string) {
    try {
      await apiPost(`/api/admin/report-schedules/${id}/run-now`);
      setScheduleMsg('排程已執行');
    } catch (e: any) {
      setScheduleMsg(e.message || '立即執行失敗');
    }
  }

  async function handleToggleScheduleChannel(id: string, field: 'notifyEmail' | 'notifyLine', value: boolean) {
    try {
      await apiPut(`/api/admin/report-schedules/${id}`, { [field]: !value });
      await load();
    } catch (e: any) {
      setScheduleMsg(e.message || '更新通知方式失敗');
    }
  }

  async function handleCreateExpenseReminder(e: React.FormEvent) {
    e.preventDefault();
    setScheduleMsg('');
    try {
      await apiPost('/api/admin/line-expense-reminders', {
        userId: expenseReminderForm.userId,
        freq: expenseReminderForm.freq,
        hour: Number(expenseReminderForm.hour),
        minute: Number(expenseReminderForm.minute),
        weekday: Number(expenseReminderForm.weekday),
        dayOfMonth: Number(expenseReminderForm.dayOfMonth),
      });
      setScheduleMsg('LINE 支出提醒已新增');
      await load();
    } catch (e: any) {
      setScheduleMsg(e.message || '新增 LINE 支出提醒失敗');
    }
  }

  async function handleToggleExpenseReminder(id: string, enabled: boolean) {
    try {
      await apiPut(`/api/admin/line-expense-reminders/${id}`, { enabled: !enabled });
      await load();
    } catch (e: any) {
      setScheduleMsg(e.message || '更新 LINE 支出提醒失敗');
    }
  }

  async function handleDeleteExpenseReminder(id: string) {
    if (!confirm('確定要刪除此 LINE 支出提醒嗎？')) return;
    try {
      await apiDelete(`/api/admin/line-expense-reminders/${id}`);
      await load();
    } catch (e: any) {
      setScheduleMsg(e.message || '刪除 LINE 支出提醒失敗');
    }
  }

  async function handleRunExpenseReminderNow(id: string) {
    try {
      await apiPost(`/api/admin/line-expense-reminders/${id}/run-now`);
      setScheduleMsg('LINE 支出提醒已送出');
      await load();
    } catch (e: any) {
      setScheduleMsg(e.message || '立即提醒失敗');
    }
  }

  async function handleSaveOriginCa() {
    setCertMsg('');
    try {
      await apiPost('/api/admin/certs/origin/ca', { cert: originCaPem });
      setCertMsg('Origin CA 已儲存，需重新啟動服務生效');
      await load();
    } catch (e: any) {
      setCertMsg(e.message || '儲存 Origin CA 失敗');
    }
  }

  async function handleDeleteOriginCa() {
    setCertMsg('');
    try {
      await apiDelete('/api/admin/certs/origin/ca');
      setCertMsg('Origin CA 已刪除');
      await load();
    } catch (e: any) {
      setCertMsg(e.message || '刪除 Origin CA 失敗');
    }
  }

  async function handleSaveOriginCert() {
    setCertMsg('');
    try {
      await apiPost('/api/admin/certs/origin', { cert: originCertPem, key: originKeyPem });
      setCertMsg('Origin Certificate / Key 已儲存，需重新啟動服務生效');
      await load();
    } catch (e: any) {
      setCertMsg(e.message || '儲存 Origin Certificate 失敗');
    }
  }

  async function handleDeleteOriginCert() {
    setCertMsg('');
    try {
      await apiDelete('/api/admin/certs/origin');
      setCertMsg('Origin Certificate / Key 已刪除');
      await load();
    } catch (e: any) {
      setCertMsg(e.message || '刪除 Origin Certificate 失敗');
    }
  }

  async function handleSendTestEmail() {
    setEmailMsg('');
    try {
      const result = await apiPost('/api/admin/test-email');
      setEmailMsg(`測試信已送出，使用通道：${result.provider}`);
    } catch (e: any) {
      setEmailMsg(e.message || '寄送測試信失敗');
    }
  }

  async function handleDeleteSelectedLogs() {
    if (selectedLogIds.length === 0) return;
    try {
      const result = await apiPost('/api/admin/login-audit/batch-delete', { ids: selectedLogIds });
      setLogMsg(`已刪除 ${result.deleted || 0} 筆登入紀錄`);
      setSelectedLogIds([]);
      await load();
    } catch (e: any) {
      setLogMsg(e.message || '刪除登入紀錄失敗');
    }
  }

  async function handleDeleteSingleLog(id: string) {
    try {
      await apiDelete(`/api/admin/login-audit/${encodeURIComponent(id)}`);
      await load();
    } catch (e: any) {
      setLogMsg(e.message || '刪除登入紀錄失敗');
    }
  }

  async function handleSaveRetention() {
    setAuditMsg('');
    try {
      await apiPut('/api/admin/data-audit/retention', { retention_days: auditRetention });
      setAuditMsg('保留天數已更新');
    } catch (e: any) {
      setAuditMsg(e.message || '更新保留天數失敗');
    }
  }

  async function handlePurgeAudit() {
    if (!confirm('確定要清空資料稽核日誌嗎？')) return;
    setAuditMsg('');
    try {
      const result = await apiPost('/api/admin/data-audit/purge');
      setAuditMsg(`已刪除 ${result.deleted || 0} 筆稽核紀錄`);
      await load();
    } catch (e: any) {
      setAuditMsg(e.message || '清空稽核日誌失敗');
    }
  }

  async function handleExportAudit() {
    setAuditMsg('');
    try {
      await downloadFromUrl('/api/admin/data-audit/export');
      setAuditMsg('稽核日誌 CSV 已下載');
    } catch (e: any) {
      setAuditMsg(e.message || '匯出稽核日誌失敗');
    }
  }

  function handleExportLoginLogs() {
    const lines = [
      'loginAt,ipAddress,country,loginMethod,isSuccess,email,displayName',
      ...allLogs.map((log) => [
        fmtTs(log.loginAt),
        log.ipAddress || '',
        log.country || '',
        log.loginMethod || '',
        log.isSuccess ? 'true' : 'false',
        log.email || '',
        log.displayName || '',
      ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')),
    ];
    downloadText(`login-audit-${Date.now()}.csv`, lines.join('\n'), 'text/csv;charset=utf-8');
  }

  async function handleServerTimeReset() {
    setServerTimeMsg('');
    try {
      await apiPut('/api/admin/server-time', { mode: 'reset' });
      setServerTimeMsg('伺服器時間偏移已重設');
      await load();
    } catch (e: any) {
      setServerTimeMsg(e.message || '重設伺服器時間失敗');
    }
  }

  async function handleNtpSync() {
    setServerTimeMsg('');
    try {
      await apiPost('/api/admin/server-time/ntp-sync');
      setServerTimeMsg('已要求 NTP 同步');
    } catch (e: any) {
      setServerTimeMsg(e.message || 'NTP 同步失敗');
    }
  }

  if (loading) return <div className="p-8 text-slate-500">載入中...</div>;

  const tabs = [
    { id: 'system', label: '系統設定' },
    { id: 'users', label: '使用者管理' },
    { id: 'schedules', label: '報表排程' },
    { id: 'email', label: '寄信通道' },
    { id: 'loginAudit', label: '登入稽核' },
    { id: 'dataAudit', label: '資料稽核' },
    { id: 'certs', label: '憑證管理' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">管理員設定</h2>

      <div className="flex flex-wrap gap-2 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'system' && (
        <div className="space-y-6">
          <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
            <h3 className="text-lg font-semibold mb-4">系統設定</h3>
            <form onSubmit={saveSystemSettings} className="space-y-4">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={publicRegistration} onChange={(e) => setPublicRegistration(e.target.checked)} className="w-4 h-4" />
                開放公開註冊
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={lineLoginEnabled} onChange={(e) => setLineLoginEnabled(e.target.checked)} className="w-4 h-4" />
                啟用 LINE 登入
              </label>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">允許註冊的電子郵件（每行一筆）</label>
                <textarea rows={4} value={allowedEmails} onChange={(e) => setAllowedEmails(e.target.value)} className="w-full p-2 border rounded-md" placeholder="留空表示不限制" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">管理員 IP 白名單（每行一筆）</label>
                <textarea rows={3} value={ipAllowlist} onChange={(e) => setIpAllowlist(e.target.value)} className="w-full p-2 border rounded-md" placeholder="留空表示不限制" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">交易憑證照片儲存位置</label>
                <select className="w-full p-2 border rounded-md" value={transactionPhotoStorage} onChange={(e) => setTransactionPhotoStorage(e.target.value as '' | 'local' | 's3')}>
                  <option value="">依環境設定（預設）</option>
                  <option value="local">強制使用本機儲存</option>
                  <option value="s3">強制使用 S3 雲端儲存</option>
                </select>
                <p className="text-xs text-slate-500 mt-1">設定後會覆蓋環境變數，套用至所有使用者的新上傳</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">交易憑證照片大小上限（MB）</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  className="w-full p-2 border rounded-md"
                  value={transactionPhotoMaxMb}
                  onChange={(e) => setTransactionPhotoMaxMb(e.target.value)}
                  placeholder={`留空使用環境變數預設值（${Math.round(10485760 / 1024 / 1024)} MB）`}
                />
                <p className="text-xs text-slate-500 mt-1">覆蓋 TRANSACTION_PHOTO_MAX_BYTES，留空則沿用環境變數設定</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">壓縮 S3 既有照片</label>
                <div className="flex items-center gap-3">
                  <Button type="button" variant="outline" onClick={handleCompressS3Photos} disabled={photoCompressing}>{photoCompressing ? '壓縮中...' : '壓縮 S3 既有照片'}</Button>
                  {photoCompressMsg && <span className={`text-sm ${photoCompressMsg.includes('失敗') ? 'text-red-500' : 'text-slate-600'}`}>{photoCompressMsg}</span>}
                </div>
                <p className="text-xs text-slate-500 mt-1">將 S3 上尚未壓縮的交易照片重新編碼為最長邊 1600px／JPEG 82，原地覆寫以節省空間（不可復原）。資料量大時可能需數分鐘。</p>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={stockAutoUpdateEnabled} onChange={(e) => setStockAutoUpdateEnabled(e.target.checked)} className="w-4 h-4" />
                  啟用股價自動更新（台股交易時段內定時抓 TWSE/TPEx 最新價）
                </label>
                <p className="text-xs text-slate-500 mt-1">伺服器於台北時間週一~週五 09:00–14:00 內，每隔指定分鐘數自動更新所有使用者的持股現價</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">股價更新間隔（分鐘）</label>
                <input
                  type="number"
                  min={1}
                  max={1440}
                  step={1}
                  className="w-full p-2 border rounded-md"
                  value={stockAutoUpdateIntervalMin}
                  onChange={(e) => setStockAutoUpdateIntervalMin(e.target.value)}
                  placeholder="10"
                />
                <p className="text-xs text-slate-500 mt-1">1 ~ 1440 分鐘；可用環境變數 STOCK_AUTO_UPDATE_ENABLED / STOCK_AUTO_UPDATE_INTERVAL_MIN 覆寫</p>
              </div>
              {saveMsg && <p className={`text-sm ${saveMsg.includes('失敗') ? 'text-red-500' : 'text-green-600'}`}>{saveMsg}</p>}
              <Button type="submit" disabled={saving}>{saving ? '儲存中...' : '儲存設定'}</Button>
            </form>
          </div>

          <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm space-y-3">
            <h3 className="text-lg font-semibold">股價更新狀態</h3>
            <div className="text-sm text-slate-700">
              <div>上次更新：{stockAutoUpdateLastRun ? new Date(stockAutoUpdateLastRun).toLocaleString() : '尚未執行'}</div>
              {stockAutoUpdateLastSummary && <div className="mt-1 text-slate-500 break-all">{stockAutoUpdateLastSummary}</div>}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={handleStockPriceUpdateNow} disabled={stockUpdating}>{stockUpdating ? '更新中...' : '立即更新股價'}</Button>
              {stockUpdateMsg && <span className={`text-sm ${stockUpdateMsg.includes('失敗') ? 'text-red-500' : 'text-slate-600'}`}>{stockUpdateMsg}</span>}
            </div>
            <p className="text-xs text-slate-500">手動更新會略過交易時段與間隔限制，立即抓取所有持股最新價</p>
          </div>

          <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm space-y-4">
            <h3 className="text-lg font-semibold">伺服器時間</h3>
            {serverTime && (
              <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-700">
                <div>實際時間：{serverTime.realNowIso}</div>
                <div>生效時間：{serverTime.effectiveNowIso}</div>
                <div>偏移量：{serverTime.offsetMs} ms</div>
                <div>時區：{serverTime.timezone || '—'}</div>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={handleServerTimeReset}>重設偏移</Button>
              <Button variant="outline" onClick={handleNtpSync}>NTP 同步</Button>
            </div>
            {serverTimeMsg && <p className="text-sm text-slate-600">{serverTimeMsg}</p>}
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold mb-4">使用者管理 ({users.length} 位)</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>電子郵件</TableHead>
                <TableHead>顯示名稱</TableHead>
                <TableHead>登入方式</TableHead>
                <TableHead>管理員</TableHead>
                <TableHead>建立時間</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{user.displayName || '—'}</TableCell>
                  <TableCell>{[user.hasPassword ? '密碼' : null, user.googleId ? 'Google' : null, user.lineId ? 'LINE' : null].filter(Boolean).join(' + ') || '—'}</TableCell>
                  <TableCell>{user.isAdmin ? '是' : '否'}</TableCell>
                  <TableCell>{user.createdAt ? new Date(user.createdAt).toLocaleString('zh-TW') : '—'}</TableCell>
                  <TableCell className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={() => handleResetPassword(user.id)}>重設密碼</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleToggleAdmin(user.id)}>{user.isAdmin ? '撤銷管理員' : '設為管理員'}</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteUser(user.id)}>刪除</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {activeTab === 'schedules' && (
        <div className="space-y-6">
          <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
            <h3 className="text-lg font-semibold mb-4">新增報表排程</h3>
            <form onSubmit={handleCreateSchedule} className="grid md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">使用者</label>
                <select className="w-full p-2 border rounded-md" value={scheduleForm.userId} onChange={(e) => setScheduleForm((prev) => ({ ...prev, userId: e.target.value }))}>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">頻率</label>
                <select className="w-full p-2 border rounded-md" value={scheduleForm.freq} onChange={(e) => setScheduleForm((prev) => ({ ...prev, freq: e.target.value }))}>
                  {SCHEDULE_FREQ_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <Input label="小時" type="number" min={0} max={23} value={scheduleForm.hour} onChange={(e) => setScheduleForm((prev) => ({ ...prev, hour: e.target.value }))} />
              <Input label="分鐘" type="number" min={0} max={59} value={scheduleForm.minute} onChange={(e) => setScheduleForm((prev) => ({ ...prev, minute: e.target.value }))} />
              <Button type="submit" className="self-end">新增排程</Button>
              {scheduleForm.freq === 'weekly' && <Input label="每週星期 (0-6)" type="number" min={0} max={6} value={scheduleForm.weekday} onChange={(e) => setScheduleForm((prev) => ({ ...prev, weekday: e.target.value }))} />}
              {scheduleForm.freq === 'monthly' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">每月日期</label>
                  <select className="w-full p-2 border rounded-md" value={scheduleForm.dayOfMonth} onChange={(e) => setScheduleForm((prev) => ({ ...prev, dayOfMonth: e.target.value }))}>
                    {DAY_OF_MONTH_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
              )}
              <div className="md:col-span-4 flex flex-wrap gap-4 text-sm text-slate-700">
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={scheduleForm.notifyEmail} onChange={(e) => setScheduleForm((prev) => ({ ...prev, notifyEmail: e.target.checked }))} />
                  Email 通知
                </label>
                <label className="inline-flex items-center gap-2">
                  <input type="checkbox" checked={scheduleForm.notifyLine} onChange={(e) => setScheduleForm((prev) => ({ ...prev, notifyLine: e.target.checked }))} />
                  LINE 通知
                </label>
              </div>
            </form>
            {scheduleMsg && <p className="text-sm text-slate-600 mt-3">{scheduleMsg}</p>}
          </div>

          <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
            <h3 className="text-lg font-semibold mb-4">排程列表</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>使用者</TableHead>
                  <TableHead>頻率</TableHead>
                  <TableHead>時間</TableHead>
                  <TableHead>通知</TableHead>
                  <TableHead>上次執行</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell>{users.find((user) => user.id === schedule.userId)?.email || schedule.userId}</TableCell>
                    <TableCell>{schedule.freq}</TableCell>
                    <TableCell>{fmtScheduleTime(schedule)}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className={`rounded border px-2 py-1 text-xs ${schedule.notifyEmail ? 'border-blue-500 text-blue-700' : 'border-slate-200 text-slate-400'}`} onClick={() => handleToggleScheduleChannel(schedule.id, 'notifyEmail', schedule.notifyEmail)}>Email</button>
                        <button type="button" className={`rounded border px-2 py-1 text-xs ${schedule.notifyLine ? 'border-green-500 text-green-700' : 'border-slate-200 text-slate-400'}`} onClick={() => handleToggleScheduleChannel(schedule.id, 'notifyLine', schedule.notifyLine)}>LINE</button>
                      </div>
                    </TableCell>
                    <TableCell>{fmtTs(schedule.lastRun)}</TableCell>
                    <TableCell>{schedule.enabled ? '啟用中' : '停用'}</TableCell>
                    <TableCell className="flex gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => handleToggleSchedule(schedule.id, schedule.enabled)}>{schedule.enabled ? '停用' : '啟用'}</Button>
                      <Button variant="outline" size="sm" onClick={() => handleRunScheduleNow(schedule.id)}>立即執行</Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteSchedule(schedule.id)}>刪除</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
            <h3 className="text-lg font-semibold mb-4">LINE 支出提醒</h3>
            <form onSubmit={handleCreateExpenseReminder} className="grid md:grid-cols-4 gap-4 mb-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">使用者</label>
                <select className="w-full p-2 border rounded-md" value={expenseReminderForm.userId} onChange={(e) => setExpenseReminderForm((prev) => ({ ...prev, userId: e.target.value }))}>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.email}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">頻率</label>
                <select className="w-full p-2 border rounded-md" value={expenseReminderForm.freq} onChange={(e) => setExpenseReminderForm((prev) => ({ ...prev, freq: e.target.value }))}>
                  {SCHEDULE_FREQ_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <Input label="小時" type="number" min={0} max={23} value={expenseReminderForm.hour} onChange={(e) => setExpenseReminderForm((prev) => ({ ...prev, hour: e.target.value }))} />
              <Input label="分鐘" type="number" min={0} max={59} value={expenseReminderForm.minute} onChange={(e) => setExpenseReminderForm((prev) => ({ ...prev, minute: e.target.value }))} />
              <Button type="submit" className="self-end">新增 LINE 提醒</Button>
              {expenseReminderForm.freq === 'weekly' && <Input label="每週星期 (0-6)" type="number" min={0} max={6} value={expenseReminderForm.weekday} onChange={(e) => setExpenseReminderForm((prev) => ({ ...prev, weekday: e.target.value }))} />}
              {expenseReminderForm.freq === 'monthly' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">每月日期</label>
                  <select className="w-full p-2 border rounded-md" value={expenseReminderForm.dayOfMonth} onChange={(e) => setExpenseReminderForm((prev) => ({ ...prev, dayOfMonth: e.target.value }))}>
                    {DAY_OF_MONTH_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                </div>
              )}
            </form>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>使用者</TableHead>
                  <TableHead>頻率</TableHead>
                  <TableHead>時間</TableHead>
                  <TableHead>上次提醒</TableHead>
                  <TableHead>狀態</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenseReminders.map((reminder) => (
                  <TableRow key={reminder.id}>
                    <TableCell>{users.find((user) => user.id === reminder.userId)?.email || reminder.userId}</TableCell>
                    <TableCell>{reminder.freq}</TableCell>
                    <TableCell>{fmtScheduleTime(reminder)}</TableCell>
                    <TableCell>{fmtTs(reminder.lastRun)}</TableCell>
                    <TableCell>{reminder.enabled ? '啟用中' : '停用'}</TableCell>
                    <TableCell className="flex gap-2 flex-wrap">
                      <Button variant="outline" size="sm" onClick={() => handleToggleExpenseReminder(reminder.id, reminder.enabled)}>{reminder.enabled ? '停用' : '啟用'}</Button>
                      <Button variant="outline" size="sm" onClick={() => handleRunExpenseReminderNow(reminder.id)}>立即提醒</Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteExpenseReminder(reminder.id)}>刪除</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {activeTab === 'email' && (
        <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm space-y-4">
          <h3 className="text-lg font-semibold">寄信通道</h3>
          {emailProviders && (
            <div className="grid md:grid-cols-2 gap-4 text-sm text-slate-700">
              <div>主要通道：{emailProviders.primary || '未設定'}</div>
              <div>備援通道：{emailProviders.fallback || '未設定'}</div>
              <div>SMTP：{emailProviders.configured?.smtp ? '已設定' : '未設定'}</div>
              <div>Zeabur：{emailProviders.configured?.zeabur ? '已設定' : '未設定'}</div>
              <div>Resend：{emailProviders.configured?.resend ? '已設定' : '未設定'}</div>
            </div>
          )}
          <Button onClick={handleSendTestEmail}>寄送測試信</Button>
          {emailMsg && <p className="text-sm text-slate-600">{emailMsg}</p>}
        </div>
      )}

      {activeTab === 'loginAudit' && (
        <div className="space-y-6">
          <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">管理員本人登入紀錄</h3>
              <Button variant="outline" size="sm" onClick={load}>重新整理</Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>登入時間</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>國家</TableHead>
                  <TableHead>方式</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminSelfLogs.map((log, index) => (
                  <TableRow key={`${log.loginAt}-${index}`}>
                    <TableCell>{fmtTs(log.loginAt)}</TableCell>
                    <TableCell>{log.ipAddress}</TableCell>
                    <TableCell>{log.country}</TableCell>
                    <TableCell>{log.loginMethod}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">全部使用者登入紀錄</h3>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportLoginLogs}>匯出 CSV</Button>
                <Button variant="destructive" size="sm" onClick={handleDeleteSelectedLogs} disabled={selectedLogIds.length === 0}>刪除選取</Button>
              </div>
            </div>
            {logMsg && <p className="text-sm text-slate-600 mb-3">{logMsg}</p>}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead></TableHead>
                  <TableHead>登入時間</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>顯示名稱</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>國家</TableHead>
                  <TableHead>方式</TableHead>
                  <TableHead>結果</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <input
                        type="checkbox"
                        checked={selectedLogIds.includes(log.id)}
                        onChange={(e) => setSelectedLogIds((prev) => e.target.checked ? [...prev, log.id] : prev.filter((id) => id !== log.id))}
                      />
                    </TableCell>
                    <TableCell>{fmtTs(log.loginAt)}</TableCell>
                    <TableCell>{log.email || '—'}</TableCell>
                    <TableCell>{log.displayName || '—'}</TableCell>
                    <TableCell>{log.ipAddress}</TableCell>
                    <TableCell>{log.country}</TableCell>
                    <TableCell>{log.loginMethod}</TableCell>
                    <TableCell>{log.isSuccess ? '成功' : `失敗${log.failureReason ? ` (${log.failureReason})` : ''}`}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteSingleLog(log.id)}>刪除</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {activeTab === 'dataAudit' && (
        <div className="space-y-6">
          <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm space-y-4">
            <h3 className="text-lg font-semibold">資料稽核設定</h3>
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">保留天數</label>
                <select className="w-40 p-2 border rounded-md" value={auditRetention} onChange={(e) => setAuditRetention(e.target.value)}>
                  {RETENTION_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                </select>
              </div>
              <Button variant="outline" onClick={handleSaveRetention}>儲存保留設定</Button>
              <Button variant="outline" onClick={handleExportAudit}>匯出 CSV</Button>
              <Button variant="destructive" onClick={handlePurgeAudit}>清空稽核日誌</Button>
            </div>
            {auditMsg && <p className="text-sm text-slate-600">{auditMsg}</p>}
          </div>

          <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">資料稽核紀錄</h3>
              <span className="text-sm text-slate-500">共 {auditTotal} 筆</span>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>時間</TableHead>
                  <TableHead>使用者信箱</TableHead>
                  <TableHead>動作</TableHead>
                  <TableHead>結果</TableHead>
                  <TableHead>角色</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{fmtTs(log.timestamp)}</TableCell>
                    <TableCell>{getAuditUserEmail(log, users)}</TableCell>
                    <TableCell>{formatAuditAction(log.action)}</TableCell>
                    <TableCell>{formatAuditResult(log.result)}</TableCell>
                    <TableCell>{log.role}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {activeTab === 'certs' && (
        <div className="space-y-6">
          <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm space-y-4">
            <h3 className="text-lg font-semibold">Origin CA</h3>
            <div className="text-sm text-slate-600">
              {certInfo?.originCa ? `有效期間：${certInfo.originCa.validFrom} ~ ${certInfo.originCa.validTo}` : '目前未部署 Origin CA'}
            </div>
            <textarea rows={6} value={originCaPem} onChange={(e) => setOriginCaPem(e.target.value)} className="w-full p-2 border rounded-md font-mono text-sm" placeholder="-----BEGIN CERTIFICATE-----" />
            <div className="flex gap-3">
              <Button onClick={handleSaveOriginCa}>部署 Origin CA</Button>
              <Button variant="destructive" onClick={handleDeleteOriginCa}>刪除 Origin CA</Button>
            </div>
          </div>

          <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm space-y-4">
            <h3 className="text-lg font-semibold">Origin Certificate / Key</h3>
            <div className="text-sm text-slate-600 space-y-1">
              <p>{certInfo?.originCert ? `憑證有效期間：${certInfo.originCert.validFrom} ~ ${certInfo.originCert.validTo}` : '目前未部署 Origin Certificate'}</p>
              <p>私鑰：{certInfo?.originKeyExists ? '已存在' : '不存在'}</p>
            </div>
            <textarea rows={6} value={originCertPem} onChange={(e) => setOriginCertPem(e.target.value)} className="w-full p-2 border rounded-md font-mono text-sm" placeholder="-----BEGIN CERTIFICATE-----" />
            <textarea rows={6} value={originKeyPem} onChange={(e) => setOriginKeyPem(e.target.value)} className="w-full p-2 border rounded-md font-mono text-sm" placeholder="-----BEGIN PRIVATE KEY-----" />
            <div className="flex gap-3">
              <Button onClick={handleSaveOriginCert}>部署 Origin Certificate / Key</Button>
              <Button variant="destructive" onClick={handleDeleteOriginCert}>刪除全部</Button>
            </div>
            {certMsg && <p className="text-sm text-slate-600">{certMsg}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
