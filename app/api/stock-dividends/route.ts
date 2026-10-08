// @ts-nocheck
import { withLedgerWriteAudit } from "../../../lib/ledgerContext";
import { NextResponse } from "next/server";
import { requireAuth } from "../../../lib/apiHelpers";
import { getDB, queryAll, queryOne, saveDB } from "../../../lib/db";
import { uid } from "../../../lib/userDefaults";
import { normalizeDate } from "../../../lib/accountHelpers";
import {
  DRIP_SYNTH_NOTE_PREFIX,
  validateDripInput,
} from "../../../lib/stockHelpers";

export async function GET(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(request.url);
  const stockId = searchParams.get("stockId") || "";
  const page = searchParams.get("page") || "";
  const pageSize = searchParams.get("pageSize") || "";
  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const sortBy = searchParams.get("sortBy") || "";
  const sortDir = searchParams.get("sortDir") || "";

  let whereSql = "WHERE sd.user_id = ?";
  const params = [auth.userId];
  if (stockId) {
    whereSql += " AND sd.stock_id = ?";
    params.push(stockId);
  }
  if (dateFrom) {
    whereSql += " AND sd.date >= ?";
    params.push(normalizeDate(dateFrom));
  }
  if (dateTo) {
    whereSql += " AND sd.date <= ?";
    params.push(normalizeDate(dateTo));
  }

  const validSortCols = {
    date: "sd.date",
    symbol: "s.symbol",
    cash_dividend: "sd.cash_dividend",
  };
  const dir = sortDir === "asc" ? "ASC" : "DESC";
  const sortCol = validSortCols[sortBy] || "sd.date";
  const orderSql = ` ORDER BY ${sortCol} ${dir}`;

  if (page && pageSize) {
    const p = Math.max(1, parseInt(page));
    const ps = Math.max(1, Math.min(9999, parseInt(pageSize)));
    const countRow = queryOne(
      `SELECT COUNT(*) as cnt FROM stock_dividends sd ${whereSql}`,
      params,
    );
    const total = countRow ? countRow.cnt : 0;
    const totalPages = Math.ceil(total / ps);
    const dataSql = `SELECT sd.*, s.symbol, s.name as stock_name, s.market, s.currency FROM stock_dividends sd LEFT JOIN stocks s ON sd.stock_id = s.id ${whereSql}${orderSql} LIMIT ? OFFSET ?`;
    const data = queryAll(dataSql, [...params, ps, (p - 1) * ps]);
    return NextResponse.json({ data, total, page: p, totalPages });
  }

  const sql = `SELECT sd.*, s.symbol, s.name as stock_name, s.market, s.currency FROM stock_dividends sd LEFT JOIN stocks s ON sd.stock_id = s.id ${whereSql}${orderSql}`;
  return NextResponse.json(queryAll(sql, params));
}

async function handlePOST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const { stockId, cashDividend, stockDividendShares, accountId, note } = body;
  const date = normalizeDate(body.date);

  if (!stockId || !date)
    return NextResponse.json({ error: "必填欄位未填" }, { status: 400 });

  const cash =
    cashDividend == null || String(cashDividend).trim() === ""
      ? 0
      : Number(cashDividend);
  const stkDivShares =
    stockDividendShares == null || String(stockDividendShares).trim() === ""
      ? 0
      : Number(stockDividendShares);
  if (
    !Number.isFinite(cash) ||
    !Number.isFinite(stkDivShares) ||
    cash < 0 ||
    stkDivShares < 0
  )
    return NextResponse.json({ error: "股利不可為負" }, { status: 400 });
  if (cash === 0 && stkDivShares === 0) {
    return NextResponse.json(
      { error: "現金股利與股票股利至少填一項" },
      { status: 400 },
    );
  }

  const stock = queryOne(
    "SELECT id, name, market FROM stocks WHERE id = ? AND user_id = ?",
    [stockId, auth.userId],
  );
  if (!stock)
    return NextResponse.json({ error: "股票不存在" }, { status: 400 });

  if (cash > 0 && !accountId) {
    return NextResponse.json(
      { error: "入款帳戶為必填（含現金股利時）" },
      { status: 400 },
    );
  }
  if (accountId) {
    const acc = queryOne(
      "SELECT id FROM accounts WHERE id = ? AND user_id = ?",
      [accountId, auth.userId],
    );
    if (!acc)
      return NextResponse.json(
        { error: "帳戶不存在或無權限" },
        { status: 400 },
      );
  }

  // 股利再投資（DRIP）：需現金股利 + 正數的再投資股數與每股價格（見 lib/stockHelpers.ts）。
  let drip;
  try {
    drip = validateDripInput({
      reinvest: body.reinvest,
      cashDividend: cash,
      reinvestShares:
        body.reinvestShares == null ? 0 : Number(body.reinvestShares),
      reinvestPrice:
        body.reinvestPrice == null ? 0 : Number(body.reinvestPrice),
      market: stock.market || "TW",
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  const id = uid();
  const db = getDB();
  let synthTxId = null;
  let dripTxId = null;
  try {
    db.run("BEGIN");
    db.run(
      "INSERT INTO stock_dividends (id,user_id,stock_id,date,cash_dividend,stock_dividend_shares,account_id,note,created_at,reinvest,reinvest_shares,reinvest_price) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
      [
        id,
        auth.userId,
        stockId,
        date,
        cash,
        stkDivShares,
        accountId || null,
        note || "",
        Date.now(),
        drip.reinvest ? 1 : 0,
        drip.reinvestShares,
        drip.reinvestPrice,
      ],
    );

    if (stkDivShares > 0) {
      synthTxId = uid();
      const synthNote = `[SYNTH] 股票股利配發 | ${note || ""}`.trim();
      db.run(
        "INSERT INTO stock_transactions (id,user_id,stock_id,date,type,shares,price,fee,tax,account_id,note,created_at,tax_auto_calculated,linked_dividend_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          synthTxId,
          auth.userId,
          stockId,
          date,
          "buy",
          stkDivShares,
          0,
          0,
          0,
          null,
          synthNote,
          Date.now(),
          1,
          id,
        ],
      );
    }

    // DRIP：以現金股利再買入同一標的，寫入合成買進交易讓 FIFO 自然納入成本基礎。
    // 手續費為 0：再投資金額即為股利，券商不另收取（見 lib/twStockTaxRules.ts 同檔註解）。
    if (drip.reinvest) {
      dripTxId = uid();
      const dripNote = `${DRIP_SYNTH_NOTE_PREFIX} | 每股 $${drip.reinvestPrice} | ${note || ""}`.trim();
      db.run(
        "INSERT INTO stock_transactions (id,user_id,stock_id,date,type,shares,price,fee,tax,account_id,note,created_at,tax_auto_calculated,linked_dividend_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          dripTxId,
          auth.userId,
          stockId,
          date,
          "buy",
          drip.reinvestShares,
          drip.reinvestPrice,
          0,
          0,
          accountId || null,
          dripNote,
          Date.now(),
          1,
          id,
        ],
      );
    }
    db.run("COMMIT");
  } catch (error) {
    console.error("[stock-dividends] write failed", error);
    try {
      db.run("ROLLBACK");
    } catch (rollbackError) {
      console.error("[stock-dividends] rollback failed", rollbackError);
    }
    return NextResponse.json({ error: "股利寫入失敗" }, { status: 500 });
  }
  saveDB();

  return NextResponse.json({ id, synthTxId, dripTxId }, { status: 201 });
}

export const POST = withLedgerWriteAudit(handlePOST);
