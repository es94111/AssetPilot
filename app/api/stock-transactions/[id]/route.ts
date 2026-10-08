// @ts-nocheck
import { withLedgerWriteAudit } from "../../../../lib/ledgerContext";
import { NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/apiHelpers";
import { getDB, queryOne, saveDB } from "../../../../lib/db";
import { normalizeDate } from "../../../../lib/accountHelpers";
import {
  getStockSettings,
  calcStockFeeForTrade,
  calcStockTaxForTrade,
  isProtectedSyntheticTransaction,
  canMarkDayTrade,
  hasQualifyingDayTradePurchase,
  hasValidDayTradeCoverageAfterChanges,
  normalizeDayTradeFlag,
  validateChainConstraint,
} from "../../../../lib/stockHelpers";
import { isValidStockShareQuantity } from "../../../../lib/stockMarket";

function hasManualCharge(value) {
  return value !== undefined && value !== null && value !== "";
}

function parseCharge(value, label) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${label}不可為負或非數字`);
  }
  return n;
}

async function handlePUT(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { type, shares, price, fee, tax, accountId, note } = body;
  const date = normalizeDate(body.date);

  if (!date)
    return NextResponse.json({ error: "日期格式無效" }, { status: 400 });
  if (!["buy", "sell"].includes(type))
    return NextResponse.json({ error: "交易類型無效" }, { status: 400 });
  const shareNum = Number(shares);
  const priceNum = Number(price);
  if (!Number.isFinite(shareNum) || !(shareNum > 0))
    return NextResponse.json({ error: "股數必須為正數" }, { status: 400 });
  if (!Number.isFinite(priceNum) || !(priceNum > 0))
    return NextResponse.json({ error: "價格必須為正數" }, { status: 400 });
  const feeProvided = hasManualCharge(fee);
  const taxProvided = hasManualCharge(tax);
  let manualFee = 0;
  let manualTax = 0;
  try {
    if (feeProvided) manualFee = parseCharge(fee, "手續費");
    if (taxProvided) manualTax = parseCharge(tax, "稅費");
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  const t = queryOne(
    "SELECT * FROM stock_transactions WHERE id = ? AND user_id = ?",
    [id, auth.userId],
  );
  if (!t)
    return NextResponse.json({ error: "交易紀錄不存在" }, { status: 404 });
  const effectiveAccountId =
    body.accountId === undefined ? String(t.account_id || "") : String(accountId || "");
  let selectedAccount = null;
  if (effectiveAccountId) {
    selectedAccount = queryOne(
      "SELECT id, category, account_type FROM accounts WHERE id = ? AND user_id = ?",
      [effectiveAccountId, auth.userId],
    );
    if (!selectedAccount)
      return NextResponse.json(
        { error: "帳戶不存在或無權限" },
        { status: 400 },
      );
  }
  if (isProtectedSyntheticTransaction(t.note)) {
    return NextResponse.json(
      { error: "股利合成交易必須透過編輯或刪除對應股利紀錄處理" },
      { status: 400 },
    );
  }

  const chain = validateChainConstraint(
    auth.userId,
    t.stock_id,
    date,
    type,
    shareNum,
    id,
  );
  if (!chain.ok) {
    return NextResponse.json(
      {
        error: `此修改會造成 ${chain.conflictDate} 持有量為負 (預期 ${chain.expectedShares} 股)`,
      },
      { status: 400 },
    );
  }

  const stock = queryOne(
    "SELECT stock_type, market FROM stocks WHERE id = ? AND user_id = ?",
    [t.stock_id, auth.userId],
  );
  if (!isValidStockShareQuantity(shareNum, stock?.market || "TW"))
    return NextResponse.json({ error: "股數必須為整數" }, { status: 400 });

  // 現股當沖僅適用台股一般股票，且僅限賣出交易（證券交易稅條例第 2 條之 2）。
  // Older clients omit the newly added flag; preserve the stored setting on such edits.
  const dayTrade =
    body.dayTrade === undefined
      ? type === "sell"
        ? normalizeDayTradeFlag(t.day_trade)
        : false
      : normalizeDayTradeFlag(body.dayTrade);
  if (dayTrade && !canMarkDayTrade(stock?.stock_type || "stock", stock?.market || "TW", date)) {
    return NextResponse.json(
      { error: "現股當沖僅適用台股一般股票（ETF／權證不適用）" },
      { status: 400 },
    );
  }
  if (dayTrade && type !== "sell") {
    return NextResponse.json(
      { error: "現股當沖標記僅適用於賣出交易" },
      { status: 400 },
    );
  }
  if (dayTrade && selectedAccount?.category !== "securities" && selectedAccount?.account_type !== "證券帳戶") {
    return NextResponse.json(
      { error: "現股當沖需指定證券帳戶類型的帳戶" },
      { status: 400 },
    );
  }
  if (
    dayTrade &&
    !hasQualifyingDayTradePurchase(
      auth.userId,
      String(t.stock_id),
      date,
      shareNum,
      effectiveAccountId,
      id,
    )
  ) {
    return NextResponse.json(
      { error: "現股當沖需有同帳戶、同日、同標的且股數足夠的現款買進交易" },
      { status: 400 },
    );
  }
  if (
    !hasValidDayTradeCoverageAfterChanges(auth.userId, [
      {
        id,
        stockId: String(t.stock_id),
        date,
        type,
        shares: shareNum,
        price: priceNum,
        accountId: effectiveAccountId,
        dayTrade,
        note: note || "",
        linkedDividendId: t.linked_dividend_id || "",
      },
    ])
  ) {
    return NextResponse.json(
      { error: "此修改會使同日現股當沖賣出超出現款買進股數" },
      { status: 400 },
    );
  }
  const settings = getStockSettings(auth.userId);
  const finalFee = feeProvided
    ? manualFee
    : calcStockFeeForTrade(
        shares,
        price,
        settings,
        stock?.market || "TW",
      );
  // An explicit tax value is always treated as a manual override, including when
  // the day-trade flag changes. Leave the field blank to recalculate using the flag.
  const finalTax =
    type === "sell"
      ? taxProvided
        ? manualTax
        : calcStockTaxForTrade(
            shares,
            price,
            stock?.stock_type || "stock",
            settings,
            stock?.market || "TW",
            dayTrade,
            date,
          )
      : taxProvided
        ? manualTax
        : 0;
  const nextTaxAutoCalc = taxProvided ? 0 : 1;
  const db = getDB();
  db.run("BEGIN");
  try {
    db.run(
      "UPDATE stock_transactions SET date=?, type=?, shares=?, price=?, fee=?, tax=?, account_id=?, note=?, tax_auto_calculated=?, day_trade=? WHERE id=? AND user_id=?",
      [
        date,
        type,
        shareNum,
        priceNum,
        finalFee,
        finalTax,
        effectiveAccountId,
        note || "",
        nextTaxAutoCalc,
        dayTrade && type === "sell" ? 1 : 0,
        id,
        auth.userId,
      ],
    );
    db.run("COMMIT");
  } catch (e) {
    try {
      db.run("ROLLBACK");
    } catch (_) {
      /* noop */
    }
    return NextResponse.json(
      { error: "更新交易失敗：" + e.message },
      { status: 500 },
    );
  }
  saveDB();

  return NextResponse.json({ ok: true });
}

async function handleDELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const existing = queryOne(
    "SELECT * FROM stock_transactions WHERE id = ? AND user_id = ?",
    [id, auth.userId],
  );
  if (existing && isProtectedSyntheticTransaction(existing.note)) {
    return NextResponse.json(
      { error: "股利合成交易必須透過刪除對應股利紀錄連動處理，請至「股利紀錄」頁刪除" },
      { status: 400 },
    );
  }
  if (
    existing &&
    !hasValidDayTradeCoverageAfterChanges(auth.userId, [], [String(id)])
  ) {
    return NextResponse.json(
      { error: "不可刪除此交易，因為它是現股當沖賣出的必要同日買進數量" },
      { status: 400 },
    );
  }
  const db = getDB();
  db.run("DELETE FROM stock_transactions WHERE id = ? AND user_id = ?", [
    id,
    auth.userId,
  ]);
  saveDB();

  return NextResponse.json({ ok: true });
}

export const PUT = withLedgerWriteAudit(handlePUT);
export const DELETE = withLedgerWriteAudit(handleDELETE);
