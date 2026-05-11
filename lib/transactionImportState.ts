// 交易類匯入共用鎖與進度狀態
// 由 transactions/import、categories/import 共享；imports/progress 用於前端輪詢
export type ImportProgressPhase = 'parsing' | 'validating' | 'auto_create' | 'writing' | 'pairing' | 'finalizing';

export interface ImportProgressState {
  processed: number;
  total?: number;
  phase: ImportProgressPhase | string;
  startedAt?: number;
  completedAt: number | null;
}

export const importLocks = new Set<string>();
export const importProgress = new Map<string, ImportProgressState>();
