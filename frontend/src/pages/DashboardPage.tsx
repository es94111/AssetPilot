import { Scale, Flame, Droplets, Activity, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useDashboard } from '../hooks/useDashboard';
import WeightTrendChart from '../components/charts/WeightTrendChart';
import MacroDonutChart from '../components/charts/MacroDonutChart';
import QuickAddFab from '../components/dashboard/QuickAddFab';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, loading } = useDashboard();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const today = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-bold">
          {user?.name}，你好
        </h1>
        <p className="text-text-muted text-sm mt-1">{today}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          icon={Scale}
          label="體重"
          value={data?.weight ? `${data.weight}` : '--'}
          unit="kg"
          sub={data?.bodyFatPct ? `體脂 ${data.bodyFatPct}%` : undefined}
          color="text-primary"
        />
        <SummaryCard
          icon={Flame}
          label="今日熱量"
          value={`${data?.calories.consumed ?? 0}`}
          unit="kcal"
          sub={`目標 ${data?.calories.target ?? 2000} kcal`}
          color="text-cta"
          progress={data ? data.calories.consumed / data.calories.target : 0}
        />
        <SummaryCard
          icon={Activity}
          label="TDEE"
          value={data?.tdee ? `${data.tdee}` : '--'}
          unit="kcal"
          sub={data?.bmr ? `BMR ${data.bmr}` : '需完善個人資料'}
          color="text-green-500"
        />
        <SummaryCard
          icon={Droplets}
          label="飲水"
          value={`${data?.water.consumed ?? 0}`}
          unit="ml"
          sub={`目標 ${data?.water.target ?? 2000} ml`}
          color="text-blue-400"
          progress={data ? data.water.consumed / data.water.target : 0}
        />
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-heading font-semibold mb-3">體重趨勢（近 7 天）</h3>
          <WeightTrendChart data={data?.weightTrend ?? []} />
        </div>
        <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-heading font-semibold mb-3">今日巨量營養素</h3>
          <MacroDonutChart
            carbs={data?.macros.carbs ?? 0}
            protein={data?.macros.protein ?? 0}
            fat={data?.macros.fat ?? 0}
          />
        </div>
      </div>

      <QuickAddFab />
    </div>
  );
}

function SummaryCard({
  icon: Icon, label, value, unit, sub, color, progress,
}: {
  icon: any; label: string; value: string; unit: string; sub?: string; color: string; progress?: number;
}) {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs font-medium text-text-muted">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-text">{value}</span>
        <span className="text-sm text-text-muted">{unit}</span>
      </div>
      {sub && <p className="text-xs text-text-muted mt-1">{sub}</p>}
      {progress !== undefined && (
        <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
          <div
            className={`h-1.5 rounded-full transition-all duration-500 ${progress > 1 ? 'bg-red-400' : 'bg-primary'}`}
            style={{ width: `${Math.min(progress * 100, 100)}%` }}
          />
        </div>
      )}
    </div>
  );
}
