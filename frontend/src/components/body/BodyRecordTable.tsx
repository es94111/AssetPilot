import { Trash2 } from 'lucide-react';
import type { BodyRecord } from '../../types';
import { formatDate } from '../../lib/utils';

interface Props {
  records: BodyRecord[];
  onDelete: (id: string) => void;
}

export default function BodyRecordTable({ records, onDelete }: Props) {
  if (!records.length) {
    return <p className="text-center text-text-muted py-8">尚無身體組成紀錄，點擊上方新增第一筆紀錄</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-2 font-medium text-text-muted">日期</th>
            <th className="text-right py-3 px-2 font-medium text-text-muted">體重</th>
            <th className="text-right py-3 px-2 font-medium text-text-muted">體脂</th>
            <th className="text-right py-3 px-2 font-medium text-text-muted">肌肉</th>
            <th className="text-right py-3 px-2 font-medium text-text-muted">腰圍</th>
            <th className="py-3 px-2"></th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-b border-gray-50 hover:bg-surface-hover transition-colors">
              <td className="py-3 px-2">{formatDate(r.recordedAt)}</td>
              <td className="text-right py-3 px-2">{r.weightKg ? `${r.weightKg} kg` : '-'}</td>
              <td className="text-right py-3 px-2">{r.bodyFatPct ? `${r.bodyFatPct}%` : '-'}</td>
              <td className="text-right py-3 px-2">{r.muscleMassKg ? `${r.muscleMassKg} kg` : '-'}</td>
              <td className="text-right py-3 px-2">{r.waistCm ? `${r.waistCm} cm` : '-'}</td>
              <td className="py-3 px-2">
                <button
                  onClick={() => onDelete(r.id)}
                  className="p-1.5 text-text-light hover:text-red-500 rounded transition-colors cursor-pointer"
                  aria-label="刪除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
