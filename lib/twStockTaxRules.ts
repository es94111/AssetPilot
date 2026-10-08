// lib/twStockTaxRules.ts — 台股證交稅與稅務規則集中管理（單一真實來源）。
//
// 法規依據：證券交易稅條例（全國法規資料庫 pcode=G0340078）
//
//   第 2 條第 1 款：公司發行之股票及表明股票權利之證書或憑證徵千分之三。
//     → 一般股票賣出稅率 = 0.003（3‰），即既有 DEFAULT_STOCK_SETTINGS.sellTaxRateStock。
//
//   第 2 條之 2：自中華民國 106 年 4 月 28 日起至 116 年 12 月 31 日止，同一證券商
//     受託買賣（自 107 年 4 月 28 日起亦含證券商自行買賣），同一帳戶於同一營業日
//     現款買進與現券賣出「同種類同數量」之上市或上櫃股票，於出賣時按每次交易成交
//     價格依「千分之一點五」稅率課徵證券交易稅，不適用第 2 條第 1 款規定。
//     → 現股當沖稅率 = 0.0015（1.5‰），為第 2 條第 1 款稅率之半數。
//
// 註 1：第 2 條之 2 的租稅優惠僅適用於「上市或上櫃股票」且「同種類同數量」，
//       未涵蓋 ETF、權證；本模組據此限制當沖優惠只套用於股票類型（stock）。
// 註 2：條文內之日期為中華民國紀年，116 年 12 月 31 日 = 西元 2026-12-31？
//       （民 116 年 = 西元 2027 年，故優惠期間屆滿日為 2027-12-31）。
//       本系統僅記錄已發生交易，不預先判斷未來交易日，故不在此阻擋 2027 年後的
//       交易；稅率規則以現行有效法律為準，未來修法時更新本檔即可。

/** 一般股票賣出證交稅率：證券交易稅條例第 2 條第 1 款（千分之三）。 */
export const TW_STOCK_SELL_TAX_RATE = 0.003;

/**
 * 現股當沖賣出證交稅率：證券交易稅條例第 2 條之 2（千分之一點五）。
 * 同一帳戶於同一營業日現款買進與現券賣出同種類同數量上市／上櫃股票時適用。
 */
export const TW_DAY_TRADE_SELL_TAX_RATE = 0.0015;

/**
 * 當沖優惠折半倍率（相對第 2 條第 1 款稅率）。
 * 集中定義避免各處自行寫死 0.5，並供 UI 文案說明「稅率減半」的法源。
 */
export const TW_DAY_TRADE_TAX_HALF_FACTOR = 0.5;

/** 賣出證交稅最低徵收金額（元）。 */
export const TW_STOCK_SELL_TAX_MIN = 1;

/**
 * 可標記為「現股當沖」的股票類型。證券交易稅條例第 2 條之 2 僅適用於
 * 上市／上櫃「股票」，ETF 與權證不適用，故不給予當沖稅率。
 */
export const TW_DAY_TRADE_ELIGIBLE_STOCK_TYPES: ReadonlyArray<string> = [
  "stock",
];

/** 是否允許該標的類型使用現股當沖稅率。 */
export function isDayTradeEligibleStockType(stockType: string): boolean {
  return TW_DAY_TRADE_ELIGIBLE_STOCK_TYPES.includes(String(stockType || "stock"));
}

/**
 * 取得賣出證交稅率。
 *
 * @param stockType 標的類型（stock / etf / warrant）。
 * @param baseRate  該類型的一般（非當沖）稅率，來自使用者股票設定。
 * @param dayTrade  是否為現股當沖交易。
 * @returns 適用稅率（當沖且類型符合時為第 2 條之 2 的 1.5‰）。
 */
export function resolveSellTaxRate(
  stockType: string,
  baseRate: number,
  dayTrade: boolean,
): number {
  if (!dayTrade || !isDayTradeEligibleStockType(stockType)) return baseRate;
  return TW_DAY_TRADE_SELL_TAX_RATE;
}
