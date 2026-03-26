import { useState, useCallback } from 'react';
import api from '../lib/api';
import type { Food, MealLog } from '../types';

export function useDiet() {
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<any>(null);

  const searchFoods = useCallback(async (q: string) => {
    const { data } = await api.get('/diet/foods', { params: { q, perPage: 30 } });
    setFoods(data.foods);
    return data.foods;
  }, []);

  const getRecentFoods = useCallback(async () => {
    const { data } = await api.get('/diet/foods/recent');
    return data as Food[];
  }, []);

  const fetchMeals = useCallback(async (date: string) => {
    setLoading(true);
    try {
      const { data } = await api.get('/diet/meals', { params: { date } });
      setMeals(data);
    } finally { setLoading(false); }
  }, []);

  const createMeal = useCallback(async (input: { date: string; mealType: string; foodId: string; quantityG: number; note?: string }) => {
    const { data } = await api.post('/diet/meals', input);
    setMeals((prev) => [...prev, data]);
    return data;
  }, []);

  const deleteMeal = useCallback(async (id: string) => {
    await api.delete(`/diet/meals/${id}`);
    setMeals((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const fetchSummary = useCallback(async (date: string) => {
    const { data } = await api.get('/diet/meals/summary', { params: { date } });
    setSummary(data);
    return data;
  }, []);

  return { meals, foods, loading, summary, searchFoods, getRecentFoods, fetchMeals, createMeal, deleteMeal, fetchSummary };
}
