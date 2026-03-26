import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useDiet } from '../hooks/useDiet';
import { useWater } from '../hooks/useWater';
import { useAuth } from '../context/AuthContext';
import MealSection from '../components/diet/MealSection';
import FoodSearchDialog from '../components/diet/FoodSearchDialog';
import NutritionSummary from '../components/diet/NutritionSummary';
import WaterTracker from '../components/diet/WaterTracker';
import { todayString } from '../lib/utils';
import type { Food } from '../types';

const MEAL_ORDER = ['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'] as const;

export default function DietPage() {
  const { user } = useAuth();
  const { meals, loading, searchFoods, fetchMeals, createMeal, deleteMeal, fetchSummary, summary } = useDiet();
  const { logs: waterLogs, total: waterTotal, fetchByDate: fetchWater, addWater, deleteWater } = useWater();
  const [date, setDate] = useState(todayString);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeMealType, setActiveMealType] = useState<string>('BREAKFAST');

  const loadAll = useCallback(() => {
    fetchMeals(date);
    fetchSummary(date);
    fetchWater(date);
  }, [date, fetchMeals, fetchSummary, fetchWater]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const changeDate = (offset: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + offset);
    setDate(d.toISOString().split('T')[0]);
  };

  const handleAddFood = (mealType: string) => {
    setActiveMealType(mealType);
    setDialogOpen(true);
  };

  const handleSelectFood = async (food: Food, quantityG: number) => {
    await createMeal({ date, mealType: activeMealType, foodId: food.id, quantityG });
    fetchSummary(date);
  };

  const handleDeleteMeal = async (id: string) => {
    await deleteMeal(id);
    fetchSummary(date);
  };

  const isToday = date === todayString();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">飲食紀錄</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => changeDate(-1)} className="p-2 hover:bg-surface-hover rounded-lg cursor-pointer" aria-label="前一天">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-sm font-medium min-w-[100px] text-center">
            {isToday ? '今天' : new Date(date).toLocaleDateString('zh-TW', { month: 'long', day: 'numeric' })}
          </span>
          <button onClick={() => changeDate(1)} className="p-2 hover:bg-surface-hover rounded-lg cursor-pointer" aria-label="後一天">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Meals - 2 columns */}
          <div className="lg:col-span-2 space-y-4">
            {MEAL_ORDER.map((type) => (
              <MealSection
                key={type}
                mealType={type}
                meals={meals.filter((m) => m.mealType === type)}
                onAddFood={() => handleAddFood(type)}
                onDeleteMeal={handleDeleteMeal}
              />
            ))}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <NutritionSummary
              calories={summary?.totalCalories ?? 0}
              calorieTarget={user?.dailyCalorieTarget ?? 2000}
              carbs={summary?.totalCarbs ?? 0}
              protein={summary?.totalProtein ?? 0}
              fat={summary?.totalFat ?? 0}
            />
            <WaterTracker
              logs={waterLogs}
              total={waterTotal}
              target={user?.dailyWaterTargetMl ?? 2000}
              onAdd={addWater}
              onDelete={deleteWater}
            />
          </div>
        </div>
      )}

      <FoodSearchDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSelect={handleSelectFood}
        onSearch={searchFoods}
        mealType={activeMealType}
      />
    </div>
  );
}
