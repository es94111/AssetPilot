import { NextResponse } from "next/server";
import { requireAuth } from "../../../../../lib/apiHelpers";
import { queryAll, queryOne } from "../../../../../lib/db";
import {
  fetchStockHistory,
  isValidStockHistoryDate,
} from "../../../../../lib/stockHistory";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function oneYearBefore(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year - 1, month - 1, day));
  return date.toISOString().slice(0, 10);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const stock = queryOne(
    "SELECT id, symbol, name, market FROM stocks WHERE id = ? AND user_id = ?",
    [id, auth.userId],
  );
  if (!stock) return NextResponse.json({ error: "股票不存在" }, { status: 404 });
  const symbol = String(stock.symbol || "").trim();
  if (!symbol) return NextResponse.json({ error: "股票不存在" }, { status: 404 });
  if (String(stock.market || "TW").toUpperCase() !== "TW") {
    return NextResponse.json(
      { error: "目前僅支援台股歷史 K 線資料" },
      { status: 400 },
    );
  }

  const { searchParams } = new URL(request.url);
  const today = todayIsoDate();
  const from = searchParams.get("from") || oneYearBefore(today);
  const to = searchParams.get("to") || today;
  if (!isValidStockHistoryDate(from) || !isValidStockHistoryDate(to) || from > to) {
    return NextResponse.json({ error: "日期格式錯誤，請使用 YYYY-MM-DD" }, { status: 400 });
  }

  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  if ((toYear - fromYear) * 12 + (toMonth - fromMonth) > 60) {
    return NextResponse.json({ error: "查詢區間不可超過 5 年" }, { status: 400 });
  }

  try {
    const candles = await fetchStockHistory(symbol, from, to);
    const transactions = queryAll(
      "SELECT id, date, type, shares, price FROM stock_transactions WHERE stock_id = ? AND user_id = ? AND date >= ? AND date <= ? ORDER BY date, created_at, id",
      [stock.id, auth.userId, from, to],
    ).map((transaction) => ({
      id: transaction.id,
      date: transaction.date,
      type: transaction.type,
      shares: Number(transaction.shares) || 0,
      price: Number(transaction.price) || 0,
    }));

    return NextResponse.json({
      symbol,
      name: stock.name || symbol,
      market: "TW",
      from,
      to,
      candles,
      transactions,
    });
  } catch (error) {
    console.error("Stock history request failed:", error);
    return NextResponse.json(
      { error: "歷史股價暫時無法取得，請稍後再試" },
      { status: 503 },
    );
  }
}
