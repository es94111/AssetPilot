'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export const dynamic = 'force-static';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regName, setRegName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showRegPw, setShowRegPw] = useState(false);
  const [error, setError] = useState('');
  const [regError, setRegError] = useState('');
  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState(null);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);

  useEffect(() => {
    fetch('/api/config').then(r => r.json()).then(cfg => {
      setConfig(cfg);
      if (cfg.googleClientId) loadGoogleScript(cfg.googleClientId);
    }).catch(() => {});
    if (typeof window !== 'undefined' && window.PublicKeyCredential) setPasskeyAvailable(true);
  }, []);

  function loadGoogleScript(clientId) {
    if (document.getElementById('google-gsi-script')) return;
    const s = document.createElement('script');
    s.id = 'google-gsi-script';
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => {
      if (!window.google?.accounts?.id) return;
      const container = document.getElementById('googleSignInBtn');
      if (!container) return;
      window.google.accounts.id.initialize({ client_id: clientId, callback: handleGoogleCredential, use_fedcm_for_prompt: false });
      window.google.accounts.id.renderButton(container, { theme: 'outline', size: 'large', width: 340, text: 'signin_with' });
    };
    document.head.appendChild(s);
  }

  async function handleGoogleCredential(response) {
    setError('');
    try {
      const r = await fetch('/api/auth/google', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Google 登入失敗');
      router.push('/dashboard');
      router.refresh();
    } catch (e) { setError(e.message); }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || '登入失敗');
      router.push('/dashboard');
      router.refresh();
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setRegError('');
    setLoading(true);
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail, displayName: regName, password: regPassword }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || '註冊失敗');
      router.push('/dashboard');
      router.refresh();
    } catch (e) { setRegError(e.message); }
    finally { setLoading(false); }
  }

  async function handlePasskeyLogin() {
    setError('');
    try {
      const challengeRes = await fetch('/api/auth/passkey/challenge', { credentials: 'include' });
      const { challenge, allowCredentials } = await challengeRes.json();
      const fromBase64url = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
      const toBase64url = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
      const assertion = await navigator.credentials.get({
        publicKey: {
          challenge: fromBase64url(challenge),
          allowCredentials: (allowCredentials || []).map(c => ({ id: fromBase64url(c.id), type: 'public-key' })),
          userVerification: 'preferred',
        },
      });
      const r = await fetch('/api/auth/passkey/login', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: assertion.id, rawId: toBase64url(assertion.rawId),
          response: {
            authenticatorData: toBase64url(assertion.response.authenticatorData),
            clientDataJSON: toBase64url(assertion.response.clientDataJSON),
            signature: toBase64url(assertion.response.signature),
            userHandle: assertion.response.userHandle ? toBase64url(assertion.response.userHandle) : null,
          },
          type: assertion.type,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Passkey 驗證失敗');
      router.push('/dashboard');
      router.refresh();
    } catch (e) {
      if (e.name !== 'NotAllowedError') setError(e.message);
    }
  }

  const hasGoogle = config?.googleClientId;
  const registrationEnabled = config ? config.registrationEnabled : true;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">
          <Image src="/logo.svg" alt="AssetPilot" width={40} height={40} className="auth-logo-img" />
          <span>AssetPilot</span>
        </div>
        <p className="auth-subtitle">輕鬆管理您的每一筆收支</p>

        {form === 'login' && (
          <form className="auth-form active" onSubmit={handleLogin}>
            <h2>登入</h2>
            <div className="form-row">
              <label>電子信箱</label>
              <input type="email" required placeholder="請輸入 Email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div className="form-row">
              <label>密碼</label>
              <div className="pw-input-wrap">
                <input type={showPw ? 'text' : 'password'} required placeholder="請輸入密碼" value={password} onChange={e => setPassword(e.target.value)} />
                <button type="button" className="pw-toggle-btn" aria-label="顯示或隱藏密碼" tabIndex={-1} onClick={() => setShowPw(v => !v)}>
                  <i className={`fas fa-${showPw ? 'eye-slash' : 'eye'}`} />
                </button>
              </div>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>{loading ? '登入中...' : '登入'}</button>
            {(hasGoogle || passkeyAvailable) && (
              <div className="alt-login-wrap">
                <div className="auth-divider"><span>或</span></div>
                {hasGoogle && <div className="google-signin-wrap"><div id="googleSignInBtn" /></div>}
                {passkeyAvailable && (
                  <div className="passkey-login-wrap">
                    <button type="button" className="btn btn-outline btn-block passkey-login-btn" onClick={handlePasskeyLogin}>
                      <i className="fas fa-fingerprint" /> 使用 Passkey 登入
                    </button>
                  </div>
                )}
              </div>
            )}
            {registrationEnabled && (
              <div className="auth-links">
                <a href="#" onClick={e => { e.preventDefault(); setForm('register'); setError(''); }}>還沒有帳號？立即註冊</a>
              </div>
            )}
          </form>
        )}

        {form === 'register' && (
          <form className="auth-form active" onSubmit={handleRegister}>
            <h2>註冊</h2>
            {hasGoogle && (
              <div className="google-signin-wrap">
                <div id="googleSignUpBtn" />
                <div className="auth-divider"><span>或使用帳號密碼註冊</span></div>
              </div>
            )}
            <div className="form-row">
              <label>電子信箱 <span className="required">*</span></label>
              <input type="email" required placeholder="請輸入 Email" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
            </div>
            <div className="form-row">
              <label>顯示名稱 <span className="required">*</span></label>
              <input type="text" required maxLength={50} placeholder="您的暱稱" value={regName} onChange={e => setRegName(e.target.value)} />
            </div>
            <div className="form-row">
              <label>密碼 <span className="required">*</span></label>
              <div className="pw-input-wrap">
                <input type={showRegPw ? 'text' : 'password'} required minLength={8} placeholder="至少8位，含大小寫英文、數字與特殊符號" value={regPassword} onChange={e => setRegPassword(e.target.value)} />
                <button type="button" className="pw-toggle-btn" aria-label="顯示或隱藏密碼" tabIndex={-1} onClick={() => setShowRegPw(v => !v)}>
                  <i className={`fas fa-${showRegPw ? 'eye-slash' : 'eye'}`} />
                </button>
              </div>
            </div>
            {regError && <div className="auth-error">{regError}</div>}
            <button type="submit" className="btn btn-primary btn-block" disabled={loading}>{loading ? '註冊中...' : '立即註冊'}</button>
            <div className="auth-links">
              <a href="#" onClick={e => { e.preventDefault(); setForm('login'); setRegError(''); }}>已有帳號？返回登入</a>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
