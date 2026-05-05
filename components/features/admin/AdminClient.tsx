'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPut, apiPost, apiDelete } from '@/lib/clientApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function AdminClient() {
  const [activeTab, setActiveTab] = useState('system');
  const [settings, setSettings] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // System settings form state
  const [publicRegistration, setPublicRegistration] = useState(false);
  const [allowedEmails, setAllowedEmails] = useState('');
  const [ipAllowlist, setIpAllowlist] = useState('');

  // Certs
  const [certInfo, setCertInfo] = useState<any>(null);
  const [certLoading, setCertLoading] = useState(false);

  // Report schedules
  const [schedules, setSchedules] = useState<any[]>([]);
  const [schLoading, setSchLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, u] = await Promise.all([
        apiGet('/api/admin/system-settings'),
        apiGet('/api/admin/users').catch(() => []),
      ]);
      setSettings(s);
      setPublicRegistration(!!s.publicRegistration);
      setAllowedEmails(Array.isArray(s.allowedRegistrationEmails) ? s.allowedRegistrationEmails.join('\n') : '');
      setIpAllowlist(Array.isArray(s.adminIpAllowlist) ? s.adminIpAllowlist.join('\n') : '');
      setUsers(u || []);
    } catch (e: any) {
      setSaveMsg('載入失敗：' + e.message);
    }
    setLoading(false);
  }, []);

  const loadCerts = useCallback(async () => {
    setCertLoading(true);
    try { const c = await apiGet('/api/admin/certs'); setCertInfo(c); } catch (_) {}
    setCertLoading(false);
  }, []);

  const loadSchedules = useCallback(async () => {
    setSchLoading(true);
    try {
      const s = await apiGet('/api/admin/report-schedules').catch(() => []);
      setSchedules(s || []);
    } catch (_) {}
    setSchLoading(false);
  }, []);

  useEffect(() => {
    load();
    loadCerts();
    loadSchedules();
  }, [load, loadCerts, loadSchedules]);

  async function saveSystemSettings(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    try {
      await apiPut('/api/admin/system-settings', {
        publicRegistration,
        allowedRegistrationEmails: allowedEmails.split('\n').map(s => s.trim()).filter(Boolean),
        adminIpAllowlist: ipAllowlist.split('\n').map(s => s.trim()).filter(Boolean),
      });
      setSaveMsg('設定已儲存');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch (e: any) { setSaveMsg('儲存失敗：' + e.message); }
    setSaving(false);
  }

  async function handleToggleAdmin(userId: string) {
    const u = users.find(u => u.id === userId);
    if (!u) return;
    try {
      await apiPut(`/api/admin/users/${userId}`, { isAdmin: !u.isAdmin });
      await load();
    } catch (e: any) { alert(e.message); }
  }

  async function handleDeleteUser(userId: string) {
    if (!confirm('確定要刪除此使用者嗎？其所有資料將一併刪除。')) return;
    try {
      await apiDelete(`/api/admin/users/${userId}`);
      await load();
    } catch (e: any) { alert(e.message); }
  }

  async function handleToggleSchedule(id: string, enabled: boolean) {
    try {
      await apiPut(`/api/admin/report-schedules/${id}`, { enabled: !enabled });
      await loadSchedules();
    } catch (e: any) { alert(e.message); }
  }

  async function handleDeleteSchedule(id: string) {
    if (!confirm('確定要刪除此排程嗎？')) return;
    try {
      await apiDelete(`/api/admin/report-schedules/${id}`);
      await loadSchedules();
    } catch (e: any) { alert(e.message); }
  }

  if (loading) return <div className="p-8 text-slate-500">載入中...</div>;

  const TABS = [
    { id: 'system', label: '系統設定' },
    { id: 'users', label: '使用者管理' },
    { id: 'schedules', label: '報表排程' },
    { id: 'certs', label: '憑證管理' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">管理員設定</h2>

      <div className="flex gap-2 border-b">
        {TABS.map(t => (
          <button key={t.id} className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === t.id ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'system' && (
        <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold mb-4">系統設定</h3>
          <form onSubmit={saveSystemSettings} className="space-y-4">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={publicRegistration} onChange={e => setPublicRegistration(e.target.checked)} className="w-4 h-4" />
              開放公開註冊
            </label>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">允許註冊的電子郵件（每行一筆）</label>
              <textarea rows={4} value={allowedEmails} onChange={e => setAllowedEmails(e.target.value)} className="w-full p-2 border rounded-md" placeholder="留空表示不限制" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">管理員 IP 白名單（每行一筆）</label>
              <textarea rows={3} value={ipAllowlist} onChange={e => setIpAllowlist(e.target.value)} className="w-full p-2 border rounded-md" placeholder="留空表示不限制" />
            </div>
            {saveMsg && <p className={`text-sm ${saveMsg.includes('失敗') ? 'text-red-500' : 'text-green-600'}`}>{saveMsg}</p>}
            <Button type="submit" disabled={saving}>{saving ? '儲存中...' : '儲存設定'}</Button>
          </form>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
          <h3 className="text-lg font-semibold mb-4">使用者管理 ({users.length} 位)</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>電子郵件</TableHead>
                <TableHead>顯示名稱</TableHead>
                <TableHead>管理員</TableHead>
                <TableHead>建立時間</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map(u => (
                <TableRow key={u.id}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.displayName || u.display_name || '—'}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs ${u.isAdmin ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {u.isAdmin ? '是' : '否'}
                    </span>
                  </TableCell>
                  <TableCell>{u.createdAt ? new Date(u.createdAt).toLocaleDateString('zh-TW') : '—'}</TableCell>
                  <TableCell className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => handleToggleAdmin(u.id)}>{u.isAdmin ? '撤銷' : '設為'}</Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(u.id)} className="text-red-600">刪除</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Report Schedules & Certs logic would go here similarly */}
      {activeTab === 'schedules' && <div className="p-6 bg-white border border-slate-200 rounded-xl">報表排程功能待進一步遷移...</div>}
      {activeTab === 'certs' && <div className="p-6 bg-white border border-slate-200 rounded-xl">憑證管理功能待進一步遷移...</div>}
    </div>
  );
}
