'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/components/i18n/I18nProvider';
import { safeOAuthReturnTo } from '@/lib/loginReturn';

export default function LineCallbackPage() {
  const router = useRouter();
  const { t } = useT();
  const [message, setMessage] = useState(t('auth.lineCallback.completing'));

  useEffect(() => {
    async function completeLineFlow() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const flow = state?.startsWith('link.') ? 'link' : 'login';

      if (!code || !state) {
        throw new Error(t('auth.lineCallback.missingCode'));
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
      if (!res.ok) throw new Error(data.error || (flow === 'link' ? t('auth.lineCallback.linkFailed') : t('auth.lineCallback.loginFailed')));

      const returnTo = safeOAuthReturnTo(data.returnTo);
      router.replace(flow === 'link' ? '/settings/account' : (returnTo || '/dashboard'));
      router.refresh();
    }

    completeLineFlow().catch((e) => {
      setMessage(e.message || t('auth.lineCallback.verifyFailed'));
      setTimeout(() => router.replace('/login'), 1800);
    });
  }, [router, t]);

  return (
    <div className="min-h-screen grid place-items-center bg-slate-50 p-6 text-slate-700">
      <div className="rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        {message}
      </div>
    </div>
  );
}
