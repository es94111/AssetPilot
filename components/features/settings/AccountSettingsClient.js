'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPut, apiPost, apiDelete } from '../../../lib/clientApi';

export default function AccountSettingsClient({ user: initialUser }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Change password
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  // Display name
  const [displayName, setDisplayName] = useState('');
  const [dnSaving, setDnSaving] = useState(false);
  const [dnMsg, setDnMsg] = useState('');

  // Theme
  const [themeMode, setThemeMode] = useState('system');
  const [themeSaving, setThemeSaving] = useState(false);

  // Passkeys
  const [passkeys, setPasskeys] = useState([]);
  const [pkLoading, setPkLoading] = useState(false);
  const [pkError, setPkError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/auth/me');
      const u = res.user || res;
      setProfile(u);
      setDisplayName(u.displayName || u.display_name || '');
      setThemeMode(u.themeMode || u.theme_mode || 'system');
    } catch (_) {}
    setLoading(false);
  }, []);

  const loadPasskeys = useCallback(async () => {
    setPkLoading(true);
    try {
      const res = await apiGet('/api/account/passkeys');
      setPasskeys(res.passkeys || []);
    } catch (_) {}
    setPkLoading(false);
  }, []);

  useEffect(() => { load(); loadPasskeys(); }, [load, loadPasskeys]);

  async function handleChangePw(e) {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    const isGoogleOnly = profile?.googleLinked && !profile?.hasPassword;
    if (!isGoogleOnly && !currentPw) { setPwError('請輸入目前密碼'); return; }
    if (!newPw) { setPwError('請輸入新密碼'); return; }
    if (newPw.length < 8) { setPwError('新密碼長度至少 8 字元'); return; }
    if (!/[A-Z]/.test(newPw) || !/[a-z]/.test(newPw) || !/\d/.test(newPw) || !/[^a-zA-Z0-9]/.test(newPw)) {
      setPwError('新密碼需包含大寫字母、小寫字母、數字與特殊符號'); return;
    }
    if (newPw !== confirmPw) { setPwError('兩次輸入的新密碼不一致'); return; }
    setPwSaving(true);
    try {
      await apiPut('/api/account/password', {
        currentPassword: isGoogleOnly ? undefined : currentPw,
        newPassword: newPw,
      });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setPwSuccess(isGoogleOnly ? '密碼已設定，現在可使用密碼登入' : '密碼已更新');
      await load();
    } catch (e) { setPwError(e.message || '更新密碼失敗'); }
    setPwSaving(false);
  }

  async function handleDisplayName(e) {
    e.preventDefault();
    if (!displayName.trim()) { setDnMsg('顯示名稱不可空白'); return; }
    setDnSaving(true);
    setDnMsg('');
    try {
      await apiPut('/api/account/display-name', { displayName: displayName.trim() });
      setDnMsg('顯示名稱已更新');
      await load();
    } catch (e) { setDnMsg(e.message || '更新失敗'); }
    setDnSaving(false);
  }

  async function handleTheme(mode) {
    setThemeMode(mode);
    setThemeSaving(true);
    try { await apiPut('/api/account/theme', { themeMode: mode }); } catch (_) {}
    setThemeSaving(false);
  }

  async function handleDeletePasskey(credId) {
    if (!confirm('確定要刪除此 Passkey 嗎？')) return;
    try {
      await apiDelete(`/api/account/passkey/${encodeURIComponent(credId)}`);
      await loadPasskeys();
    } catch (e) { alert(e.message); }
  }

  async function handleRegisterPasskey() {
    setPkError('');
    if (typeof window.PublicKeyCredential === 'undefined') {
      setPkError('此瀏覽器不支援 Passkey');
      return;
    }
    try {
      const { key, challenge } = await apiGet('/api/account/passkey/challenge');
      const credOpts = {
        challenge: Uint8Array.from(atob(challenge.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)),
        rp: { name: '記帳網頁' },
        user: {
          id: Uint8Array.from(key, c => c.charCodeAt(0)),
          name: profile?.email || 'user',
          displayName: profile?.displayName || profile?.email || 'user',
        },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
        authenticatorSelection: { userVerification: 'preferred' },
        timeout: 60000,
      };
      const cred = await navigator.credentials.create({ publicKey: credOpts });
      const deviceName = navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')
        ? 'iPhone/iPad' : navigator.userAgent.includes('Android') ? 'Android 裝置' : '電腦';
      await apiPost('/api/account/passkey/register', {
        id: cred.id,
        rawId: btoa(String.fromCharCode(...new Uint8Array(cred.rawId))),
        response: {
          clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(cred.response.clientDataJSON))),
          attestationObject: btoa(String.fromCharCode(...new Uint8Array(cred.response.attestationObject))),
        },
        type: cred.type,
        deviceName,
        key,
      });
      await loadPasskeys();
    } catch (e) { setPkError(e.message || 'Passkey 註冊失敗'); }
  }

  if (loading) return <div className="page active"><p className="empty-hint">載入中...</p></div>;

  const isGoogleOnly = profile?.googleLinked && !profile?.hasPassword;

  return (
    <div className="page active">
      <h2 className="page-title">帳號設定</h2>

      {/* Profile Info */}
      <div className="card settings-card" style={{ marginBottom: '1.5rem' }}>
        <h3>帳號資訊</h3>
        <div className="settings-info-row">
          <span className="settings-label">電子郵件</span>
          <span>{profile?.email || '—'}</span>
        </div>
        <div className="settings-info-row">
          <span className="settings-label">顯示名稱</span>
          <span>{profile?.displayName || profile?.display_name || '—'}</span>
        </div>
      </div>

      {/* Display Name */}
      <div className="card settings-card" style={{ marginBottom: '1.5rem' }}>
        <h3>修改顯示名稱</h3>
        <form onSubmit={handleDisplayName}>
          <div className="form-row">
            <label>顯示名稱</label>
            <input type="text" maxLength={50} value={displayName} onChange={e => setDisplayName(e.target.value)} />
          </div>
          {dnMsg && <p style={{ color: dnMsg.includes('失敗') ? 'var(--danger)' : 'var(--success)', margin: '0.5rem 0' }}>{dnMsg}</p>}
          <div className="modal-footer" style={{ paddingTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={dnSaving}>{dnSaving ? '儲存中...' : '更新名稱'}</button>
          </div>
        </form>
      </div>

      {/* Password */}
      <div className="card settings-card" style={{ marginBottom: '1.5rem' }}>
        <h3>{isGoogleOnly ? '設定本機密碼' : '修改密碼'}</h3>
        {isGoogleOnly && <p className="empty-hint" style={{ marginBottom: '0.75rem' }}>目前帳號僅支援 Google 登入。設定本機密碼後，即可使用電子信箱與密碼登入。</p>}
        <form onSubmit={handleChangePw}>
          {!isGoogleOnly && (
            <div className="form-row">
              <label>目前密碼</label>
              <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />
            </div>
          )}
          <div className="form-row">
            <label>新密碼</label>
            <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="至少8碼，含大小寫英文、數字、特殊符號" />
          </div>
          <div className="form-row">
            <label>確認新密碼</label>
            <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
          </div>
          {pwError && <div className="auth-error">{pwError}</div>}
          {pwSuccess && <p style={{ color: 'var(--success)', margin: '0.5rem 0' }}>{pwSuccess}</p>}
          <div className="modal-footer" style={{ paddingTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary" disabled={pwSaving}>{pwSaving ? '更新中...' : isGoogleOnly ? '設定密碼' : '更新密碼'}</button>
          </div>
        </form>
      </div>

      {/* Theme Mode */}
      <div className="card settings-card" style={{ marginBottom: '1.5rem' }}>
        <h3>顯示主題</h3>
        <div className="theme-options">
          {[['system', '跟隨系統'], ['light', '淺色模式'], ['dark', '深色模式']].map(([val, label]) => (
            <label key={val} className="theme-option" style={{ marginRight: '1.5rem', cursor: 'pointer' }}>
              <input
                type="radio"
                name="themeMode"
                value={val}
                checked={themeMode === val}
                onChange={() => handleTheme(val)}
              />
              {' '}{label}
            </label>
          ))}
        </div>
      </div>

      {/* Passkeys */}
      <div className="card settings-card">
        <h3>Passkey 管理</h3>
        {pkError && <div className="auth-error" style={{ marginBottom: '0.75rem' }}>{pkError}</div>}
        {pkLoading && <p className="empty-hint">載入中...</p>}
        {!pkLoading && passkeys.length === 0 && (
          <p className="empty-hint">尚未註冊任何 Passkey</p>
        )}
        {passkeys.map(pk => (
          <div key={pk.id} className="passkey-item">
            <div className="passkey-info">
              <i className="fas fa-key" style={{ color: 'var(--primary)', marginRight: 8 }} />
              <span className="passkey-name">{pk.deviceName || 'Passkey'}</span>
              <span className="passkey-date" style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: '0.85em' }}>{pk.createdAt || ''}</span>
            </div>
            <button className="btn-icon danger" title="刪除" onClick={() => handleDeletePasskey(pk.credId || pk.id)}>
              <i className="fas fa-trash" />
            </button>
          </div>
        ))}
        <div style={{ marginTop: '1rem' }}>
          <button className="btn btn-outline" onClick={handleRegisterPasskey}>
            <i className="fas fa-plus" /> 新增 Passkey
          </button>
        </div>
      </div>
    </div>
  );
}
