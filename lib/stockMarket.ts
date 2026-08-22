export const STOCK_MARKETS = ["TW", "US"] as const;
export type StockMarket = (typeof STOCK_MARKETS)[number];

export function normalizeStockMarket(value: unknown): StockMarket {
  return String(value || "")
    .trim()
    .toUpperCase() === "US"
    ? "US"
    : "TW";
}

export function stockCurrency(market: unknown): "TWD" | "USD" {
  return normalizeStockMarket(market) === "US" ? "USD" : "TWD";
}

export function allowsFractionalShares(market: unknown): boolean {
  return normalizeStockMarket(market) === "US";
}

export function isValidStockShareQuantity(
  value: unknown,
  market: unknown,
): boolean {
  const shares = Number(value);
  return (
    Number.isFinite(shares) &&
    shares > 0 &&
    (allowsFractionalShares(market) || Number.isInteger(shares))
  );
}

export function calculateStockSharesForAmount(
  amount: unknown,
  price: unknown,
  market: unknown,
): number {
  const amountNum = Number(amount);
  const priceNum = Number(price);
  if (
    !Number.isFinite(amountNum) ||
    !Number.isFinite(priceNum) ||
    priceNum <= 0
  ) {
    return 0;
  }
  const shares = amountNum / priceNum;
  return allowsFractionalShares(market) ? shares : Math.floor(shares);
}

export function normalizeStockSymbol(
  value: unknown,
  market: unknown = "TW",
): string {
  const symbol = String(value || "")
    .trim()
    .toUpperCase();
  if (normalizeStockMarket(market) === "US") return symbol.replace(/\s+/g, "");
  return symbol;
}

export function isValidStockSymbol(
  value: unknown,
  market: unknown = "TW",
): boolean {
  const symbol = normalizeStockSymbol(value, market);
  return normalizeStockMarket(market) === "US"
    ? /^[A-Z][A-Z0-9.-]{0,11}$/.test(symbol)
    : /^[0-9A-Z]{1,8}$/.test(symbol);
}

/** Yahoo uses hyphens for class-share symbols such as BRK.B. */
export function yahooSymbol(value: unknown): string {
  return normalizeStockSymbol(value, "US").replace(/\./g, "-");
}

export function stockMarketKey(market: unknown, symbol: unknown): string {
  return `${normalizeStockMarket(market)}:${normalizeStockSymbol(symbol, market)}`;
}
