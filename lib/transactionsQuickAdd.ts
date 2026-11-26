// 交易記錄頁的網址約定：action=add 會開啟新增對話框，其餘查詢參數（page、limit、篩選）是列表狀態。
export const TRANSACTIONS_PATH = '/finance/transactions';

/**
 * 交易記錄頁「快速新增」的網址。傳入交易記錄頁目前的查詢字串時保留頁碼、每頁筆數與篩選，
 * 只加上 action=add，新增後才不會回到第 1 頁。
 */
export function transactionsQuickAddHref(currentQuery = '') {
  const params = new URLSearchParams(currentQuery);
  params.set('action', 'add');
  return `${TRANSACTIONS_PATH}?${params}`;
}
