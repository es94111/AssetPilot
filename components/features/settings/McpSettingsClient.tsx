'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPost, apiDelete, apiPatch } from '@/lib/clientApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import { useT } from '@/components/i18n/I18nProvider';
import { localeTag } from '@/lib/i18n/localeTag';

interface McpCredential {
  id: string;
  name: string;
  status: 'active' | 'expired' | 'revoked';
  allowCreate: boolean;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
}

function statusBadgeClass(status: McpCredential['status']): string {
  if (status === 'active') return 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300';
  if (status === 'expired') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300';
  return 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
}

export default function McpSettingsClient() {
  const { locale, t } = useT();
  const dateLocale = localeTag(locale);
  const ta = (key: string, vars?: Record<string, string | number>) => t(`settings.mcp.${key}`, vars);

  const [credentials, setCredentials] = useState<McpCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [listMsg, setListMsg] = useState('');

  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [newToken, setNewToken] = useState('');
  const [copied, setCopied] = useState(false);
  const [oauthCopied, setOauthCopied] = useState(false);
  const [connectionUrl, setConnectionUrl] = useState('/api/mcp');

  useEffect(() => {
    setConnectionUrl(`${window.location.origin}/api/mcp`);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/user/mcp-credentials');
      setCredentials(res.credentials || []);
    } catch (e: any) {
      setListMsg(e.message || ta('loadFailed'));
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    const trimmed = name.trim();
    if (!trimmed) { setCreateError(ta('nameRequired')); return; }
    if (trimmed.length > 100) { setCreateError(ta('nameTooLong')); return; }

    setCreating(true);
    try {
      const body: { name: string; expiresAt?: string } = { name: trimmed };
      if (expiresAt) body.expiresAt = new Date(expiresAt).toISOString();
      const res = await apiPost('/api/user/mcp-credentials', body);
      setNewToken(res.token);
      setCopied(false);
      setName('');
      setExpiresAt('');
      await load();
    } catch (e: any) {
      setCreateError(e.message || ta('createFailed'));
    }
    setCreating(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(newToken);
      setCopied(true);
    } catch (_) {
      setCopied(true);
    }
  }

  async function handleOAuthCopy() {
    try {
      await navigator.clipboard.writeText(connectionUrl);
    } finally {
      setOauthCopied(true);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm(ta('revokeConfirm'))) return;
    setListMsg('');
    try {
      await apiDelete(`/api/user/mcp-credentials/${encodeURIComponent(id)}`);
      setCredentials((prev) => prev.map((c) => (c.id === id ? { ...c, status: 'revoked' } : c)));
    } catch (e: any) {
      setListMsg(e.message || ta('revokeFailed'));
    }
  }

  async function handleAllowCreateChange(id: string, next: boolean) {
    setListMsg('');
    try {
      const res = await apiPatch(`/api/user/mcp-credentials/${encodeURIComponent(id)}`, { allowCreate: next });
      setCredentials((prev) => prev.map((c) => (c.id === id ? { ...c, allowCreate: res.credential.allowCreate } : c)));
    } catch (e: any) {
      setListMsg(e.message || ta('allowCreateUpdateFailed'));
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{ta('title')}</h2>
      <p className="text-sm text-slate-500">{ta('description')}</p>

      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold mb-2">{ta('oauthTitle')}</h3>
        <p className="text-sm text-slate-500 mb-4">{ta('oauthDescription')}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <code className="min-w-0 flex-1 p-3 bg-slate-100 dark:bg-slate-800 rounded-md text-xs break-all">
            {connectionUrl}
          </code>
          <Button onClick={handleOAuthCopy} variant="outline">
            {oauthCopied ? ta('copied') : ta('copyButton')}
          </Button>
        </div>
      </div>

      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <h3 className="text-lg font-semibold mb-4">{ta('createNew')}</h3>
        <form onSubmit={handleCreate} className="space-y-4 max-w-md">
          <Input label={ta('nameLabel')} value={name} onChange={(e) => setName(e.target.value)} placeholder={ta('namePlaceholder')} maxLength={100} />
          <Input label={ta('expiresAtLabel')} type="datetime-local" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
          {createError && <div className="text-red-500 text-sm">{createError}</div>}
          <Button type="submit" disabled={creating}>{creating ? ta('creating') : ta('createButton')}</Button>
        </form>
      </div>

      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{ta('listTitle')}</h3>
          <Button variant="outline" onClick={load}>{ta('refresh')}</Button>
        </div>
        {listMsg && <p className="text-sm text-red-500 mb-3">{listMsg}</p>}
        {loading ? (
          <p className="text-slate-500">{t('common.loading')}</p>
        ) : credentials.length === 0 ? (
          <p className="text-slate-500 text-sm">{ta('noCredentials')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="text-left py-2 pr-4">{ta('colName')}</th>
                  <th className="text-left py-2 pr-4">{ta('colCreatedAt')}</th>
                  <th className="text-left py-2 pr-4">{ta('colLastUsedAt')}</th>
                  <th className="text-left py-2 pr-4">{ta('colStatus')}</th>
                  <th className="text-left py-2 pr-4">{ta('colAllowCreate')}</th>
                  <th className="text-left py-2">{ta('colActions')}</th>
                </tr>
              </thead>
              <tbody>
                {credentials.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{c.name}</td>
                    <td className="py-3 pr-4">{new Date(c.createdAt).toLocaleString(dateLocale)}</td>
                    <td className="py-3 pr-4">{c.lastUsedAt ? new Date(c.lastUsedAt).toLocaleString(dateLocale) : ta('neverUsed')}</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadgeClass(c.status)}`}>
                        {ta(`status.${c.status}`)}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      {c.status === 'active' && (
                        <input
                          type="checkbox"
                          checked={c.allowCreate}
                          onChange={(e) => handleAllowCreateChange(c.id, e.target.checked)}
                          aria-label={ta('allowCreateLabel')}
                          className="w-4 h-4"
                        />
                      )}
                    </td>
                    <td className="py-3">
                      {c.status === 'active' && (
                        <Button variant="outline" onClick={() => handleRevoke(c.id)} className="text-red-500 hover:text-red-700">
                          {ta('revokeButton')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal open={!!newToken} onClose={() => { if (copied) setNewToken(''); }} title={ta('tokenModalTitle')}>
        <div className="space-y-4">
          <p className="text-sm text-amber-600">{ta('tokenWarning')}</p>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">{ta('tokenLabel')}</label>
            <code className="block p-3 bg-slate-100 dark:bg-slate-800 rounded-md text-xs break-all">{newToken}</code>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-600 mb-1">{ta('connectionUrlLabel')}</label>
            <code className="block p-3 bg-slate-100 dark:bg-slate-800 rounded-md text-xs break-all">{connectionUrl}</code>
          </div>
          <Button onClick={handleCopy} variant="outline">{copied ? ta('copied') : ta('copyButton')}</Button>
          <div className="flex justify-end pt-2">
            <Button onClick={() => setNewToken('')} disabled={!copied}>{ta('closeConfirm')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
