'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeOff, Fingerprint } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);

  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'register') {
      setForm('register');
      setError('');
    }

    fetch('/api/config')
      .then(r => r.json())
      .then(cfg => {
        setConfig(cfg);
        // Google script loading logic needs adaptation or replacement if using modern Auth
      })
      .catch(() => {});
    if (typeof window !== 'undefined' && window.PublicKeyCredential) setPasskeyAvailable(true);
  }, [searchParams]);

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

  const registrationEnabled = config ? config.registrationEnabled : true;

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-lg border border-slate-200">
        <div className="flex flex-col items-center mb-6">
          <Image src="/logo.svg" alt="AssetPilot" width={48} height={48} />
          <h1 className="text-2xl font-bold text-slate-900 mt-2">AssetPilot</h1>
          <p className="text-slate-500">輕鬆管理您的每一筆收支</p>
        </div>

        {form === 'login' && (
          <form className="space-y-4" onSubmit={handleLogin}>
            <h2 className="text-xl font-semibold">登入</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700">電子信箱</label>
              <input type="email" required className="w-full mt-1 p-2 border rounded-md" placeholder="請輸入 Email" value={email} onChange={e => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">密碼</label>
              <div className="relative">
                <input type={showPw ? 'text' : 'password'} required className="w-full mt-1 p-2 border rounded-md" placeholder="請輸入密碼" value={password} onChange={e => setPassword(e.target.value)} />
                <button type="button" className="absolute right-2 top-3 text-slate-400" onClick={() => setShowPw(v => !v)}>
                  {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            {error && <div className="text-red-500 text-sm">{error}</div>}
            <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700" disabled={loading}>{loading ? '登入中...' : '登入'}</button>
            {registrationEnabled && (
              <p className="text-center text-sm text-slate-600">
                還沒有帳號？ <button type="button" className="text-blue-600 font-medium" onClick={() => { setForm('register'); setError(''); }}>立即註冊</button>
              </p>
            )}
          </form>
        )}

        {form === 'register' && (
          <form className="space-y-4" onSubmit={handleRegister}>
            <h2 className="text-xl font-semibold">註冊</h2>
            <div>
              <label className="block text-sm font-medium text-slate-700">電子信箱</label>
              <input type="email" required className="w-full mt-1 p-2 border rounded-md" placeholder="請輸入 Email" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">顯示名稱</label>
              <input type="text" required maxLength={50} className="w-full mt-1 p-2 border rounded-md" placeholder="您的暱稱" value={regName} onChange={e => setRegName(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">密碼</label>
              <div className="relative">
                <input type={showRegPw ? 'text' : 'password'} required minLength={8} className="w-full mt-1 p-2 border rounded-md" placeholder="至少8位，含大小寫英文、數字與特殊符號" value={regPassword} onChange={e => setRegPassword(e.target.value)} />
                <button type="button" className="absolute right-2 top-3 text-slate-400" onClick={() => setShowRegPw(v => !v)}>
                  {showRegPw ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>
            {regError && <div className="text-red-500 text-sm">{regError}</div>}
            <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700" disabled={loading}>{loading ? '註冊中...' : '立即註冊'}</button>
            <p className="text-center text-sm text-slate-600">
              已有帳號？ <button type="button" className="text-blue-600 font-medium" onClick={() => { setForm('login'); setRegError(''); }}>返回登入</button>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
