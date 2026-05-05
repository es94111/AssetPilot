import { NextResponse } from 'next/server';
import { requireAuth } from '../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../lib/db';
import { uid } from '../../../lib/userDefaults';
import moneyDecimal from '../../../lib/moneyDecimal';
import {
  getStockSettings,
  calcStockFee,
  calcStockTax,
} from '../../../lib/stockHelpers';
import { inferStockType } from '../../../lib/twseFetchNext';

export async function GET(request) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const stockSettings = getStockSettings(auth.userId);
  const stocks = queryAll('SELECT * FROM stocks WHERE user_id = ? ORDER BY symbol', [auth.userId]);

  const result = stocks.map(s => {
    const txs = queryAll(
      'SELECT * FROM stock_transactions WHERE stock_id = ? AND user_id = ? ORDER BY date, created_at',
      [s.id, auth.userId]
    );
    const divs = queryAll(
      'SELECT * FROM stock_dividends WHERE stock_id = ? AND user_id = ? ORDER BY date DESC',
      [s.id, auth.userId]
    );

    const fifo = moneyDecimal.calcFifoLots(txs);

    const dividendSyntheticShares = txs
      .filter(t => t.type === 'buy' && Number(t.price) === 0 && typeof t.note === 'string' && /\[SYNTH\] 股票股利|股票股利配發/.test(t.note))
      .reduce((sum, t) => sum + Number(t.shares || 0), 0);
    const recordedDividendShares = divs.reduce((sum, d) => sum + Number(d.stock_dividend_shares || 0), 0);
    const missingDividendShares = Math.max(0, recordedDividendShares - dividendSyntheticShares);
    const totalShares = fifo.totalShares.plus(missingDividendShares).toNumber();
    const totalCost = fifo.totalCost.toNumber();
    const realizedPL = fifo.realizedPL.toNumber();

    const avgCost = totalShares > 0 ? totalCost / totalShares : 0;
    const currentPrice = Number(s.current_price || 0);
    const marketValue = totalShares * currentPrice;
    const estSellFee = calcStockFee(marketValue, totalShares, stockSettings);
    const estSellTax = calcStockTax(marketValue, s.stock_type, stockSettings);
    const estimatedNet = marketValue - estSellFee - estSellTax;
    const estimatedProfit = estimatedNet - totalCost;
    const returnRate = totalCost > 0 ? (estimatedProfit / totalCost * 100) : 0;
    const totalDividend = divs.reduce((sum, d) => sum + Number(d.cash_dividend || 0), 0);
    const isDelisted = !!s.delisted;

    return {
      ...s,
      totalShares,
      avgCost: Math.round(avgCost * 100) / 100,
      totalCost: Math.round(totalCost),
      marketValue: Math.round(marketValue),
      estSellFee,
      estSellTax,
      estimatedNet: Math.round(estimatedNet),
      estimatedProfit: Math.round(estimatedProfit),
      returnRate: Math.round(returnRate * 100) / 100,
      realizedPL: Math.round(realizedPL * 100) / 100,
      totalDividend: Math.round(totalDividend),
      currentPrice,
      updatedAt: s.updated_at,
      stockType: s.stock_type,
      delisted: isDelisted,
      lastQuotedAt: s.updated_at,
      priceSource: isDelisted ? 'frozen' : null,
    };
  });

  const totalMarketValue = result.reduce((sum, x) => sum + (x.marketValue || 0), 0);
  const totalCostSum = result.reduce((sum, x) => sum + (x.totalCost || 0), 0);
  const totalPL = totalMarketValue - totalCostSum;
  const totalReturnRate = totalCostSum > 0 ? Math.round(totalPL / totalCostSum * 10000) / 100 : null;
  const portfolioSummary = {
    totalMarketValue: Math.round(totalMarketValue),
    totalCost: Math.round(totalCostSum),
    totalPL: Math.round(totalPL),
    totalReturnRate,
  };

  return NextResponse.json({ stocks: result, portfolioSummary });
}

export async function POST(request) {
  const auth = requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const { symbol, name, stockType } = body;

  if (!symbol) return NextResponse.json({ error: '股票代號為必填' }, { status: 400 });
  if (!/^[0-9A-Za-z]{1,8}$/.test(String(symbol).trim())) {
    return NextResponse.json({ error: '股票代號格式不正確（限 1-8 字 ASCII 數字 / 字母）' }, { status: 400 });
  }

  const dup = queryOne('SELECT id FROM stocks WHERE user_id = ? AND symbol = ?', [auth.userId, symbol]);
  if (dup) return NextResponse.json({ error: '此股票代號已存在' }, { status: 400 });

  const validTypes = ['stock', 'etf', 'warrant'];
  const type = validTypes.includes(stockType) ? stockType : inferStockType(symbol);
  const finalName = (name && String(name).trim()) || '（未命名）';
  const id = uid();

  const db = getDB();
  db.run(
    'INSERT INTO stocks (id, user_id, symbol, name, current_price, stock_type, updated_at) VALUES (?,?,?,?,0,?,?)',
    [id, auth.userId, symbol, finalName, type, new Date().toISOString()]
  );
  saveDB();

  return NextResponse.json({ id, stockType: type }, { status: 201 });
}
