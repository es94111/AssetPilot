'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Script from 'next/script';
import { client as webauthnClient } from '@passwordless-id/webauthn';
import { Eye, EyeOff } from 'lucide-react';

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initCodeClient: (options: Record<string, any>) => { requestCode: () => void };
        };
      };
    };
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState<'login' | 'register'>('login');
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
  const [config, setConfig] = useState<any>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [lineLoading, setLineLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'register') {
      setForm('register');
      setError('');
    }
    fetch('/api/config').then(r => r.json()).then(cfg => setConfig(cfg)).catch(() => {});
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const expectedState = window.sessionStorage.getItem('line_oauth_state');
    if (!code || !state || !expectedState || state !== expectedState) return;

    window.sessionStorage.removeItem('line_oauth_state');
    setLineLoading(true);
    setError('');
    const redirectUri = window.location.origin + window.location.pathname;
    fetch('/api/auth/line', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state, redirect_uri: redirectUri }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'LINE 登入失敗');
        router.push('/dashboard');
        router.refresh();
      })
      .catch((e) => setError(e.message || 'LINE 登入失敗'))
      .finally(() => setLineLoading(false));
  }, [router]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || '登入失敗');
      router.push('/dashboard');
      router.refresh();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setRegError('');
    setLoading(true);
    try {
      const r = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: regEmail, displayName: regName, password: regPassword }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || '註冊失敗');
      router.push('/dashboard');
      router.refresh();
    } catch (e: any) { setRegError(e.message); }
    finally { setLoading(false); }
  }

  async function handleGoogleLogin() {
    setError('');
    if (!config?.googleClientId || !config?.googleCodeFlow) { setError('Google 登入尚未設定完成'); return; }
    if (!window.google?.accounts?.oauth2?.initCodeClient) { setError('Google 登入元件尚未載入'); return; }
    setGoogleLoading(true);
    try {
      const redirectUri = window.location.origin;
      const stateRes = await fetch('/api/auth/google/state', { cache: 'no-store' });
      const stateData = await stateRes.json().catch(() => ({}));
      const state = stateData?.state;
      if (!state) throw new Error('無法建立 Google 登入狀態');
      const client = window.google.accounts.oauth2.initCodeClient({
        client_id: config.googleClientId,
        scope: 'openid email profile',
        ux_mode: 'popup',
        redirect_uri: redirectUri,
        state,
        callback: async (response: any) => {
          try {
            if (!response?.code) throw new Error('未收到 Google 授權碼');
            const res = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: response.code, redirect_uri: redirectUri, state }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || 'Google 登入失敗');
            router.push('/dashboard');
            router.refresh();
          } catch (e: any) {
            setError(e.message || 'Google 登入失敗');
          } finally { setGoogleLoading(false); }
        },
        error_callback: (err: any) => {
          setError(err?.message || 'Google 登入已取消');
          setGoogleLoading(false);
        },
      });
      client.requestCode();
    } catch (e: any) {
      setError(e.message || 'Google 登入失敗');
      setGoogleLoading(false);
    }
  }

  async function handlePasskeyLogin() {
    setError('');
    if (!webauthnClient.isAvailable()) { setError('此瀏覽器不支援 Passkey'); return; }
    setPasskeyLoading(true);
    try {
      const challengeRes = await fetch('/api/auth/passkey/challenge', { cache: 'no-store' });
      const { key, challenge, error: challengeError } = await challengeRes.json().catch(() => ({}));
      if (!challengeRes.ok || !key || !challenge) throw new Error(challengeError || '無法建立 Passkey 登入挑戰');

      const authentication = await webauthnClient.authenticate({
        challenge,
        userVerification: 'required',
        timeout: 60000,
      });
      const res = await fetch('/api/auth/passkey/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authentication, challengeKey: key }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Passkey 登入失敗');
      router.push('/dashboard');
      router.refresh();
    } catch (e: any) { setError(e.message || 'Passkey 登入失敗'); }
    finally { setPasskeyLoading(false); }
  }

  async function handleLineLogin() {
    setError('');
    if (!config?.lineChannelId || !config?.lineCodeFlow) { setError('LINE 登入尚未設定完成'); return; }
    setLineLoading(true);
    try {
      const stateRes = await fetch('/api/auth/line/state', { cache: 'no-store' });
      const { state, nonce } = await stateRes.json().catch(() => ({}));
      if (!state || !nonce) throw new Error('無法建立 LINE 登入狀態');
      window.sessionStorage.setItem('line_oauth_state', state);
      const redirectUri = window.location.origin + window.location.pathname;
      const authorizeUrl = new URL('https://access.line.me/oauth2/v2.1/authorize');
      authorizeUrl.searchParams.set('response_type', 'code');
      authorizeUrl.searchParams.set('client_id', config.lineChannelId);
      authorizeUrl.searchParams.set('redirect_uri', redirectUri);
      authorizeUrl.searchParams.set('state', state);
      authorizeUrl.searchParams.set('scope', 'openid profile email');
      authorizeUrl.searchParams.set('nonce', nonce);
      window.location.href = authorizeUrl.toString();
    } catch (e: any) {
      setError(e.message || 'LINE 登入失敗');
      setLineLoading(false);
    }
  }

  const registrationEnabled = config ? config.registrationEnabled : true;
  const googleEnabled = !!config?.googleClientId && !!config?.googleCodeFlow;
  const lineEnabled = !!config?.lineChannelId && !!config?.lineCodeFlow;

  return (
    <div className="login-bg">
      {googleEnabled && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />}

      {/* Decorative blobs */}
      <div className="login-blob login-blob-1" />
      <div className="login-blob login-blob-2" />
      <div className="login-blob login-blob-3" />

      <div className="login-card">
        {/* Brand header */}
        <div className="login-brand">
          <div className="login-logo-ring">
            <Image src="/favicon.svg" alt="AssetPilot" width={32} height={32} />
          </div>
          <h1 className="login-title">AssetPilot</h1>
          <p className="login-subtitle">
            {form === 'login' ? '歡迎回來，請登入您的帳號' : '建立您的帳號，開始記帳'}
          </p>
        </div>

        {/* Tab switcher */}
        {registrationEnabled && (
          <div className="login-tabs">
            <button
              className={`login-tab ${form === 'login' ? 'login-tab-active' : ''}`}
              onClick={() => { setForm('login'); setError(''); }}
            >
              登入
            </button>
            <button
              className={`login-tab ${form === 'register' ? 'login-tab-active' : ''}`}
              onClick={() => { setForm('register'); setRegError(''); }}
            >
              註冊
            </button>
          </div>
        )}

        {form === 'login' && (
          <form className="login-form" onSubmit={handleLogin}>
            <div className="login-field">
              <label className="login-label">電子信箱</label>
              <input
                type="email" required autoComplete="email"
                className="login-input"
                placeholder="your@email.com"
                value={email} onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="login-field">
              <label className="login-label">密碼</label>
              <div className="login-input-wrap">
                <input
                  type={showPw ? 'text' : 'password'} required autoComplete="current-password"
                  className="login-input login-input-pw"
                  placeholder="請輸入密碼"
                  value={password} onChange={e => setPassword(e.target.value)}
                />
                <button type="button" className="login-pw-toggle" onClick={() => setShowPw(v => !v)} aria-label="切換密碼顯示">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {error && <p className="login-error" role="alert">{error}</p>}
            <button type="submit" className="login-btn-primary" disabled={loading}>
              {loading ? '登入中…' : '登入'}
            </button>
            <button type="button" className="login-btn-google" onClick={handlePasskeyLogin} disabled={passkeyLoading}>
              {passkeyLoading ? 'Passkey 驗證中…' : '使用 Passkey 登入'}
            </button>
            {googleEnabled && (
              <button type="button" className="login-btn-google" onClick={handleGoogleLogin} disabled={googleLoading}>
                <GoogleIcon />
                {googleLoading ? 'Google 驗證中…' : '使用 Google 登入'}
              </button>
            )}
            {lineEnabled && (
              <button type="button" className="login-btn-google" onClick={handleLineLogin} disabled={lineLoading}>
                <LineIcon />
                {lineLoading ? 'LINE 驗證中…' : '使用 LINE 登入'}
              </button>
            )}
          </form>
        )}

        {form === 'register' && (
          <form className="login-form" onSubmit={handleRegister}>
            <div className="login-field">
              <label className="login-label">電子信箱</label>
              <input
                type="email" required autoComplete="email"
                className="login-input"
                placeholder="your@email.com"
                value={regEmail} onChange={e => setRegEmail(e.target.value)}
              />
            </div>
            <div className="login-field">
              <label className="login-label">顯示名稱</label>
              <input
                type="text" required maxLength={50} autoComplete="name"
                className="login-input"
                placeholder="您的暱稱"
                value={regName} onChange={e => setRegName(e.target.value)}
              />
            </div>
            <div className="login-field">
              <label className="login-label">密碼</label>
              <div className="login-input-wrap">
                <input
                  type={showRegPw ? 'text' : 'password'} required minLength={8} autoComplete="new-password"
                  className="login-input login-input-pw"
                  placeholder="至少 8 位，含大小寫英文與數字"
                  value={regPassword} onChange={e => setRegPassword(e.target.value)}
                />
                <button type="button" className="login-pw-toggle" onClick={() => setShowRegPw(v => !v)} aria-label="切換密碼顯示">
                  {showRegPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {regError && <p className="login-error" role="alert">{regError}</p>}
            <button type="submit" className="login-btn-primary" disabled={loading}>
              {loading ? '註冊中…' : '立即註冊'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function LineIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <rect width="18" height="18" rx="4" fill="#06C755" />
      <path fill="#fff" d="M14.35 8.1c0-2.34-2.35-4.24-5.24-4.24S3.86 5.76 3.86 8.1c0 2.1 1.86 3.86 4.38 4.19.17.04.4.11.46.26.05.13.03.34.02.47l-.07.45c-.02.13-.11.52.45.28.56-.24 3.03-1.79 4.13-3.06.76-.83 1.12-1.67 1.12-2.59Z"/>
      <path fill="#06C755" d="M6.47 6.94h-.37a.1.1 0 0 0-.1.1v2.29c0 .06.04.1.1.1h1.31c.06 0 .1-.04.1-.1v-.37a.1.1 0 0 0-.1-.1h-.84V7.04a.1.1 0 0 0-.1-.1Zm1.42 0h-.37a.1.1 0 0 0-.1.1v2.29c0 .06.04.1.1.1h.37c.06 0 .1-.04.1-.1V7.04a.1.1 0 0 0-.1-.1Zm2.44 0h-.37a.1.1 0 0 0-.1.1v1.36L8.82 6.98a.1.1 0 0 0-.08-.04h-.36a.1.1 0 0 0-.1.1v2.29c0 .06.04.1.1.1h.37c.06 0 .1-.04.1-.1V7.97l1.05 1.42.02.02.01.01h.01l.01.01h.39c.06 0 .1-.04.1-.1V7.04a.1.1 0 0 0-.1-.1Zm1.68.57c.06 0 .1-.04.1-.1v-.37a.1.1 0 0 0-.1-.1h-1.31a.1.1 0 0 0-.1.1v2.29c0 .06.04.1.1.1h1.31c.06 0 .1-.04.1-.1v-.37a.1.1 0 0 0-.1-.1h-.84v-.39h.84c.06 0 .1-.04.1-.1v-.37a.1.1 0 0 0-.1-.1h-.84v-.39h.84Z"/>
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}
