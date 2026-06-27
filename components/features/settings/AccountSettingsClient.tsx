'use client';

import { useState, useEffect, useCallback } from 'react';
import { client as webauthnClient } from '@passwordless-id/webauthn';
import { apiGet, apiPut, apiPost, apiDelete } from '@/lib/clientApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { LanguageSwitcher } from '@/components/i18n/LanguageSwitcher';
import { useT } from '@/components/i18n/I18nProvider';
import { localeTag } from '@/lib/i18n/localeTag';

function shouldDisableLineAutoLogin() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function isMessageError(message: string) {
  return /\u5931\u6557|\u932f\u8aa4|\u683c\u5f0f|\u4e0d\u53ef|\u8acb|failed|invalid|required|cannot|please/i.test(message);
}

export default function AccountSettingsClient({ user: initialUser }: { user: any }) {
  const { locale, t } = useT();
  const dateLocale = localeTag(locale);
  const ta = (key: string, vars?: Record<string, string | number>) => t(`settings.account.${key}`, vars);
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
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deleting, setDeleting] = useState(false);

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
    if (!oauthOnly && !currentPw) { setPwError(ta('messages.currentPasswordRequired')); return; }
    if (!newPw) { setPwError(ta('messages.newPasswordRequired')); return; }
    if (newPw.length < 8) { setPwError(ta('messages.passwordTooShort')); return; }
    if (!/[A-Z]/.test(newPw) || !/[a-z]/.test(newPw) || !/\d/.test(newPw) || !/[^a-zA-Z0-9]/.test(newPw)) {
      setPwError(ta('messages.passwordComplexity')); return;
    }
    if (newPw !== confirmPw) { setPwError(ta('messages.confirmPasswordMismatch')); return; }
    setPwSaving(true);
    try {
      await apiPut('/api/account/password', {
        currentPassword: oauthOnly ? undefined : currentPw,
        newPassword: newPw,
      });
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setPwSuccess(oauthOnly ? ta('messages.localPasswordSet') : ta('messages.passwordUpdated'));
      await load();
    } catch (e: any) { setPwError(e.message || ta('messages.passwordUpdateFailed')); }
    setPwSaving(false);
  }

  async function handleDisplayName(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) { setDnMsg(ta('messages.displayNameRequired')); return; }
    setDnSaving(true);
    setDnMsg('');
    try {
      await apiPut('/api/account/display-name', { displayName: displayName.trim() });
      setDnMsg(ta('messages.displayNameUpdated'));
      await load();
    } catch (e: any) { setDnMsg(e.message || ta('messages.updateFailed')); }
    setDnSaving(false);
  }

  async function handleTheme(mode: string) {
    setThemeMode(mode);
    setThemeSaving(true);
    try { await apiPut('/api/account/theme', { themeMode: mode }); } catch (_) {}
    setThemeSaving(false);
  }

  async function handleDeletePasskey(credId: string) {
    if (!confirm(ta('messages.deletePasskeyConfirm'))) return;
    try {
      await apiDelete(`/api/account/passkey/${encodeURIComponent(credId)}`);
      await loadPasskeys();
    } catch (e: any) { alert(e.message); }
  }

  async function handleDefaultCurrency(e: React.FormEvent) {
    e.preventDefault();
    const currency = defaultCurrency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      setCurrencyMsg(ta('messages.currencyInvalid'));
      return;
    }
    setCurrencySaving(true);
    setCurrencyMsg('');
    try {
      const res = await apiPut('/api/user/settings/default-currency', { defaultCurrency: currency });
      setDefaultCurrency(res.defaultCurrency || currency);
      setCurrencyMsg(ta('messages.currencyUpdated'));
      await load();
    } catch (e: any) {
      setCurrencyMsg(e.message || ta('messages.currencyUpdateFailed'));
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
      setSessionsMsg(ta('messages.sessionLoggedOut'));
      await loadSessions();
    } catch (e: any) {
      setSessionsMsg(e.message || ta('messages.sessionLogoutFailed'));
    }
  }

  async function handleRegisterPasskey() {
    setPkError('');
    if (!webauthnClient.isAvailable()) {
      setPkError(ta('messages.passkeyUnsupported'));
      return;
    }
    try {
      const { key, challenge } = await apiGet('/api/account/passkey/challenge') as { key: string; challenge: string };
      const deviceName = navigator.userAgent.includes('iPhone') || navigator.userAgent.includes('iPad')
        ? 'iPhone/iPad' : navigator.userAgent.includes('Android') ? ta('messages.androidDevice') : ta('messages.computerDevice');

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
    } catch (e: any) { setPkError(e.message || ta('messages.passkeyRegisterFailed')); }
  }

  async function handleLinkGoogle() {
    setGoogleMsg('');
    const credential = window.prompt(ta('messages.googleTokenPrompt'));
    if (!credential) return;
    try {
      await apiPost('/api/account/link-google', { credential });
      setGoogleMsg(ta('messages.googleLinked'));
      await load();
    } catch (e: any) {
      setGoogleMsg(e.message || ta('messages.googleLinkFailed'));
    }
  }

  async function handleUnlinkGoogle() {
    setGoogleMsg('');
    try {
      await apiDelete('/api/account/settings/google');
      setGoogleMsg(ta('messages.googleUnlinked'));
      await load();
    } catch (e: any) {
      setGoogleMsg(e.message || ta('messages.googleUnlinkFailed'));
    }
  }

  async function handleLinkLine() {
    setLineMsg('');
    setLineLoading(true);
    try {
      const cfgRes = await fetch('/api/config', { cache: 'no-store' });
      const cfg = await cfgRes.json().catch(() => ({}));
      if (!cfg?.lineChannelId || !cfg?.lineCodeFlow) throw new Error(ta('messages.lineNotConfigured'));
      const params = new URLSearchParams({
        flow: 'link',
        origin: window.location.origin,
      });
      if (shouldDisableLineAutoLogin()) params.set('disableAutoLogin', '1');
      window.location.assign(`/api/auth/line/authorize?${params.toString()}`);
    } catch (e: any) {
      setLineMsg(e.message || ta('messages.lineLinkFailed'));
      setLineLoading(false);
    }
  }

  async function handleUnlinkLine() {
    setLineMsg('');
    try {
      await apiDelete('/api/account/settings/line');
      setLineMsg(ta('messages.lineUnlinked'));
      await load();
    } catch (e: any) {
      setLineMsg(e.message || ta('messages.lineUnlinkFailed'));
    }
  }

  function openDeleteModal() {
    setDeleteMsg('');
    setDeletePassword('');
    setDeleteConfirmEmail('');
    setDeleteOpen(true);
  }

  async function confirmDeleteAccount() {
    setDeleteMsg('');
    const hasPassword = !!profile?.hasPassword;
    if (hasPassword && !deletePassword) { setDeleteMsg(ta('messages.deletePasswordRequired')); return; }
    if (!hasPassword && deleteConfirmEmail.trim().toLowerCase() !== String(profile?.email || '').trim().toLowerCase()) {
      setDeleteMsg(ta('messages.deleteEmailMismatch'));
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch('/api/account/settings/delete', {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hasPassword ? { password: deletePassword } : { confirmEmail: deleteConfirmEmail.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setDeleteOpen(false);
      window.location.href = '/';
    } catch (e: any) {
      setDeleteMsg(e.message || ta('messages.deleteFailed'));
    }
    setDeleting(false);
  }

  if (loading) return <div className="p-8 text-slate-500">{t('common.loading')}</div>;

  const isOAuthOnly = (profile?.googleLinked || profile?.lineLinked) && !profile?.hasPassword;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{ta('title')}</h2>

      {/* Profile Info */}
      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold mb-4">{ta('profileInfo')}</h3>
        <div className="flex gap-4 mb-2"><span className="text-slate-600 w-24">{ta('email')}</span><span className="font-medium">{profile?.email || '—'}</span></div>
        <div className="flex gap-4"><span className="text-slate-600 w-24">{ta('displayName')}</span><span className="font-medium">{profile?.displayName || profile?.display_name || '—'}</span></div>
      </div>

      {/* Language */}
      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <LanguageSwitcher />
      </div>

      {/* Display Name */}
      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold mb-4">{ta('editDisplayName')}</h3>
        <form onSubmit={handleDisplayName}>
          <Input label={ta('displayName')} value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={50} />
          {dnMsg && <p className={`text-sm mt-2 ${isMessageError(dnMsg) ? 'text-red-500' : 'text-green-600'}`}>{dnMsg}</p>}
          <Button type="submit" className="mt-4" disabled={dnSaving}>{dnSaving ? ta('saving') : ta('updateName')}</Button>
        </form>
      </div>

      {/* Password */}
      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold mb-4">{isOAuthOnly ? ta('setLocalPassword') : ta('changePassword')}</h3>
        {isOAuthOnly && <p className="text-sm text-slate-500 mb-4">{ta('oauthOnlyPasswordHelp')}</p>}
        <form onSubmit={handleChangePw} className="space-y-4">
          {!isOAuthOnly && <Input label={ta('currentPassword')} type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)} />}
          <Input label={ta('newPassword')} type="password" value={newPw} onChange={e => setNewPw(e.target.value)} placeholder={ta('passwordPlaceholder')} />
          <Input label={ta('confirmNewPassword')} type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} />
          {pwError && <div className="text-red-500 text-sm">{pwError}</div>}
          {pwSuccess && <p className="text-green-600 text-sm">{pwSuccess}</p>}
          <Button type="submit" disabled={pwSaving}>{pwSaving ? ta('updating') : isOAuthOnly ? ta('setPassword') : ta('updatePassword')}</Button>
        </form>
      </div>

      {/* Theme Mode */}
      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold mb-4">{ta('themeTitle')}</h3>
        <div className="flex gap-4">
          {[
            ['system', ta('theme.system')],
            ['light', ta('theme.light')],
            ['dark', ta('theme.dark')],
          ].map(([val, label]) => (
            <label key={val} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="themeMode" value={val} checked={themeMode === val} onChange={() => handleTheme(val)} className="w-4 h-4" />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold mb-4">{ta('defaultCurrency')}</h3>
        <form onSubmit={handleDefaultCurrency} className="space-y-3 max-w-xs">
          <Input label={ta('currencyCode')} value={defaultCurrency} onChange={e => setDefaultCurrency(e.target.value.toUpperCase())} maxLength={3} placeholder="TWD" />
          {currencyMsg && <p className={`text-sm ${isMessageError(currencyMsg) ? 'text-red-500' : 'text-green-600'}`}>{currencyMsg}</p>}
          <Button type="submit" disabled={currencySaving}>{currencySaving ? ta('saving') : ta('updateDefaultCurrency')}</Button>
        </form>
      </div>

      {/* Passkeys */}
      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold mb-4">{ta('passkeyTitle')}</h3>
        {pkError && <div className="text-red-500 text-sm mb-4">{pkError}</div>}
        {pkLoading && <p className="text-slate-500">{t('common.loading')}</p>}
        {!pkLoading && passkeys.length === 0 && <p className="text-slate-500 text-sm">{ta('noPasskeys')}</p>}
        <div className="space-y-2">
          {passkeys.map((pk: any) => (
            <div key={pk.id} className="flex items-center justify-between p-3 border rounded-md">
              <span className="font-medium text-sm">{pk.deviceName || 'Passkey'}</span>
              <Button variant="ghost" size="icon" onClick={() => handleDeletePasskey(pk.credId || pk.id)} className="text-red-500 hover:text-red-700">✕</Button>
            </div>
          ))}
        </div>
        <Button className="mt-4" onClick={handleRegisterPasskey}>{ta('addPasskey')}</Button>
      </div>

      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold mb-4">{ta('googleTitle')}</h3>
        <p className="text-sm text-slate-500 mb-4">{ta('statusPrefix')}{profile?.googleLinked ? ta('linkedGoogle') : ta('notLinkedGoogle')}</p>
        <div className="flex gap-3 flex-wrap">
          {!profile?.googleLinked && <Button onClick={handleLinkGoogle}>{ta('linkGoogle')}</Button>}
          {profile?.googleLinked && <Button variant="outline" onClick={handleUnlinkGoogle}>{ta('unlink')}</Button>}
        </div>
        {googleMsg && <p className="text-sm text-slate-600 mt-3">{googleMsg}</p>}
      </div>

      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold mb-4">{ta('lineTitle')}</h3>
        <p className="text-sm text-slate-500 mb-4">{ta('statusPrefix')}{profile?.lineLinked ? ta('linkedLine') : ta('notLinkedLine')}</p>
        <div className="flex gap-3 flex-wrap">
          {!profile?.lineLinked && <Button onClick={handleLinkLine} disabled={lineLoading}>{lineLoading ? ta('lineVerifying') : ta('linkLine')}</Button>}
          {profile?.lineLinked && <Button variant="outline" onClick={handleUnlinkLine}>{ta('unlink')}</Button>}
        </div>
        {lineMsg && <p className="text-sm text-slate-600 mt-3">{lineMsg}</p>}
      </div>

      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{ta('sessionsTitle')}</h3>
          <Button variant="outline" onClick={loadSessions}>{ta('refresh')}</Button>
        </div>
        {sessionsMsg && <p className={`text-sm mb-3 ${isMessageError(sessionsMsg) ? 'text-red-500' : 'text-green-600'}`}>{sessionsMsg}</p>}
        {sessionsLoading ? <p className="text-slate-500">{t('common.loading')}</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="text-left py-2 pr-4">{ta('deviceName')}</th>
                  <th className="text-left py-2 pr-4">{ta('loginTime')}</th>
                  <th className="text-left py-2 pr-4">{ta('loginIp')}</th>
                  <th className="text-left py-2">{ta('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session: any) => (
                  <tr key={session.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{session.deviceName || ta('unknownDevice')}{session.isCurrent ? ta('currentDeviceSuffix') : ''}</td>
                    <td className="py-3 pr-4">{new Date(Number(session.loginAt) || 0).toLocaleString(dateLocale)}</td>
                    <td className="py-3 pr-4">{session.ipAddress || 'unknown'}</td>
                    <td className="py-3">
                      <Button variant="outline" onClick={() => handleLogoutSession(session.id, !!session.isCurrent)}>{ta('signOut')}</Button>
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-3 text-slate-500">{ta('noSessions')}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{ta('auditTitle')}</h3>
          <Button variant="outline" onClick={loadLoginAudit}>{ta('refresh')}</Button>
        </div>
        {auditLoading ? <p className="text-slate-500">{t('common.loading')}</p> : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="text-left py-2 pr-4">{ta('loginTime')}</th>
                  <th className="text-left py-2 pr-4">IP</th>
                  <th className="text-left py-2 pr-4">{ta('country')}</th>
                  <th className="text-left py-2 pr-4">{ta('method')}</th>
                  <th className="text-left py-2 pr-4">{ta('device')}</th>
                  <th className="text-left py-2">{ta('adminLogin')}</th>
                </tr>
              </thead>
              <tbody>
                {loginAudit.map((log, index) => (
                  <tr key={`${log.loginAt}-${index}`} className="border-b last:border-0">
                    <td className="py-3 pr-4">{new Date(Number(log.loginAt) || 0).toLocaleString(dateLocale)}</td>
                    <td className="py-3 pr-4">{log.ipAddress}</td>
                    <td className="py-3 pr-4">{log.country}</td>
                    <td className="py-3 pr-4">{log.loginMethod}</td>
                    <td className="py-3 pr-4">{log.device || '—'}</td>
                    <td className="py-3">{log.isAdminLogin ? ta('yes') : ta('no')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="p-6 bg-white border border-red-200 dark:bg-slate-900 dark:border-red-900/50 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold text-red-600 mb-4">{ta('deleteTitle')}</h3>
        <p className="text-sm text-slate-600 mb-4">{ta('deleteDescription')}</p>
        <Button variant="destructive" onClick={openDeleteModal}>{ta('deleteButton')}</Button>
      </div>

      <Modal open={deleteOpen} onClose={() => !deleting && setDeleteOpen(false)} title={ta('deleteModalTitle')}>
        <div className="space-y-4">
          <p className="text-sm text-red-600">{ta('deleteModalWarning')}</p>
          {profile?.hasPassword ? (
            <Input
              label={ta('deletePasswordLabel')}
              type="password"
              value={deletePassword}
              onChange={e => setDeletePassword(e.target.value)}
              autoFocus
            />
          ) : (
            <Input
              label={ta('deleteEmailLabel', { email: profile?.email || '' })}
              type="email"
              value={deleteConfirmEmail}
              onChange={e => setDeleteConfirmEmail(e.target.value)}
              placeholder={profile?.email || ''}
              autoComplete="off"
              autoFocus
            />
          )}
          {deleteMsg && <p className="text-sm text-red-500">{deleteMsg}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>{t('common.cancel')}</Button>
            <Button variant="destructive" onClick={confirmDeleteAccount} disabled={deleting}>{deleting ? ta('deleting') : ta('deletePermanently')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
