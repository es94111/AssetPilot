import { useState, useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';
import type { Food } from '../../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onSelect: (food: Food, quantityG: number) => void;
  onSearch: (q: string) => Promise<Food[]>;
  mealType: string;
}

const PRESETS = [50, 100, 150, 200, 300];

export default function FoodSearchDialog({ open, onClose, onSelect, onSearch }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [selected, setSelected] = useState<Food | null>(null);
  const [quantity, setQuantity] = useState(100);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setResults([]);
      setSelected(null);
      setQuantity(100);
    }
  }, [open]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (query.length >= 1) {
      timerRef.current = setTimeout(async () => {
        setSearching(true);
        const foods = await onSearch(query);
        setResults(foods);
        setSearching(false);
      }, 300);
    } else {
      setResults([]);
    }
    return () => clearTimeout(timerRef.current);
  }, [query, onSearch]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white w-full md:max-w-lg md:rounded-xl rounded-t-xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-heading font-semibold">搜尋食物</h3>
          <button onClick={onClose} className="p-1 hover:bg-surface-hover rounded cursor-pointer" aria-label="關閉">
            <X className="w-5 h-5" />
          </button>
        </div>

        {!selected ? (
          <>
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="輸入食物名稱..."
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {searching && <p className="text-center text-text-muted py-4 text-sm">搜尋中...</p>}
              {!searching && query && !results.length && (
                <p className="text-center text-text-muted py-4 text-sm">找不到相關食物</p>
              )}
              {results.map((food) => (
                <button
                  key={food.id}
                  onClick={() => setSelected(food)}
                  className="w-full flex items-center justify-between p-3 hover:bg-surface-hover rounded-lg transition-colors cursor-pointer text-left"
                >
                  <div>
                    <div className="font-medium text-sm">{food.name}</div>
                    <div className="text-xs text-text-muted">{food.category}</div>
                  </div>
                  <span className="text-sm text-cta font-medium">{food.caloriesPer100g} kcal/100g</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="p-4 space-y-4">
            <div>
              <div className="font-medium">{selected.name}</div>
              <div className="text-sm text-text-muted mt-1">
                每 100g：{selected.caloriesPer100g} kcal | 碳 {selected.carbsG}g | 蛋白 {selected.proteinG}g | 脂 {selected.fatG}g
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-muted mb-2">份量（克）</label>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              />
              <div className="flex gap-2 mt-2">
                {PRESETS.map((g) => (
                  <button
                    key={g}
                    onClick={() => setQuantity(g)}
                    className="px-3 py-1.5 text-xs rounded-full border border-gray-200 hover:bg-primary hover:text-white hover:border-primary transition-colors cursor-pointer"
                  >
                    {g}g
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-surface rounded-lg p-3 text-sm">
              <div className="font-medium mb-1">本次攝取估算（{quantity}g）</div>
              <div className="grid grid-cols-4 gap-2 text-text-muted">
                <div>{Math.round(selected.caloriesPer100g * quantity / 100)} kcal</div>
                <div>碳 {(selected.carbsG * quantity / 100).toFixed(1)}g</div>
                <div>蛋白 {(selected.proteinG * quantity / 100).toFixed(1)}g</div>
                <div>脂 {(selected.fatG * quantity / 100).toFixed(1)}g</div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setSelected(null)}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm hover:bg-surface-hover transition-colors cursor-pointer"
              >
                返回搜尋
              </button>
              <button
                onClick={() => { onSelect(selected, quantity); onClose(); }}
                className="flex-1 py-2.5 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors cursor-pointer"
              >
                新增
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
