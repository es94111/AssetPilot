'use client';

import { useState, useEffect, useCallback } from 'react';
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

  // Passkeys
  const [passkeys, setPasskeys] = useState<any[]>([]);
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

  async function handleChangePw(e: React.FormEvent) {
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

  async function handleRegisterPasskey() {
    setPkError('');
    if (typeof window.PublicKeyCredential === 'undefined') {
      setPkError('此瀏覽器不支援 Passkey');
      return;
    }
    try {
      const { key, challenge } = await apiGet('/api/account/passkey/challenge') as { key: string; challenge: string };
      const credOpts = {
        challenge: Uint8Array.from(atob(challenge.replace(/-/g, '+').replace(/_/g, '/')), (c: string) => c.charCodeAt(0)),
        rp: { name: '記帳網頁' },
        user: {
          id: Uint8Array.from(key, (c: string) => c.charCodeAt(0)),
          name: profile?.email || 'user',
          displayName: profile?.displayName || profile?.email || 'user',
        },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }, { alg: -257, type: 'public-key' }],
        authenticatorSelection: { userVerification: 'preferred' },
        timeout: 60000,
      };
      const cred = await navigator.credentials.create({ publicKey: credOpts }) as PublicKeyCredential;
      const deviceName = navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')
        ? 'iPhone/iPad' : navigator.userAgent.includes('Android') ? 'Android 裝置' : '電腦';
      
      const response = cred.response as AuthenticatorAttestationResponse;
      
      await apiPost('/api/account/passkey/register', {
        id: cred.id,
        rawId: btoa(String.fromCharCode(...new Uint8Array(cred.rawId))),
        response: {
          clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(response.clientDataJSON))),
          attestationObject: btoa(String.fromCharCode(...new Uint8Array(response.attestationObject))),
        },
        type: cred.type,
        deviceName,
        key,
      });
      await loadPasskeys();
    } catch (e: any) { setPkError(e.message || 'Passkey 註冊失敗'); }
  }

  if (loading) return <div className="p-8 text-slate-500">載入中...</div>;

  const isGoogleOnly = profile?.googleLinked && !profile?.hasPassword;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">帳號設定</h2>

      {/* Profile Info */}
      <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold mb-4">帳號資訊</h3>
        <div className="flex gap-4 mb-2"><span className="text-slate-600 w-24">電子郵件</span><span className="font-medium">{profile?.email || '—'}</span></div>
        <div className="flex gap-4"><span className="text-slate-600 w-24">顯示名稱</span><span className="font-medium">{profile?.displayName || profile?.display_name || '—'}</span></div>
      </div>

      {/* Display Name */}
      <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold mb-4">修改顯示名稱</h3>
        <form onSubmit={handleDisplayName}>
          <Input label="顯示名稱" value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={50} />
          {dnMsg && <p className={`text-sm mt-2 ${dnMsg.includes('失敗') ? 'text-red-500' : 'text-green-600'}`}>{dnMsg}</p>}
          <Button type="submit" className="mt-4" disabled={dnSaving}>{dnSaving ? '儲存中...' : '更新名稱'}</Button>
        </form>
      </div>

      {/* Password */}
      <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold mb-4">{isGoogleOnly ? '設定本機密碼' : '修改密碼'}</h3>
        {isGoogleOnly && <p className="text-sm text-slate-500 mb-4">目前帳號僅支援 Google 登入。設定本機密碼後，即可使用電子信箱與密碼登入。</p>}
        <form onSubmit={handleChangePw} className="space-y-4">
          {!isGoogleOnly && <Input label="目前密碼" type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />}
          <Input label="新密碼" type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder="至少8碼，含大小寫英文、數字、特殊符號" />
          <Input label="確認新密碼" type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
          {pwError && <div className="text-red-500 text-sm">{pwError}</div>}
          {pwSuccess && <p className="text-green-600 text-sm">{pwSuccess}</p>}
          <Button type="submit" disabled={pwSaving}>{pwSaving ? '更新中...' : isGoogleOnly ? '設定密碼' : '更新密碼'}</Button>
        </form>
      </div>

      {/* Theme Mode */}
      <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
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

      {/* Passkeys */}
      <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm">
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
    </div>
  );
}
