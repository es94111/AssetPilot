// @ts-nocheck
import { NextResponse } from "next/server";
import { requireAuth } from "../../../lib/apiHelpers";
import { getDB, queryAll, queryOne, saveDB } from "../../../lib/db";
import { getExchangeRateToTwd } from "../../../lib/accountHelpers";
import { uid } from "../../../lib/userDefaults";
import {
  isValidStockSymbol,
  normalizeStockMarket,
  normalizeStockSymbol,
  stockCurrency,
} from "../../../lib/stockMarket";
import { calcFifoLots } from "../../../lib/moneyDecimal";
import {
  getStockSettings,
  calcStockFee,
  calcStockTax,
} from "../../../lib/stockHelpers";
import { inferStockType } from "../../../lib/twseFetchNext";

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const stockSettings = getStockSettings(auth.userId);
  const stocks = queryAll(
    "SELECT * FROM stocks WHERE user_id = ? ORDER BY symbol",
    [auth.userId],
  );

  const result = stocks.map((s) => {
    const txs = queryAll(
      "SELECT * FROM stock_transactions WHERE stock_id = ? AND user_id = ? ORDER BY date, created_at",
      [s.id, auth.userId],
    );
    const divs = queryAll(
      "SELECT * FROM stock_dividends WHERE stock_id = ? AND user_id = ? ORDER BY date DESC",
      [s.id, auth.userId],
    );

    const fifo = calcFifoLots(txs);
    const market = normalizeStockMarket(s.market);
    const currency = stockCurrency(market);
    const fxRateToTwd = getExchangeRateToTwd(auth.userId, currency);

    const dividendSyntheticShares = txs
      .filter(
        (t) =>
          t.type === "buy" &&
          Number(t.price) === 0 &&
          typeof t.note === "string" &&
          /\[SYNTH\] 股票股利|股票股利配發/.test(t.note),
      )
      .reduce((sum, t) => sum + Number(t.shares || 0), 0);
    const recordedDividendShares = divs.reduce(
      (sum, d) => sum + Number(d.stock_dividend_shares || 0),
      0,
    );
    const missingDividendShares = Math.max(
      0,
      recordedDividendShares - dividendSyntheticShares,
    );
    const totalShares = fifo.totalShares.plus(missingDividendShares).toNumber();
    const totalCost = fifo.totalCost.toNumber();
    const realizedPL = fifo.realizedPL.toNumber();

    const avgCost = totalShares > 0 ? totalCost / totalShares : 0;
    const currentPrice = Number(s.current_price || 0);
    const marketValue = totalShares * currentPrice;
    const estSellFee = calcStockFee(
      marketValue,
      totalShares,
      stockSettings,
      market,
    );
    const estSellTax = calcStockTax(
      marketValue,
      s.stock_type,
      stockSettings,
      market,
    );
    const estimatedNet = marketValue - estSellFee - estSellTax;
    const estimatedProfit = estimatedNet - totalCost;
    const returnRate = totalCost > 0 ? (estimatedProfit / totalCost) * 100 : 0;
    const totalDividend = divs.reduce(
      (sum, d) => sum + Number(d.cash_dividend || 0),
      0,
    );
    const marketValueTwd = marketValue * fxRateToTwd;
    const totalCostTwd = totalCost * fxRateToTwd;
    const estimatedProfitTwd = estimatedProfit * fxRateToTwd;
    const totalDividendTwd = totalDividend * fxRateToTwd;
    const isDelisted = !!s.delisted;
    const dividendMonths = Array.from(
      new Set(
        divs
          .filter(
            (d) =>
              Number(d.cash_dividend || 0) > 0 ||
              Number(d.stock_dividend_shares || 0) > 0,
          )
          .map((d) => Number(String(d.date || "").slice(5, 7))),
      ),
    )
      .filter((m) => m >= 1 && m <= 12)
      .sort((a, b) => a - b);

    return {
      ...s,
      market,
      currency,
      fxRateToTwd,
      totalShares,
      avgCost: Math.round(avgCost * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      totalCostTwd: Math.round(totalCostTwd),
      marketValue: Math.round(marketValue * 100) / 100,
      marketValueTwd: Math.round(marketValueTwd),
      estSellFee,
      estSellTax,
      estimatedNet: Math.round(estimatedNet * 100) / 100,
      estimatedProfit: Math.round(estimatedProfit * 100) / 100,
      estimatedProfitTwd: Math.round(estimatedProfitTwd),
      returnRate: Math.round(returnRate * 100) / 100,
      realizedPL: Math.round(realizedPL * 100) / 100,
      totalDividend: Math.round(totalDividend * 100) / 100,
      totalDividendTwd: Math.round(totalDividendTwd),
      dividendMonths,
      currentPrice,
      updatedAt: s.updated_at,
      stockType: s.stock_type,
      delisted: isDelisted,
      lastQuotedAt: s.updated_at,
      priceSource: isDelisted ? "frozen" : null,
    };
  });

  const totalMarketValue = result.reduce(
    (sum, x) => sum + (x.marketValueTwd || 0),
    0,
  );
  const totalCostSum = result.reduce(
    (sum, x) => sum + (x.totalCostTwd || 0),
    0,
  );
  const totalPL = totalMarketValue - totalCostSum;
  const totalDividendTwd = result.reduce(
    (sum, x) => sum + (x.totalDividendTwd || 0),
    0,
  );
  const totalReturnRate =
    totalCostSum > 0
      ? Math.round((totalPL / totalCostSum) * 10000) / 100
      : null;
  const portfolioSummary = {
    totalMarketValue: Math.round(totalMarketValue),
    totalCost: Math.round(totalCostSum),
    totalPL: Math.round(totalPL),
    totalDividendTwd: Math.round(totalDividendTwd),
    totalReturnRate,
  };

  return NextResponse.json({ stocks: result, portfolioSummary });
}

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const market = normalizeStockMarket(body.market);
  const symbol = normalizeStockSymbol(body.symbol, market);
  const { name, stockType } = body;

  if (!symbol)
    return NextResponse.json({ error: "股票代號為必填" }, { status: 400 });
  if (!isValidStockSymbol(symbol, market)) {
    return NextResponse.json(
      {
        error:
          market === "US"
            ? "美股代號格式不正確"
            : "台股代號格式不正確（限 1-8 字 ASCII 數字 / 字母）",
      },
      { status: 400 },
    );
  }

  const dup = queryOne(
    "SELECT id FROM stocks WHERE user_id = ? AND market = ? AND symbol = ?",
    [auth.userId, market, symbol],
  );
  if (dup)
    return NextResponse.json({ error: "此股票代號已存在" }, { status: 400 });

  const validTypes = ["stock", "etf", "warrant"];
  const type = validTypes.includes(stockType)
    ? stockType
    : market === "TW"
      ? inferStockType(symbol)
      : "stock";
  const currency = stockCurrency(market);
  const finalName = (name && String(name).trim()) || "（未命名）";
  const id = uid();

  const db = getDB();
  db.run(
    "INSERT INTO stocks (id, user_id, symbol, market, name, current_price, stock_type, currency, updated_at) VALUES (?,?,?,?,?,0,?,?,?)",
    [
      id,
      auth.userId,
      symbol,
      market,
      finalName,
      type,
      currency,
      new Date().toISOString(),
    ],
  );
  saveDB();

  return NextResponse.json(
    { id, market, currency, stockType: type },
    { status: 201 },
  );
}
