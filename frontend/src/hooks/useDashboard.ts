import { useState, useEffect, useCallback } from 'react';
import api from '../lib/api';
import type { DashboardSummary } from '../types';

export function useDashboard() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/dashboard/today');
      setData(data);
      setError(null);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '載入失敗');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refresh: fetch };
}
