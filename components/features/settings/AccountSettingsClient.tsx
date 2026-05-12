'use client';

import { useState, useEffect, useCallback } from 'react';
import { client as webauthnClient } from '@passwordless-id/webauthn';
import { apiGet, apiPut, apiPost, apiDelete } from '@/lib/clientApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';

export default function AccountSettingsClient({ user: initialUser }: { user: any }) {
  const [profile, setProfile] = useState<any>(initialUser || null);
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
  const [defaultCurrency, setDefaultCurrency] = useState('TWD');
  const [currencySaving, setCurrencySaving] = useState(false);
  const [currencyMsg, setCurrencyMsg] = useState('');

  // Passkeys
  const [passkeys, setPasskeys] = useState<any[]>([]);
  const [pkLoading, setPkLoading] = useState(false);
  const [pkError, setPkError] = useState('');

  const [loginAudit, setLoginAudit] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsMsg, setSessionsMsg] = useState('');
  const [googleMsg, setGoogleMsg] = useState('');
  const [lineMsg, setLineMsg] = useState('');
  const [lineLoading, setLineLoading] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/auth/me');
      const u = res.user || res;
      setProfile(u);
      setDisplayName(u.displayName || u.display_name || '');
      setThemeMode(u.themeMode || u.theme_mode || 'system');
      setDefaultCurrency(String(u.defaultCurrency || u.default_currency || 'TWD').toUpperCase());
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

  const loadLoginAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const res = await apiGet('/api/user/login-audit');
      setLoginAudit(res.logs || []);
    } catch (_) {}
    setAuditLoading(false);
  }, []);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const res = await apiGet('/api/account/sessions');
      setSessions(res.sessions || []);
    } catch (_) {}
    setSessionsLoading(false);
  }, []);

  useEffect(() => { load(); loadPasskeys(); loadSessions(); loadLoginAudit(); }, [load, loadPasskeys, loadSessions, loadLoginAudit]);

  async function handleChangePw(e: React.FormEvent) {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');
    const oauthOnly = (profile?.googleLinked || profile?.lineLinked) && !profile?.hasPassword;
    if (!oauthOnly && !currentPw) { setPwError('請輸入目前密碼'); return; }
    if (!newPw) { setPwError('請輸入新密碼'); return; }
    if (newPw.length < 8) { setPwError('新密碼長度至少 8 字元'); return; }
    if (!/[A-Z]/.test(newPw) || !/[a-z]/.test(newPw) || !/\d/.test(newPw) || !/[^a-zA-Z0-9]/.test(newPw)) {
      setPwError('新密碼需包含大寫字母、小寫字母、數字與特殊符號'); return;
    }
    if (newPw !== confirmPw) { setPwError('兩次輸入的新密碼不一致'); return; }
    setPwSaving(true);
    try {
      await apiPut('/api/account/password', {
        currentPassword: oauthOnly ? undefined : currentPw,
        newPassword: newPw,
      });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setPwSuccess(oauthOnly ? '密碼已設定，現在可使用密碼登入' : '密碼已更新');
      await load();
    } catch (e: any) { setPwError(e.message || '更新密碼失敗'); }
    setPwSaving(false);
  }

  async function handleDisplayName(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) { setDnMsg('顯示名稱不可空白'); return; }
    setDnSaving(true);
    setDnMsg('');
    try {
      await apiPut('/api/account/display-name', { displayName: displayName.trim() });
      setDnMsg('顯示名稱已更新');
      await load();
    } catch (e: any) { setDnMsg(e.message || '更新失敗'); }
    setDnSaving(false);
  }

  async function handleTheme(mode: string) {
    setThemeMode(mode);
    setThemeSaving(true);
    try { await apiPut('/api/account/theme', { themeMode: mode }); } catch (_) {}
    setThemeSaving(false);
  }

  async function handleDeletePasskey(credId: string) {
    if (!confirm('確定要刪除此 Passkey 嗎？')) return;
    try {
      await apiDelete(`/api/account/passkey/${encodeURIComponent(credId)}`);
      await loadPasskeys();
    } catch (e: any) { alert(e.message); }
  }

  async function handleDefaultCurrency(e: React.FormEvent) {
    e.preventDefault();
    const currency = defaultCurrency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      setCurrencyMsg('幣別格式需為 3 碼英文字母');
      return;
    }
    setCurrencySaving(true);
    setCurrencyMsg('');
    try {
      const res = await apiPut('/api/user/settings/default-currency', { defaultCurrency: currency });
      setDefaultCurrency(res.defaultCurrency || currency);
      setCurrencyMsg('預設貨幣已更新');
      await load();
    } catch (e: any) {
      setCurrencyMsg(e.message || '更新預設貨幣失敗');
    }
    setCurrencySaving(false);
  }

  async function handleLogoutSession(sessionId: string, isCurrent: boolean) {
    setSessionsMsg('');
    try {
      await apiDelete(`/api/account/sessions/${encodeURIComponent(sessionId)}`);
      if (isCurrent) {
        window.location.href = '/login';
        return;
      }
      setSessionsMsg('已登出該裝置');
      await loadSessions();
    } catch (e: any) {
      setSessionsMsg(e.message || '登出裝置失敗');
    }
  }

  async function handleRegisterPasskey() {
    setPkError('');
    if (!webauthnClient.isAvailable()) {
      setPkError('此瀏覽器不支援 Passkey');
      return;
    }
    try {
      const { key, challenge } = await apiGet('/api/account/passkey/challenge') as { key: string; challenge: string };
      const deviceName = navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')
        ? 'iPhone/iPad' : navigator.userAgent.includes('Android') ? 'Android 裝置' : '電腦';

      const registration = await webauthnClient.register({
        challenge,
        user: {
          id: profile?.id || key,
          name: profile?.email || 'user',
          displayName: profile?.displayName || profile?.display_name || profile?.email || 'user',
        },
        userVerification: 'required',
        discoverable: 'preferred',
        timeout: 60000,
      });

      await apiPost('/api/account/passkey/register', {
        registration,
        deviceName,
        challengeKey: key,
      });
      await loadPasskeys();
    } catch (e: any) { setPkError(e.message || 'Passkey 註冊失敗'); }
  }

  async function handleLinkGoogle() {
    setGoogleMsg('');
    const credential = window.prompt('請貼上 Google ID Token 以模擬綁定流程');
    if (!credential) return;
    try {
      await apiPost('/api/account/link-google', { credential });
      setGoogleMsg('Google 帳號已綁定');
      await load();
    } catch (e: any) {
      setGoogleMsg(e.message || 'Google 綁定失敗');
    }
  }

  async function handleUnlinkGoogle() {
    setGoogleMsg('');
    try {
      await apiDelete('/api/account/settings/google');
      setGoogleMsg('Google 帳號已解除綁定');
      await load();
    } catch (e: any) {
      setGoogleMsg(e.message || 'Google 解除綁定失敗');
    }
  }

  async function handleLinkLine() {
    setLineMsg('');
    setLineLoading(true);
    try {
      const cfgRes = await fetch('/api/config', { cache: 'no-store' });
      const cfg = await cfgRes.json().catch(() => ({}));
      if (!cfg?.lineChannelId || !cfg?.lineCodeFlow) throw new Error('LINE 登入尚未設定完成');
      const stateRes = await fetch('/api/auth/line/state?flow=link', { cache: 'no-store' });
      const { state, nonce } = await stateRes.json().catch(() => ({}));
      if (!state || !nonce) throw new Error('無法建立 LINE 綁定狀態');
      const redirectUri = `${window.location.origin}/auth/line/callback`;
      const authorizeUrl = new URL('https://access.line.me/oauth2/v2.1/authorize');
      authorizeUrl.searchParams.set('response_type', 'code');
      authorizeUrl.searchParams.set('client_id', cfg.lineChannelId);
      authorizeUrl.searchParams.set('redirect_uri', redirectUri);
      authorizeUrl.searchParams.set('state', state);
      authorizeUrl.searchParams.set('scope', 'openid profile email');
      authorizeUrl.searchParams.set('nonce', nonce);
      window.location.href = authorizeUrl.toString();
    } catch (e: any) {
      setLineMsg(e.message || 'LINE 綁定失敗');
      setLineLoading(false);
    }
  }

  async function handleUnlinkLine() {
    setLineMsg('');
    try {
      await apiDelete('/api/account/settings/line');
      setLineMsg('LINE 帳號已解除綁定');
      await load();
    } catch (e: any) {
      setLineMsg(e.message || 'LINE 解除綁定失敗');
    }
  }

  async function handleDeleteAccount() {
    setDeleteMsg('');
    const password = window.prompt('輸入密碼以刪除帳號');
    if (password == null) return;
    try {
      const res = await fetch('/api/account/settings/delete', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setDeleteMsg('帳號已刪除');
      window.location.href = '/';
    } catch (e: any) {
      setDeleteMsg(e.message || '刪除帳號失敗');
    }
  }

  if (loading) return <div className="p-8 text-slate-500">載入中...</div>;

  const isOAuthOnly = (profile?.googleLinked || profile?.lineLinked) && !profile?.hasPassword;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">帳號設定</h2>

      {/* Profile Info */}
      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold mb-4">帳號資訊</h3>
        <div className="flex gap-4 mb-2"><span className="text-slate-600 w-24">電子郵件</span><span className="font-medium">{profile?.email || '—'}</span></div>
        <div className="flex gap-4"><span className="text-slate-600 w-24">顯示名稱</span><span className="font-medium">{profile?.displayName || profile?.display_name || '—'}</span></div>
      </div>

      {/* Display Name */}
      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold mb-4">修改顯示名稱</h3>
        <form onSubmit={handleDisplayName}>
          <Input label="顯示名稱" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={50} />
          {dnMsg && <p className={`text-sm mt-2 ${dnMsg.includes('失敗') ? 'text-red-500' : 'text-green-600'}`}>{dnMsg}</p>}
          <Button type="submit" className="mt-4" disabled={dnSaving}>{dnSaving ? '儲存中...' : '更新名稱'}</Button>
        </form>
      </div>

      {/* Password */}
      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold mb-4">{isOAuthOnly ? '設定本機密碼' : '修改密碼'}</h3>
        {isOAuthOnly && <p className="text-sm text-slate-500 mb-4">目前帳號僅支援第三方登入。設定本機密碼後，即可使用電子信箱與密碼登入。</p>}
        <form onSubmit={handleChangePw} className="space-y-4">
          {!isOAuthOnly && <Input label="目前密碼" type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />}
          <Input label="新密碼" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="至少8碼，含大小寫英文、數字、特殊符號" />
          <Input label="確認新密碼" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
          {pwError && <div className="text-red-500 text-sm">{pwError}</div>}
          {pwSuccess && <p className="text-green-600 text-sm">{pwSuccess}</p>}
          <Button type="submit" disabled={pwSaving}>{pwSaving ? '更新中...' : isOAuthOnly ? '設定密碼' : '更新密碼'}</Button>
        </form>
      </div>

      {/* Theme Mode */}
      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold mb-4">顯示主題</h3>
        <div className="flex gap-4">
          {[['system', '跟隨系統'], ['light', '淺色模式'], ['dark', '深色模式']].map(([val, label]) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="themeMode" value={val} checked={themeMode === val} onChange={() => handleTheme(val)} className="w-4 h-4" />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold mb-4">預設貨幣</h3>
        <form onSubmit={handleDefaultCurrency} className="space-y-3 max-w-xs">
          <Input label="幣別代碼" value={defaultCurrency} onChange={e => setDefaultCurrency(e.target.value.toUpperCase())} maxLength={3} placeholder="TWD" />
          {currencyMsg && <p className={`text-sm ${currencyMsg.includes('失敗') || currencyMsg.includes('格式') ? 'text-red-500' : 'text-green-600'}`}>{currencyMsg}</p>}
          <Button type="submit" disabled={currencySaving}>{currencySaving ? '儲存中...' : '更新預設貨幣'}</Button>
        </form>
      </div>

      {/* Passkeys */}
      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Passkey 管理</h3>
        {pkError && <div className="text-red-500 text-sm mb-4">{pkError}</div>}
        {pkLoading && <p className="text-slate-500">載入中...</p>}
        {!pkLoading && passkeys.length === 0 && <p className="text-slate-500 text-sm">尚未註冊任何 Passkey</p>}
        <div className="space-y-2">
          {passkeys.map((pk: any) => (
            <div key={pk.id} className="flex items-center justify-between p-3 border rounded-md">
              <span className="font-medium text-sm">{pk.deviceName || 'Passkey'}</span>
              <Button variant="ghost" size="icon" onClick={() => handleDeletePasskey(pk.credId || pk.id)} className="text-red-500 hover:text-red-700">✕</Button>
            </div>
          ))}
        </div>
        <Button className="mt-4" onClick={handleRegisterPasskey}>+ 新增 Passkey</Button>
      </div>

      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold mb-4">Google 綁定</h3>
        <p className="text-sm text-slate-500 mb-4">目前狀態：{profile?.googleLinked ? '已綁定 Google 帳號' : '尚未綁定 Google 帳號'}</p>
        <div className="flex gap-3 flex-wrap">
          {!profile?.googleLinked && <Button onClick={handleLinkGoogle}>綁定 Google 帳號</Button>}
          {profile?.googleLinked && <Button variant="outline" onClick={handleUnlinkGoogle}>解除綁定</Button>}
        </div>
        {googleMsg && <p className="text-sm text-slate-600 mt-3">{googleMsg}</p>}
      </div>

      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold mb-4">LINE 綁定</h3>
        <p className="text-sm text-slate-500 mb-4">目前狀態：{profile?.lineLinked ? '已綁定 LINE 帳號' : '尚未綁定 LINE 帳號'}</p>
        <div className="flex gap-3 flex-wrap">
          {!profile?.lineLinked && <Button onClick={handleLinkLine} disabled={lineLoading}>{lineLoading ? 'LINE 驗證中…' : '綁定 LINE 帳號'}</Button>}
          {profile?.lineLinked && <Button variant="outline" onClick={handleUnlinkLine}>解除綁定</Button>}
        </div>
        {lineMsg && <p className="text-sm text-slate-600 mt-3">{lineMsg}</p>}
      </div>

      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">目前登入裝置</h3>
          <Button variant="outline" onClick={loadSessions}>重新整理</Button>
        </div>
        {sessionsMsg && <p className={`text-sm mb-3 ${sessionsMsg.includes('失敗') ? 'text-red-500' : 'text-green-600'}`}>{sessionsMsg}</p>}
        {sessionsLoading ? <p className="text-slate-500">載入中...</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="text-left py-2 pr-4">裝置名稱</th>
                  <th className="text-left py-2 pr-4">登入時間</th>
                  <th className="text-left py-2 pr-4">登入 IP</th>
                  <th className="text-left py-2">操作</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session: any) => (
                  <tr key={session.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{session.deviceName || '未知裝置'}{session.isCurrent ? '（目前裝置）' : ''}</td>
                    <td className="py-3 pr-4">{new Date(Number(session.loginAt) || 0).toLocaleString('zh-TW')}</td>
                    <td className="py-3 pr-4">{session.ipAddress || 'unknown'}</td>
                    <td className="py-3">
                      <Button variant="outline" onClick={() => handleLogoutSession(session.id, !!session.isCurrent)}>登出</Button>
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-3 text-slate-500">尚無登入裝置紀錄</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">登入稽核紀錄</h3>
          <Button variant="outline" onClick={loadLoginAudit}>重新整理</Button>
        </div>
        {auditLoading ? <p className="text-slate-500">載入中...</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="text-left py-2 pr-4">登入時間</th>
                  <th className="text-left py-2 pr-4">IP</th>
                  <th className="text-left py-2 pr-4">國家</th>
                  <th className="text-left py-2 pr-4">方式</th>
                  <th className="text-left py-2">管理員登入</th>
                </tr>
              </thead>
              <tbody>
                {loginAudit.map((log, index) => (
                  <tr key={`${log.loginAt}-${index}`} className="border-b last:border-0">
                    <td className="py-3 pr-4">{new Date(Number(log.loginAt) || 0).toLocaleString('zh-TW')}</td>
                    <td className="py-3 pr-4">{log.ipAddress}</td>
                    <td className="py-3 pr-4">{log.country}</td>
                    <td className="py-3 pr-4">{log.loginMethod}</td>
                    <td className="py-3">{log.isAdminLogin ? '是' : '否'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="p-6 bg-white border border-red-200 dark:bg-slate-900 dark:border-red-900/50 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold text-red-600 mb-4">刪除帳號</h3>
        <p className="text-sm text-slate-600 mb-4">刪除帳號後，您的交易、帳戶、股票、Passkey 與設定資料都會永久移除。</p>
        <Button variant="destructive" onClick={handleDeleteAccount}>刪除我的帳號</Button>
        {deleteMsg && <p className="text-sm text-slate-600 mt-3">{deleteMsg}</p>}
      </div>
    </div>
  );
}
