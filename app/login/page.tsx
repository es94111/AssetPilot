'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Script from 'next/script';
import { client as webauthnClient } from '@passwordless-id/webauthn';
import { Eye, EyeOff } from 'lucide-react';
import { useT } from '@/components/i18n/I18nProvider';

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initCodeClient: (options: Record<string, any>) => { requestCode: () => void };
        };
      };
    };
    turnstile?: {
      render: (container: string | HTMLElement, options: Record<string, any>) => string;
      reset: (widgetId?: string) => void;
      remove?: (widgetId: string) => void;
    };
  }
}

function shouldDisableLineAutoLogin() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export default function LoginPage() {
  const router = useRouter();
  const { t, locale } = useT();
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
  const [turnstileScriptLoaded, setTurnstileScriptLoaded] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetId = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('mode') === 'register') {
      setForm('register');
      setError('');
    }
    fetch('/api/config').then(r => r.json()).then(cfg => setConfig(cfg)).catch(() => {});
  }, []);

  const turnstileEnabled = !!config?.turnstileEnabled && !!config?.turnstileSiteKey;
  const turnstileLanguage = locale === 'zh-TW' ? 'zh-TW' : locale === 'zh-CN' ? 'zh-CN' : locale;

  useEffect(() => {
    if (!turnstileEnabled || form !== 'login' || !turnstileScriptLoaded || !window.turnstile || !turnstileRef.current) return;
    if (turnstileWidgetId.current) return;
    const widgetId = window.turnstile.render(turnstileRef.current, {
      sitekey: config.turnstileSiteKey,
      action: 'login',
      theme: 'auto',
      appearance: 'always',
      language: turnstileLanguage,
      callback: (token: string) => {
        setTurnstileToken(token || '');
        if (token) {
          setError(current => current === t('auth.errors.turnstileRequired') ? '' : current);
        }
      },
      'expired-callback': () => setTurnstileToken(''),
      'error-callback': () => setTurnstileToken(''),
    });
    turnstileWidgetId.current = widgetId;
    return () => {
      window.turnstile?.remove?.(widgetId);
      if (turnstileWidgetId.current === widgetId) turnstileWidgetId.current = null;
      setTurnstileToken('');
    };
  }, [config?.turnstileSiteKey, form, t, turnstileEnabled, turnstileLanguage, turnstileScriptLoaded]);

  useEffect(() => {
    if (form === 'login' || !turnstileWidgetId.current) return;
    window.turnstile?.remove?.(turnstileWidgetId.current);
    turnstileWidgetId.current = null;
    setTurnstileToken('');
  }, [form]);

  function resetTurnstile() {
    if (!turnstileWidgetId.current || !window.turnstile) return;
    window.turnstile.reset(turnstileWidgetId.current);
    setTurnstileToken('');
  }

  function requireTurnstile() {
    if (!turnstileEnabled || turnstileToken) return true;
    setError(t('auth.errors.turnstileRequired'));
    turnstileRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return false;
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!requireTurnstile()) return;
    setLoading(true);
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, turnstileToken }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || t('auth.errors.loginFailed'));
      router.push('/dashboard');
      router.refresh();
    } catch (e: any) { setError(e.message); }
    finally {
      setLoading(false);
      if (turnstileEnabled) resetTurnstile();
    }
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
      if (!r.ok) throw new Error(data.error || t('auth.errors.registerFailed'));
      router.push('/dashboard');
      router.refresh();
    } catch (e: any) { setRegError(e.message); }
    finally { setLoading(false); }
  }

  async function handleGoogleLogin() {
    setError('');
    if (!requireTurnstile()) return;
    if (!config?.googleClientId || !config?.googleCodeFlow) { setError(t('auth.errors.googleNotConfigured')); return; }
    if (!window.google?.accounts?.oauth2?.initCodeClient) { setError(t('auth.errors.googleComponentNotLoaded')); return; }
    setGoogleLoading(true);
    try {
      const redirectUri = window.location.origin;
      const stateRes = await fetch('/api/auth/google/state', { cache: 'no-store' });
      const stateData = await stateRes.json().catch(() => ({}));
      const state = stateData?.state;
      if (!state) throw new Error(t('auth.errors.googleStateFailed'));
      const client = window.google.accounts.oauth2.initCodeClient({
        client_id: config.googleClientId,
        scope: 'openid email profile',
        ux_mode: 'popup',
        redirect_uri: redirectUri,
        state,
        callback: async (response: any) => {
          try {
            if (!response?.code) throw new Error(t('auth.errors.googleNoCode'));
            const res = await fetch('/api/auth/google', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ code: response.code, redirect_uri: redirectUri, state, turnstileToken }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || t('auth.errors.googleFailed'));
            router.push('/dashboard');
            router.refresh();
          } catch (e: any) {
            setError(e.message || t('auth.errors.googleFailed'));
          } finally {
            setGoogleLoading(false);
            if (turnstileEnabled) resetTurnstile();
          }
        },
        error_callback: (err: any) => {
          setError(err?.message || t('auth.errors.googleCancelled'));
          setGoogleLoading(false);
          if (turnstileEnabled) resetTurnstile();
        },
      });
      client.requestCode();
    } catch (e: any) {
      setError(e.message || t('auth.errors.googleFailed'));
      setGoogleLoading(false);
      if (turnstileEnabled) resetTurnstile();
    }
  }

  async function handlePasskeyLogin() {
    setError('');
    if (!requireTurnstile()) return;
    if (!webauthnClient.isAvailable()) { setError(t('auth.errors.passkeyUnsupported')); return; }
    setPasskeyLoading(true);
    try {
      const challengeRes = await fetch('/api/auth/passkey/challenge', { cache: 'no-store' });
      const { key, challenge, error: challengeError } = await challengeRes.json().catch(() => ({}));
      if (!challengeRes.ok || !key || !challenge) throw new Error(challengeError || t('auth.errors.passkeyChallengeFailed'));

      const authentication = await webauthnClient.authenticate({
        challenge,
        userVerification: 'required',
        timeout: 60000,
      });
      const res = await fetch('/api/auth/passkey/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authentication, challengeKey: key, turnstileToken }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t('auth.errors.passkeyFailed'));
      router.push('/dashboard');
      router.refresh();
    } catch (e: any) { setError(e.message || t('auth.errors.passkeyFailed')); }
    finally {
      setPasskeyLoading(false);
      if (turnstileEnabled) resetTurnstile();
    }
  }

  async function handleLineLogin() {
    setError('');
    if (!requireTurnstile()) return;
    if (!config?.lineChannelId || !config?.lineCodeFlow) { setError(t('auth.errors.lineNotConfigured')); return; }
    setLineLoading(true);
    try {
      const params = new URLSearchParams({
        flow: 'login',
        origin: window.location.origin,
      });
      if (turnstileToken) params.set('turnstileToken', turnstileToken);
      if (shouldDisableLineAutoLogin()) params.set('disableAutoLogin', '1');
      window.location.assign(`/api/auth/line/authorize?${params.toString()}`);
    } catch (e: any) {
      setError(e.message || t('auth.errors.lineFailed'));
      setLineLoading(false);
    }
  }

  const registrationEnabled = config ? config.registrationEnabled : true;
  const googleEnabled = !!config?.googleClientId && !!config?.googleCodeFlow;
  const lineEnabled = !!config?.lineChannelId && !!config?.lineCodeFlow;

  return (
    <div className="login-bg">
      {googleEnabled && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" />}
      {turnstileEnabled && (
        <Script
          src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
          strategy="afterInteractive"
          onLoad={() => setTurnstileScriptLoaded(true)}
        />
      )}

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
            {form === 'login' ? t('auth.subtitleLogin') : t('auth.subtitleRegister')}
          </p>
        </div>

        {/* Tab switcher */}
        {registrationEnabled && (
          <div className="login-tabs">
            <button
              className={`login-tab ${form === 'login' ? 'login-tab-active' : ''}`}
              onClick={() => { setForm('login'); setError(''); }}
            >
              {t('auth.loginTab')}
            </button>
            <button
              className={`login-tab ${form === 'register' ? 'login-tab-active' : ''}`}
              onClick={() => { setForm('register'); setRegError(''); }}
            >
              {t('auth.registerTab')}
            </button>
          </div>
        )}

        {form === 'login' && (
          <form className="login-form" onSubmit={handleLogin}>
            <div className="login-field">
              <label className="login-label">{t('auth.emailLabel')}</label>
              <input
                type="email" required autoComplete="email"
                className="login-input"
                placeholder="your@email.com"
                value={email} onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div className="login-field">
              <label className="login-label">{t('auth.passwordLabel')}</label>
              <div className="login-input-wrap">
                <input
                  type={showPw ? 'text' : 'password'} required autoComplete="current-password"
                  className="login-input login-input-pw"
                  placeholder={t('auth.passwordPlaceholder')}
                  value={password} onChange={e => setPassword(e.target.value)}
                />
                <button type="button" className="login-pw-toggle" onClick={() => setShowPw(v => !v)} aria-label={t('auth.togglePassword')}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {turnstileEnabled && (
              <div className="login-turnstile" ref={turnstileRef} aria-label={t('auth.turnstileAria')} />
            )}
            {error && <p className="login-error" role="alert">{error}</p>}
            <button type="submit" className="login-btn-primary" disabled={loading}>
              {loading ? t('auth.loggingIn') : t('auth.loginButton')}
            </button>
            <button type="button" className="login-btn-google" onClick={handlePasskeyLogin} disabled={passkeyLoading}>
              {passkeyLoading ? t('auth.passkeyVerifying') : t('auth.passkeyButton')}
            </button>
            {googleEnabled && (
              <button type="button" className="login-btn-google" onClick={handleGoogleLogin} disabled={googleLoading}>
                <GoogleIcon />
                {googleLoading ? t('auth.googleVerifying') : t('auth.googleButton')}
              </button>
            )}
            {lineEnabled && (
              <button type="button" className="login-btn-google" onClick={handleLineLogin} disabled={lineLoading}>
                <LineIcon />
                {lineLoading ? t('auth.lineVerifying') : t('auth.lineButton')}
              </button>
            )}
          </form>
        )}

        {form === 'register' && (
          <form className="login-form" onSubmit={handleRegister}>
            <div className="login-field">
              <label className="login-label">{t('auth.emailLabel')}</label>
              <input
                type="email" required autoComplete="email"
                className="login-input"
                placeholder="your@email.com"
                value={regEmail} onChange={e => setRegEmail(e.target.value)}
              />
            </div>
            <div className="login-field">
              <label className="login-label">{t('auth.displayNameLabel')}</label>
              <input
                type="text" required maxLength={50} autoComplete="name"
                className="login-input"
                placeholder={t('auth.displayNamePlaceholder')}
                value={regName} onChange={e => setRegName(e.target.value)}
              />
            </div>
            <div className="login-field">
              <label className="login-label">{t('auth.passwordLabel')}</label>
              <div className="login-input-wrap">
                <input
                  type={showRegPw ? 'text' : 'password'} required minLength={8} autoComplete="new-password"
                  className="login-input login-input-pw"
                  placeholder={t('auth.registerPasswordPlaceholder')}
                  value={regPassword} onChange={e => setRegPassword(e.target.value)}
                />
                <button type="button" className="login-pw-toggle" onClick={() => setShowRegPw(v => !v)} aria-label={t('auth.togglePassword')}>
                  {showRegPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            {regError && <p className="login-error" role="alert">{regError}</p>}
            <button type="submit" className="login-btn-primary" disabled={loading}>
              {loading ? t('auth.registering') : t('auth.registerSubmit')}
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
