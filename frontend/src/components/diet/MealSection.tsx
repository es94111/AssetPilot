import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2, Coffee, Sun, Moon, Cookie } from 'lucide-react';
import type { MealLog } from '../../types';
import { cn } from '../../lib/utils';

const MEAL_ICONS = {
  BREAKFAST: Coffee,
  LUNCH: Sun,
  DINNER: Moon,
  SNACK: Cookie,
};

const MEAL_LABELS: Record<string, string> = {
  BREAKFAST: '早餐',
  LUNCH: '午餐',
  DINNER: '晚餐',
  SNACK: '點心',
};

interface Props {
  mealType: string;
  meals: MealLog[];
  onAddFood: () => void;
  onDeleteMeal: (id: string) => void;
}

export default function MealSection({ mealType, meals, onAddFood, onDeleteMeal }: Props) {
  const [expanded, setExpanded] = useState(true);
  const Icon = MEAL_ICONS[mealType as keyof typeof MEAL_ICONS] || Coffee;
  const totalCal = meals.reduce((s, m) => s + m.caloriesKcal, 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-surface-hover transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-primary" />
          <span className="font-medium">{MEAL_LABELS[mealType]}</span>
          <span className="text-sm text-text-muted">({meals.length} 項)</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-cta">{Math.round(totalCal)} kcal</span>
          {expanded ? <ChevronUp className="w-4 h-4 text-text-muted" /> : <ChevronDown className="w-4 h-4 text-text-muted" />}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-gray-50">
          {meals.map((m) => (
            <div key={m.id} className="flex items-center justify-between px-4 py-3 hover:bg-surface-hover transition-colors">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{m.foodName}</div>
                <div className="text-xs text-text-muted">{m.quantityG}g</div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-text-muted">{Math.round(m.caloriesKcal)} kcal</span>
                <button
                  onClick={() => onDeleteMeal(m.id)}
                  className="p-1 text-text-light hover:text-red-500 rounded transition-colors cursor-pointer"
                  aria-label="刪除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}

          <button
            onClick={onAddFood}
            className="w-full flex items-center justify-center gap-2 p-3 text-sm text-primary hover:bg-primary/5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            新增食物
          </button>
        </div>
      )}
    </div>
  );
}
