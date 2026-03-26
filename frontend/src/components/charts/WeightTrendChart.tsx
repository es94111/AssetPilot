import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface Props {
  data: Array<{ date: string; weight: number | null }>;
}

export default function WeightTrendChart({ data }: Props) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-48 text-text-muted text-sm">
        尚無體重紀錄
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
        <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#94A3B8" />
        <YAxis
          domain={['dataMin - 1', 'dataMax + 1']}
          tick={{ fontSize: 12 }}
          stroke="#94A3B8"
          unit=" kg"
        />
        <Tooltip
          contentStyle={{ borderRadius: 8, border: '1px solid #E2E8F0' }}
          formatter={(value: number) => [`${value} kg`, '體重']}
        />
        <Line
          type="monotone"
          dataKey="weight"
          stroke="#2563EB"
          strokeWidth={2}
          dot={{ r: 4, fill: '#2563EB' }}
          activeDot={{ r: 6 }}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
