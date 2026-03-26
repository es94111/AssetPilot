import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { BodyRecord } from '../../types';

interface Props {
  onSubmit: (data: Partial<BodyRecord>) => Promise<void>;
  initialData?: Partial<BodyRecord>;
  onCancel?: () => void;
}

export default function BodyRecordForm({ onSubmit, initialData, onCancel }: Props) {
  const [form, setForm] = useState({
    weightKg: initialData?.weightKg ?? '',
    bodyFatPct: initialData?.bodyFatPct ?? '',
    muscleMassKg: initialData?.muscleMassKg ?? '',
    waistCm: initialData?.waistCm ?? '',
    hipCm: initialData?.hipCm ?? '',
    chestCm: initialData?.chestCm ?? '',
  });
  const [showMore, setShowMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const data: any = {};
      if (form.weightKg !== '') data.weightKg = Number(form.weightKg);
      if (form.bodyFatPct !== '') data.bodyFatPct = Number(form.bodyFatPct);
      if (form.muscleMassKg !== '') data.muscleMassKg = Number(form.muscleMassKg);
      if (form.waistCm !== '') data.waistCm = Number(form.waistCm);
      if (form.hipCm !== '') data.hipCm = Number(form.hipCm);
      if (form.chestCm !== '') data.chestCm = Number(form.chestCm);
      await onSubmit(data);
      setForm({ weightKg: '', bodyFatPct: '', muscleMassKg: '', waistCm: '', hipCm: '', chestCm: '' });
    } finally { setSubmitting(false); }
  };

  const input = (label: string, key: keyof typeof form, unit: string) => (
    <div>
      <label className="block text-sm font-medium text-text-muted mb-1">{label}</label>
      <div className="relative">
        <input
          type="number"
          step="0.1"
          value={form[key]}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary text-sm"
          placeholder={`輸入${label}`}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-muted">{unit}</span>
      </div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <h3 className="font-heading font-semibold text-lg mb-4">新增紀錄</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {input('體重', 'weightKg', 'kg')}
        {input('體脂率', 'bodyFatPct', '%')}
        {input('肌肉量', 'muscleMassKg', 'kg')}
      </div>

      <button
        type="button"
        onClick={() => setShowMore(!showMore)}
        className="flex items-center gap-1 mt-3 text-sm text-primary cursor-pointer hover:underline"
      >
        身體圍度 {showMore ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {showMore && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-3">
          {input('胸圍', 'chestCm', 'cm')}
          {input('腰圍', 'waistCm', 'cm')}
          {input('臀圍', 'hipCm', 'cm')}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 bg-primary text-white rounded-lg font-medium text-sm hover:bg-primary-dark transition-colors duration-200 disabled:opacity-50 cursor-pointer"
        >
          {submitting ? '儲存中...' : '儲存'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="px-5 py-2.5 text-text-muted hover:bg-surface-hover rounded-lg text-sm cursor-pointer">
            取消
          </button>
        )}
      </div>
    </form>
  );
}
