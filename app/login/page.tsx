'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Script from 'next/script';
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

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'register') {
      setForm('register');
      setError('');
    }
    fetch('/api/config').then(r => r.json()).then(cfg => setConfig(cfg)).catch(() => {});
  }, []);

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

  const registrationEnabled = config ? config.registrationEnabled : true;
  const googleEnabled = !!config?.googleClientId && !!config?.googleCodeFlow;

  return (
    <div className="login-bg">
      {googleEnabled && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />}

      {/* Decorative blobs */}
      <div className="login-blob login-blob-1" />
      <div className="login-blob login-blob-2" />

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
            {googleEnabled && (
              <button type="button" className="login-btn-google" onClick={handleGoogleLogin} disabled={googleLoading}>
                <GoogleIcon />
                {googleLoading ? 'Google 驗證中…' : '使用 Google 登入'}
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
