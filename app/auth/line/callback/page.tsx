'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LineCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState('正在完成 LINE 驗證...');

  useEffect(() => {
    async function completeLineFlow() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const expectedState = window.sessionStorage.getItem('line_oauth_state');
      const flow = window.sessionStorage.getItem('line_oauth_flow') || 'login';

      window.sessionStorage.removeItem('line_oauth_state');
      window.sessionStorage.removeItem('line_oauth_flow');

      if (!code || !state || !expectedState || state !== expectedState) {
        throw new Error('LINE 登入狀態驗證失敗，請重新操作');
      }

      const redirectUri = `${window.location.origin}/auth/line/callback`;
      const endpoint = flow === 'link' ? '/api/account/link-line' : '/api/auth/line';
      const res = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, state, redirect_uri: redirectUri }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || (flow === 'link' ? 'LINE 綁定失敗' : 'LINE 登入失敗'));

      router.replace(flow === 'link' ? '/settings/account' : '/dashboard');
      router.refresh();
    }

    completeLineFlow().catch((e) => {
      setMessage(e.message || 'LINE 驗證失敗');
      setTimeout(() => router.replace('/login'), 1800);
    });
  }, [router]);

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 p-6 text-slate-700">
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        {message}
      </div>
    </div>
  );
}
