// @ts-nocheck
import { NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/apiHelpers";
import { getDB, queryAll, queryOne, saveDB } from "../../../../lib/db";
import { normalizeDate } from "../../../../lib/accountHelpers";

export async function PUT(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { cashDividend, stockDividendShares, accountId, note } = body;
  const date = normalizeDate(body.date);

  if (!date)
    return NextResponse.json({ error: "日期格式無效" }, { status: 400 });
  const cash =
    cashDividend == null || String(cashDividend).trim() === ""
      ? 0
      : Number(cashDividend);
  const stockShares =
    stockDividendShares == null || String(stockDividendShares).trim() === ""
      ? 0
      : Number(stockDividendShares);
  if (
    !Number.isFinite(cash) ||
    !Number.isFinite(stockShares) ||
    cash < 0 ||
    stockShares < 0
  ) {
    return NextResponse.json(
      { error: "股利必須為有限且不可為負的數值" },
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

  const d = queryOne(
    "SELECT * FROM stock_dividends WHERE id = ? AND user_id = ?",
    [id, auth.userId],
  );
  if (!d)
    return NextResponse.json({ error: "股利紀錄不存在" }, { status: 404 });

  const db = getDB();
  db.run(
    "UPDATE stock_dividends SET date=?, cash_dividend=?, stock_dividend_shares=?, account_id=?, note=? WHERE id=? AND user_id=?",
    [date, cash, stockShares, accountId || "", note || "", id, auth.userId],
  );
  saveDB();

  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const old = queryOne(
    "SELECT * FROM stock_dividends WHERE id = ? AND user_id = ?",
    [id, auth.userId],
  );
  if (!old)
    return NextResponse.json({ error: "股利紀錄不存在" }, { status: 404 });

  const db = getDB();
  let linkedTransactionDeleted = false;

  if (Number(old.stock_dividend_shares) > 0) {
    const targetShares = Number(old.stock_dividend_shares);
    const synth = queryAll(
      "SELECT id, shares FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date = ? AND type = 'buy' AND price = 0 AND (note LIKE '[SYNTH] 股票股利%' OR note LIKE '%股票股利配發%')",
      [auth.userId, old.stock_id, old.date],
    );
    synth.forEach((t) => {
      if (Math.abs(Number(t.shares) - targetShares) < 0.001) {
        db.run("DELETE FROM stock_transactions WHERE id = ?", [t.id]);
        linkedTransactionDeleted = true;
      }
    });
  }

  db.run("DELETE FROM stock_dividends WHERE id = ? AND user_id = ?", [
    id,
    auth.userId,
  ]);
  saveDB();

  return NextResponse.json({ ok: true, linkedTransactionDeleted });
}
