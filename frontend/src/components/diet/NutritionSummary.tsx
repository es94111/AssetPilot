import MacroDonutChart from '../charts/MacroDonutChart';

interface Props {
  calories: number;
  calorieTarget: number;
  carbs: number;
  protein: number;
  fat: number;
}

export default function NutritionSummary({ calories, calorieTarget, carbs, protein, fat }: Props) {
  const pct = calorieTarget > 0 ? Math.round((calories / calorieTarget) * 100) : 0;

  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <h3 className="font-heading font-semibold mb-3">營養素摘要</h3>

      <div className="text-center mb-3">
        <div className="text-2xl font-bold text-text">{calories}</div>
        <div className="text-sm text-text-muted">/ {calorieTarget} kcal ({pct}%)</div>
        <div className="w-full bg-gray-100 rounded-full h-2 mt-2">
          <div
            className="bg-cta h-2 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
      </div>

      <MacroDonutChart carbs={carbs} protein={protein} fat={fat} />

      <div className="grid grid-cols-3 gap-2 mt-3 text-center text-sm">
        <div>
          <div className="font-medium text-[#F97316]">{carbs.toFixed(1)}g</div>
          <div className="text-text-muted text-xs">碳水</div>
        </div>
        <div>
          <div className="font-medium text-[#2563EB]">{protein.toFixed(1)}g</div>
          <div className="text-text-muted text-xs">蛋白質</div>
        </div>
        <div>
          <div className="font-medium text-[#10B981]">{fat.toFixed(1)}g</div>
          <div className="text-text-muted text-xs">脂肪</div>
        </div>
      </div>
    </div>
  );
}
