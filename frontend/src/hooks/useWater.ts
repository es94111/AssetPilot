import { useState, useCallback } from 'react';
import api from '../lib/api';
import type { WaterLog } from '../types';

export function useWater() {
  const [logs, setLogs] = useState<WaterLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchByDate = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const { data } = await api.get('/water', { params: { date } });
      setLogs(data.logs);
      setTotal(data.total);
    } finally { setLoading(false); }
  }, []);

  const addWater = useCallback(async (amountMl: number) => {
    const { data } = await api.post('/water', { amountMl });
    setLogs((prev) => [data, ...prev]);
    setTotal((prev) => prev + amountMl);
    return data;
  }, []);

  const deleteWater = useCallback(async (id: string, amountMl: number) => {
    await api.delete(`/water/${id}`);
    setLogs((prev) => prev.filter((l) => l.id !== id));
    setTotal((prev) => prev - amountMl);
  }, []);

  return { logs, total, loading, fetchByDate, addWater, deleteWater };
}
