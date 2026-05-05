'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPut, apiPost, apiDelete } from '../../../lib/clientApi';

function fmt(n) { return 'NT$ ' + Math.round(Number(n) || 0).toLocaleString('zh-TW'); }

export default function AdminClient() {
  const [activeTab, setActiveTab] = useState('system');
  const [settings, setSettings] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // System settings form state
  const [publicRegistration, setPublicRegistration] = useState(false);
  const [allowedEmails, setAllowedEmails] = useState('');
  const [ipAllowlist, setIpAllowlist] = useState('');

  // Certs
  const [certInfo, setCertInfo] = useState(null);
  const [certLoading, setCertLoading] = useState(false);

  // Report schedules
  const [schedules, setSchedules] = useState([]);
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
    } catch (e) {
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

  async function saveSystemSettings(e) {
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
    } catch (e) { setSaveMsg('儲存失敗：' + e.message); }
    setSaving(false);
  }

  async function handleToggleAdmin(userId) {
    const u = users.find(u => u.id === userId);
    if (!u) return;
    try {
      await apiPut(`/api/admin/users/${userId}`, { isAdmin: !u.isAdmin });
      await load();
    } catch (e) { alert(e.message); }
  }

  async function handleDeleteUser(userId) {
    if (!confirm('確定要刪除此使用者嗎？其所有資料將一併刪除。')) return;
    try {
      await apiDelete(`/api/admin/users/${userId}`);
      await load();
    } catch (e) { alert(e.message); }
  }

  async function handleToggleSchedule(id, enabled) {
    try {
      await apiPut(`/api/admin/report-schedules/${id}`, { enabled: !enabled });
      await loadSchedules();
    } catch (e) { alert(e.message); }
  }

  async function handleDeleteSchedule(id) {
    if (!confirm('確定要刪除此排程嗎？')) return;
    try {
      await apiDelete(`/api/admin/report-schedules/${id}`);
      await loadSchedules();
    } catch (e) { alert(e.message); }
  }

  if (loading) return <div className="page active"><p className="empty-hint">載入中...</p></div>;

  const TABS = [
    { id: 'system', label: '系統設定' },
    { id: 'users', label: '使用者管理' },
    { id: 'schedules', label: '報表排程' },
    { id: 'certs', label: '憑證管理' },
  ];

  return (
    <div className="page active">
      <h2 className="page-title">管理員設定</h2>

      <div className="tab-bar" style={{ marginBottom: '1.5rem' }}>
        {TABS.map(t => (
          <button key={t.id} className={`tab ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {/* System Settings */}
      {activeTab === 'system' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>系統設定</h3>
          <form onSubmit={saveSystemSettings}>
            <div className="form-row form-row-checkbox">
              <label>
                <input type="checkbox" checked={publicRegistration} onChange={e => setPublicRegistration(e.target.checked)} />
                {' '}開放公開註冊
              </label>
            </div>
            <div className="form-row">
              <label>允許註冊的電子郵件（每行一筆）</label>
              <textarea rows={4} value={allowedEmails} onChange={e => setAllowedEmails(e.target.value)} style={{ width: '100%', resize: 'vertical' }} placeholder="留空表示不限制" />
            </div>
            <div className="form-row">
              <label>管理員 IP 白名單（每行一筆）</label>
              <textarea rows={3} value={ipAllowlist} onChange={e => setIpAllowlist(e.target.value)} style={{ width: '100%', resize: 'vertical' }} placeholder="留空表示不限制" />
            </div>
            {saveMsg && <p style={{ color: saveMsg.includes('失敗') ? 'var(--danger)' : 'var(--success)', margin: '0.5rem 0' }}>{saveMsg}</p>}
            <div className="modal-footer" style={{ paddingTop: '0.5rem' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '儲存中...' : '儲存設定'}</button>
            </div>
          </form>
        </div>
      )}

      {/* Users */}
      {activeTab === 'users' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>使用者管理 ({users.length} 位)</h3>
          {users.length === 0 && <p className="empty-hint">無使用者</p>}
          {users.length > 0 && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>電子郵件</th><th>顯示名稱</th><th>管理員</th><th>建立時間</th><th>操作</th></tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id}>
                      <td>{u.email}</td>
                      <td>{u.displayName || u.display_name || '—'}</td>
                      <td>
                        <span className={`badge ${u.isAdmin ? 'badge-income' : ''}`}>{u.isAdmin ? '是' : '否'}</span>
                      </td>
                      <td>{u.createdAt ? new Date(u.createdAt).toLocaleDateString('zh-TW') : '—'}</td>
                      <td>
                        <button className="btn btn-sm btn-ghost" onClick={() => handleToggleAdmin(u.id)} style={{ marginRight: 4 }}>
                          {u.isAdmin ? '撤銷管理員' : '設為管理員'}
                        </button>
                        <button className="btn-icon danger" title="刪除" onClick={() => handleDeleteUser(u.id)}>
                          <i className="fas fa-trash" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Report Schedules */}
      {activeTab === 'schedules' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>報表排程</h3>
          {schLoading && <p className="empty-hint">載入中...</p>}
          {!schLoading && schedules.length === 0 && <p className="empty-hint">尚無報表排程</p>}
          {!schLoading && schedules.length > 0 && (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>使用者</th><th>頻率</th><th>時間</th><th>狀態</th><th>操作</th></tr>
                </thead>
                <tbody>
                  {schedules.map(s => {
                    const u = users.find(u => u.id === s.userId);
                    return (
                      <tr key={s.id}>
                        <td>{u ? (u.email || u.displayName) : s.userId}</td>
                        <td>{{ daily: '每日', weekly: '每週', monthly: '每月' }[s.freq] || s.freq}</td>
                        <td>{s.hour != null ? `${s.hour}:00` : '—'}</td>
                        <td><span className={`recurring-status ${s.enabled ? 'active' : 'paused'}`}>{s.enabled ? '啟用' : '停用'}</span></td>
                        <td>
                          <button className="btn-icon" title={s.enabled ? '停用' : '啟用'} onClick={() => handleToggleSchedule(s.id, s.enabled)}>
                            <i className={`fas ${s.enabled ? 'fa-pause' : 'fa-play'}`} />
                          </button>
                          <button className="btn-icon danger" title="刪除" onClick={() => handleDeleteSchedule(s.id)}>
                            <i className="fas fa-trash" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Certs */}
      {activeTab === 'certs' && (
        <div className="card">
          <h3 style={{ marginBottom: '1rem' }}>憑證管理</h3>
          {certLoading && <p className="empty-hint">載入中...</p>}
          {!certLoading && certInfo && (
            <div>
              <div className="settings-info-row">
                <span className="settings-label">來源網域</span>
                <span>{certInfo.originDomain || '未設定'}</span>
              </div>
              {certInfo.cert && (
                <>
                  <div className="settings-info-row">
                    <span className="settings-label">有效期至</span>
                    <span>{certInfo.cert.notAfter || '—'}</span>
                  </div>
                  <div className="settings-info-row">
                    <span className="settings-label">簽發者</span>
                    <span>{certInfo.cert.issuer || '—'}</span>
                  </div>
                </>
              )}
              {!certInfo.cert && <p className="empty-hint">尚未設定 TLS 憑證</p>}
            </div>
          )}
          {!certLoading && !certInfo && <p className="empty-hint">無法載入憑證資訊</p>}
        </div>
      )}
    </div>
  );
}
