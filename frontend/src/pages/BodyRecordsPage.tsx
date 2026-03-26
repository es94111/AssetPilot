import { useState, useEffect } from 'react';
import { Plus, Minus, Loader2 } from 'lucide-react';
import { useBodyRecords } from '../hooks/useBodyRecords';
import WeightTrendChart from '../components/charts/WeightTrendChart';
import BodyRecordForm from '../components/body/BodyRecordForm';
import BodyRecordTable from '../components/body/BodyRecordTable';

const RANGES = [
  { label: '7天', days: 7 },
  { label: '30天', days: 30 },
  { label: '90天', days: 90 },
  { label: '1年', days: 365 },
];

export default function BodyRecordsPage() {
  const { records, loading, trends, fetchRecords, fetchTrends, createRecord, deleteRecord } = useBodyRecords();
  const [showForm, setShowForm] = useState(false);
  const [range, setRange] = useState(30);

  useEffect(() => {
    const from = new Date();
    from.setDate(from.getDate() - range);
    fetchRecords({ from: from.toISOString(), limit: 100 });
    fetchTrends(from.toISOString());
  }, [range, fetchRecords, fetchTrends]);

  const trendData = trends.map((t: any) => ({
    date: new Date(t.recordedAt).toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit' }),
    weight: t.weightKg,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-2xl font-bold">身體紀錄</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors cursor-pointer"
        >
          {showForm ? <Minus className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? '收起' : '新增紀錄'}
        </button>
      </div>

      {showForm && (
        <BodyRecordForm
          onSubmit={async (data) => { await createRecord(data); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {/* Trend Chart */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading font-semibold">體重趨勢</h3>
          <div className="flex gap-1">
            {RANGES.map(({ label, days }) => (
              <button
                key={days}
                onClick={() => setRange(days)}
                className={`px-3 py-1 text-xs rounded-full transition-colors cursor-pointer ${
                  range === days
                    ? 'bg-primary text-white'
                    : 'text-text-muted hover:bg-surface-hover'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <WeightTrendChart data={trendData} />
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <h3 className="font-heading font-semibold mb-4">紀錄列表</h3>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <BodyRecordTable records={records} onDelete={deleteRecord} />
        )}
      </div>
    </div>
  );
}
