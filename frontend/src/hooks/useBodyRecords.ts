import { useState, useCallback } from 'react';
import api from '../lib/api';
import type { BodyRecord } from '../types';

export function useBodyRecords() {
  const [records, setRecords] = useState<BodyRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState<any[]>([]);

  const fetchRecords = useCallback(async (params?: { from?: string; to?: string; limit?: number }) => {
    setLoading(true);
    try {
      const { data } = await api.get('/body-records', { params });
      setRecords(data.records);
      setTotal(data.total);
    } finally { setLoading(false); }
  }, []);

  const fetchTrends = useCallback(async (from?: string, to?: string) => {
    const { data } = await api.get('/body-records/trends', { params: { from, to } });
    setTrends(data);
  }, []);

  const createRecord = useCallback(async (input: Partial<BodyRecord>) => {
    const { data } = await api.post('/body-records', input);
    setRecords((prev) => [data, ...prev]);
    return data;
  }, []);

  const updateRecord = useCallback(async (id: string, input: Partial<BodyRecord>) => {
    const { data } = await api.put(`/body-records/${id}`, input);
    setRecords((prev) => prev.map((r) => (r.id === id ? data : r)));
    return data;
  }, []);

  const deleteRecord = useCallback(async (id: string) => {
    await api.delete(`/body-records/${id}`);
    setRecords((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return { records, total, loading, trends, fetchRecords, fetchTrends, createRecord, updateRecord, deleteRecord };
}
