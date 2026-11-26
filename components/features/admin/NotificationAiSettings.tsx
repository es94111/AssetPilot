'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import { apiGet, apiPost, apiPut } from '@/lib/clientApi';

const path = '/api/admin/notification-ai';

interface Settings {
  endpoint: string;
  model: string;
  enabled: boolean;
  version: number;
  hasApiKey: boolean;
  canStoreKey: boolean;
}

export default function NotificationAiSettings({ canWrite }: { canWrite: boolean }) {
  const [saved, setSaved] = useState<Settings | null>(null);
  const [endpoint, setEndpoint] = useState('');
  const [model, setModel] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [key, setKey] = useState('');
  const [removeKey, setRemoveKey] = useState(false);
  const [busy, setBusy] = useState<'save' | 'test' | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    void apiGet(path).then((result: Settings) => {
      if (!active) return;
      setSaved(result);
      setEndpoint(result.endpoint);
      setModel(result.model);
      setEnabled(result.enabled);
    }).catch((failure: Error) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, []);

  const dirty = !!saved && (endpoint !== saved.endpoint || model !== saved.model || enabled !== saved.enabled || !!key || removeKey);
  const disabled = !canWrite || busy !== null;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!saved || disabled) return;
    setBusy('save');
    setError('');
    setMessage('');
    try {
      const result: Settings = await apiPut(path, {
        endpoint, model, enabled, version: saved.version,
        apiKey: removeKey ? null : key.trim() || undefined,
      });
      setSaved(result);
      setEndpoint(result.endpoint);
      setModel(result.model);
      setEnabled(result.enabled);
      setKey('');
      setRemoveKey(false);
      setMessage('已儲存辨識服務設定。');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '無法儲存設定。');
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy('test');
    setError('');
    setMessage('');
    try {
      await apiPost(path);
      setMessage('連線成功，已辨識範例消費通知。');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '無法測試連線。');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="rounded-xl border bg-card p-6 text-card-foreground shadow-sm" aria-labelledby="notification-ai-title">
      <h3 id="notification-ai-title" className="text-lg font-semibold">手機通知自動記帳</h3>
      <p className="mb-4 mt-1 text-sm text-muted-foreground">使用 OpenAI 相容的 Chat Completions API 辨識 iPhone 消費通知。</p>
      {error && <p role="alert" className="my-3 text-sm text-danger">{error}</p>}
      {message && <p role="status" className="my-3 text-sm">{message}</p>}
      {!saved && !error && <p role="status" className="text-sm">載入設定中…</p>}
      {saved && (
        <form onSubmit={save} className="space-y-4" aria-busy={busy !== null}>
          <Input label="API 網址" type="url" value={endpoint} onChange={(event) => setEndpoint(event.target.value)}
            disabled={disabled} required aria-describedby="notification-ai-url-hint" autoCapitalize="none" spellCheck={false} />
          <p id="notification-ai-url-hint" className="text-sm text-muted-foreground">輸入公開 HTTPS Base URL 或完整的 /chat/completions 網址。更換網址時請重新輸入 Key。</p>
          <Input label="模型名稱" value={model} onChange={(event) => setModel(event.target.value)}
            disabled={disabled} required maxLength={200} autoCapitalize="none" spellCheck={false} />
          <Input label="API Key" type="password" value={key} onChange={(event) => setKey(event.target.value)}
            disabled={disabled || !saved.canStoreKey || removeKey} maxLength={1024} autoComplete="new-password"
            aria-describedby="notification-ai-key-hint" />
          <p id="notification-ai-key-hint" className="text-sm text-muted-foreground">
            {!saved.canStoreKey ? '請先在伺服器設定 NOTIFICATION_AI_SETTINGS_KEY。' : saved.hasApiKey ? 'Key 已加密保存。留空保留目前的 Key。' : '尚未設定 Key。'}
          </p>
          {saved.hasApiKey && (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={removeKey} disabled={disabled} onChange={(event) => {
                setRemoveKey(event.target.checked);
                if (event.target.checked) { setEnabled(false); setKey(''); }
              }} />
              儲存時移除 API Key
            </label>
          )}
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={enabled} disabled={disabled || removeKey} onChange={(event) => setEnabled(event.target.checked)} />
            開放 iPhone 使用通知辨識
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" disabled={disabled || !dirty}>{busy === 'save' ? '儲存中…' : '儲存設定'}</Button>
            <Button type="button" variant="outline" disabled={disabled || dirty || !saved.hasApiKey || !saved.canStoreKey} onClick={test}>
              {busy === 'test' ? '測試中…' : '測試連線'}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">測試會使用已儲存的設定送出一則合成通知。可以在開放功能前完成測試。</p>
        </form>
      )}
    </section>
  );
}
