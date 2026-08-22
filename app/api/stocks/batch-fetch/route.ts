// @ts-nocheck
import { NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/apiHelpers";
import { queryAll } from "../../../../lib/db";
import { normalizeStockMarket } from "../../../../lib/stockMarket";
import { fetchUsQuote } from "../../../../lib/usStockFetch";
import {
  fetchTwseRealtime,
  fetchTwseStockDay,
  fetchTpexStockDay,
  fetchAllWithLimit,
} from "../../../../lib/twseFetchNext";

export async function POST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const requestedIds = Array.isArray(body.stockIds)
    ? body.stockIds.map(String).filter(Boolean).slice(0, 500)
    : [];
  const marketFilter = body.market ? normalizeStockMarket(body.market) : "";
  const where = [
    "user_id = ?",
    "COALESCE(delisted, 0) = 0",
    ...(marketFilter ? ["market = ?"] : []),
    ...(requestedIds.length > 0
      ? [`id IN (${requestedIds.map(() => "?").join(",")})`]
      : []),
  ].join(" AND ");
  const params = [
    auth.userId,
    ...(marketFilter ? [marketFilter] : []),
    ...requestedIds,
  ];
  const stocks = queryAll(
    `SELECT id, symbol, name, market FROM stocks WHERE ${where}`,
    params,
  );
  if (stocks.length === 0) return NextResponse.json({ results: [] });

  const today = new Date();
  const todayYmd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;

  const fetcher = async (s) => {
    if (normalizeStockMarket(s.market) === "US") {
      const info = await fetchUsQuote(s.symbol);
      if (info.found && info.closingPrice > 0) {
        return {
          stockId: s.id,
          symbol: s.symbol,
          market: "US",
          status: "ok",
          currentPrice: info.closingPrice,
          priceSource: info.priceSource,
          priceType: info.priceType,
          fetchedAt: new Date().toISOString(),
        };
      }
      return {
        stockId: s.id,
        symbol: s.symbol,
        market: "US",
        status: "failed",
        error: "查詢失敗",
      };
    }

    let info = await fetchTwseRealtime(s.symbol);
    if (!info || !info.found || !(info.closingPrice > 0)) {
      info = await fetchTwseStockDay(s.symbol, todayYmd);
    }
    if (!info || !info.found || !(info.closingPrice > 0)) {
      info = await fetchTpexStockDay(s.symbol, todayYmd);
    }
    if (info && info.found && info.closingPrice > 0) {
      return {
        stockId: s.id,
        symbol: s.symbol,
        status: "ok",
        currentPrice: info.closingPrice,
        priceSource:
          info.priceSource || (info.isRealtime ? "realtime" : "close"),
        priceType: info.priceType || "",
        fetchedAt: new Date().toISOString(),
      };
    }
    return {
      stockId: s.id,
      symbol: s.symbol,
      status: "failed",
      error: "查詢失敗",
    };
  };

  try {
    const settled = await fetchAllWithLimit(stocks, fetcher);
    const results = settled.map((r) =>
      r.ok
        ? r.value
        : {
            stockId: r.item.id,
            symbol: r.item.symbol,
            status: "failed",
            error: r.error,
          },
    );
    return NextResponse.json({ results });
  } catch (e) {
    return NextResponse.json(
      { error: "批次查價失敗：" + e.message },
      { status: 500 },
    );
  }
}
