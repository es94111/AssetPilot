'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet, apiPatch } from '@/lib/clientApi';
import { Button } from '@/components/ui/button';
import { useT } from '@/components/i18n/I18nProvider';
import { localeTag } from '@/lib/i18n/localeTag';

interface McpOAuthConnection {
  clientId: string;
  clientName: string;
  allowCreate: boolean;
  firstConnectedAt: string;
  lastUsedAt: string;
}

export default function McpConnectionsClient() {
  const { locale, t } = useT();
  const dateLocale = localeTag(locale);
  const ta = (key: string, vars?: Record<string, string | number>) => t(`settings.mcpConnections.${key}`, vars);

  const [connections, setConnections] = useState<McpOAuthConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [listMsg, setListMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/user/mcp-oauth-connections');
      setConnections(res.connections || []);
    } catch (e: any) {
      setListMsg(e.message || ta('loadFailed'));
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleAllowCreateChange(clientId: string, next: boolean) {
    setListMsg('');
    try {
      const res = await apiPatch(`/api/user/mcp-oauth-connections/${encodeURIComponent(clientId)}`, { allowCreate: next });
      setConnections((prev) => prev.map((c) => (c.clientId === clientId ? { ...c, allowCreate: res.connection.allowCreate } : c)));
    } catch (e: any) {
      setListMsg(e.message || ta('updateFailed'));
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">{ta('title')}</h2>
      <p className="text-sm text-slate-500">{ta('description')}</p>

      <div className="p-6 bg-white border border-slate-200 dark:bg-slate-900 dark:border-slate-800 rounded-xl shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">{ta('listTitle')}</h3>
          <Button variant="outline" onClick={load}>{ta('refresh')}</Button>
        </div>
        {listMsg && <p className="text-sm text-red-500 mb-3">{listMsg}</p>}
        {loading ? (
          <p className="text-slate-500">{t('common.loading')}</p>
        ) : connections.length === 0 ? (
          <p className="text-slate-500 text-sm">{ta('noConnections')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-slate-500">
                  <th className="text-left py-2 pr-4">{ta('colClientName')}</th>
                  <th className="text-left py-2 pr-4">{ta('colFirstConnectedAt')}</th>
                  <th className="text-left py-2 pr-4">{ta('colLastUsedAt')}</th>
                  <th className="text-left py-2">{ta('colAllowCreate')}</th>
                </tr>
              </thead>
              <tbody>
                {connections.map((c) => (
                  <tr key={c.clientId} className="border-b last:border-0">
                    <td className="py-3 pr-4 font-medium">{c.clientName}</td>
                    <td className="py-3 pr-4">{new Date(c.firstConnectedAt).toLocaleString(dateLocale)}</td>
                    <td className="py-3 pr-4">{new Date(c.lastUsedAt).toLocaleString(dateLocale)}</td>
                    <td className="py-3">
                      <input
                        type="checkbox"
                        checked={c.allowCreate}
                        onChange={(e) => handleAllowCreateChange(c.clientId, e.target.checked)}
                        aria-label={ta('allowCreateLabel')}
                        className="w-4 h-4"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
