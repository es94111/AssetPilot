import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface Props {
  carbs: number;
  protein: number;
  fat: number;
}

const COLORS = ['#F97316', '#2563EB', '#10B981'];
const LABELS = ['碳水', '蛋白質', '脂肪'];

export default function MacroDonutChart({ carbs, protein, fat }: Props) {
  const total = carbs * 4 + protein * 4 + fat * 9;
  const data = [
    { name: '碳水', value: carbs, kcal: carbs * 4 },
    { name: '蛋白質', value: protein, kcal: protein * 4 },
    { name: '脂肪', value: fat, kcal: fat * 9 },
  ];

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-text-muted text-sm">
        尚無飲食紀錄
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={75}
          paddingAngle={2}
          dataKey="kcal"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: number, name: string, entry: any) => [
            `${entry.payload.value}g (${value} kcal)`,
            name,
          ]}
        />
        <Legend
          formatter={(value, entry: any) => {
            const item = data.find((d) => d.name === value);
            return `${value} ${item?.value || 0}g`;
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
