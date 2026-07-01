'use client';

import { useEffect, useState } from 'react';
import { client as webauthnClient } from '@passwordless-id/webauthn';
import { useT } from '@/components/i18n/I18nProvider';

export default function MobilePasskeyLoginPage() {
  const { t } = useT();
  const [message, setMessage] = useState(t('public.appCallback.passkeyStarting'));

  useEffect(() => {
    async function run() {
      const params = new URLSearchParams(window.location.search);
      const turnstileToken = params.get('turnstileToken') || '';
      if (!webauthnClient.isAvailable()) throw new Error(t('public.appCallback.passkeyUnsupported'));

      const challengeRes = await fetch('/api/auth/passkey/challenge', { cache: 'no-store' });
      const { key, challenge, error: challengeError } = await challengeRes.json().catch(() => ({}));
      if (!challengeRes.ok || !key || !challenge) throw new Error(challengeError || t('public.appCallback.passkeyChallengeFailed'));

      setMessage(t('public.appCallback.passkeyVerify'));
      const authentication = await webauthnClient.authenticate({
        challenge,
        userVerification: 'required',
        timeout: 60000,
      });

      const loginRes = await fetch('/api/auth/passkey/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authentication, challengeKey: key, turnstileToken }),
      });
      const loginData = await loginRes.json().catch(() => ({}));
      if (!loginRes.ok) throw new Error(loginData.error || t('public.appCallback.passkeyLoginFailed'));

      setMessage(t('public.appCallback.returningApp'));
      const ticketRes = await fetch('/api/app/auth-ticket', {
        method: 'POST',
        credentials: 'include',
      });
      const ticketData = await ticketRes.json().catch(() => ({}));
      if (!ticketRes.ok || !ticketData.ticket) throw new Error(ticketData.error || t('public.appCallback.appTicketFailed'));

      window.location.replace(`assetpilot://auth-ticket?ticket=${encodeURIComponent(ticketData.ticket)}`);
    }

    run().catch((e) => setMessage(e.message || t('public.appCallback.passkeyLoginFailed')));
  }, [t]);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>{t('public.appCallback.passkeyTitle')}</h1>
      <p>{message}</p>
    </main>
  );
}
