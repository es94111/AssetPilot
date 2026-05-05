'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiGet } from '../../../lib/clientApi';

export default function ApiCreditsClient() {
  const [apis, setApis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiGet('/api/external-apis');
      setApis(data.apis || []);
    } catch (e) {
      setError(e.message || '載入失敗');
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="page active">
      <h2 className="page-title">API 使用與授權</h2>

      {loading && <p className="empty-hint">載入中...</p>}
      {error && <p className="empty-hint" style={{ color: 'var(--danger)' }}>載入失敗：{error}</p>}

      {!loading && !error && apis.length === 0 && (
        <p className="empty-hint">無 API 使用資訊</p>
      )}

      {!loading && !error && apis.length > 0 && (
        <div className="external-apis-list">
          {apis.map((api, i) => (
            <div key={i} className="card external-api-card" style={{ marginBottom: '1rem' }}>
              <h3 style={{ marginBottom: '0.5rem' }}>{api.name}</h3>
              {api.description && <p style={{ color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>{api.description}</p>}
              {api.url && (
                <a href={api.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', wordBreak: 'break-all' }}>
                  {api.url}
                </a>
              )}
              <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {api.supportsFree && <span className="badge badge-income">免費</span>}
                {api.supportsPaid && <span className="badge">付費</span>}
              </div>
              {api.attribution && (
                <div style={{ marginTop: '0.5rem', color: '#c0392b', fontWeight: 'bold' }}>
                  {api.attribution}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
