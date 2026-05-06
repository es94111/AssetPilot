// 交易類匯入共用鎖與進度狀態
// 由 transactions/import、categories/import 共享；imports/progress 用於前端輪詢
export const importLocks = new Set();
export const importProgress = new Map();
