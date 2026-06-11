'use client';

import { useEffect, useState } from 'react';
import { client as webauthnClient } from '@passwordless-id/webauthn';

export default function MobilePasskeyLoginPage() {
  const [message, setMessage] = useState('正在啟動 Passkey 登入...');

  useEffect(() => {
    async function run() {
      if (!webauthnClient.isAvailable()) throw new Error('此瀏覽器不支援 Passkey');

      const challengeRes = await fetch('/api/auth/passkey/challenge', { cache: 'no-store' });
      const { key, challenge, error: challengeError } = await challengeRes.json().catch(() => ({}));
      if (!challengeRes.ok || !key || !challenge) throw new Error(challengeError || '無法建立 Passkey 登入挑戰');

      setMessage('請完成裝置上的 Passkey 驗證...');
      const authentication = await webauthnClient.authenticate({
        challenge,
        userVerification: 'required',
        timeout: 60000,
      });

      const loginRes = await fetch('/api/auth/passkey/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authentication, challengeKey: key }),
      });
      const loginData = await loginRes.json().catch(() => ({}));
      if (!loginRes.ok) throw new Error(loginData.error || 'Passkey 登入失敗');

      setMessage('正在返回 App...');
      const ticketRes = await fetch('/api/app/auth-ticket', {
        method: 'POST',
        credentials: 'include',
      });
      const ticketData = await ticketRes.json().catch(() => ({}));
      if (!ticketRes.ok || !ticketData.ticket) throw new Error(ticketData.error || '無法建立 App 登入憑證');

      window.location.replace(`assetpilot://auth-ticket?ticket=${encodeURIComponent(ticketData.ticket)}`);
    }

    run().catch((e) => setMessage(e.message || 'Passkey 登入失敗'));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 24 }}>
      <h1>AssetPilot Passkey 登入</h1>
      <p>{message}</p>
    </main>
  );
}
