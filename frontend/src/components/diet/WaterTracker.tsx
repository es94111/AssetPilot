import { Trash2, Droplets } from 'lucide-react';
import WaterProgressRing from '../charts/WaterProgressRing';
import type { WaterLog } from '../../types';
import { WATER_PRESETS } from '../../lib/constants';
import { formatDateTime } from '../../lib/utils';

interface Props {
  logs: WaterLog[];
  total: number;
  target: number;
  onAdd: (ml: number) => void;
  onDelete: (id: string, ml: number) => void;
}

export default function WaterTracker({ logs, total, target, onAdd, onDelete }: Props) {
  return (
    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-4">
        <Droplets className="w-5 h-5 text-primary-light" />
        <h3 className="font-heading font-semibold">飲水紀錄</h3>
      </div>

      <div className="flex flex-col items-center mb-4">
        <WaterProgressRing current={total} target={target} />
      </div>

      <div className="flex justify-center gap-2 mb-4">
        {WATER_PRESETS.map((ml) => (
          <button
            key={ml}
            onClick={() => onAdd(ml)}
            className="px-3 py-2 text-sm rounded-lg border border-primary/30 text-primary hover:bg-primary hover:text-white transition-colors duration-200 cursor-pointer"
          >
            +{ml}ml
          </button>
        ))}
      </div>

      {logs.length > 0 && (
        <div className="max-h-32 overflow-y-auto space-y-1">
          {logs.map((log) => (
            <div key={log.id} className="flex items-center justify-between text-sm py-1.5">
              <span className="text-text-muted">{formatDateTime(log.loggedAt)}</span>
              <div className="flex items-center gap-2">
                <span>{log.amountMl} ml</span>
                <button
                  onClick={() => onDelete(log.id, log.amountMl)}
                  className="p-1 text-text-light hover:text-red-500 rounded cursor-pointer"
                  aria-label="刪除"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
