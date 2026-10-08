// @ts-nocheck
import { withLedgerWriteAudit } from "../../../../lib/ledgerContext";
import { NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/apiHelpers";
import { getDB, queryAll, queryOne, saveDB } from "../../../../lib/db";
import { uid } from "../../../../lib/userDefaults";
import { normalizeDate } from "../../../../lib/accountHelpers";
import {
  DRIP_SYNTH_NOTE_PREFIX,
  hasAmbiguousLegacyStockDividendTransactions,
  hasUnmatchedLegacyStockDividendTransactions,
  isProtectedSyntheticTransaction,
  validateDripInput,
  validateStockTransactionChainChanges,
} from "../../../../lib/stockHelpers";

/** Find only synthetic transactions explicitly linked to this dividend record. */
function findDividendSyntheticTransactions(userId: string, dividendId: string) {
  return queryAll(
    "SELECT id, note, shares, price, created_at FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ? AND type = 'buy'",
    [userId, dividendId],
  );
}

function findLegacyStockDividendSyntheticTransactions(
  userId: string,
  stockId: string,
  date: string,
  shares: number,
) {
  return queryAll(
    "SELECT id, shares FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date = ? AND type = 'buy' AND price = 0 AND COALESCE(linked_dividend_id, '') = '' AND (note LIKE '[SYNTH] 股票股利%' OR note LIKE '股票股利配發%')",
    [userId, stockId, date],
  ).filter((tx) => Math.abs(Number(tx.shares) - shares) < 0.001);
}

function countUnlinkedStockDividendRecords(
  userId: string,
  stockId: string,
  date: string,
  shares: number,
) {
  return Number(
    queryOne(
      `SELECT COUNT(*) AS cnt FROM stock_dividends sd
       WHERE sd.user_id = ? AND sd.stock_id = ? AND sd.date = ?
         AND ABS(sd.stock_dividend_shares - ?) < 0.001
         AND NOT EXISTS (
           SELECT 1 FROM stock_transactions st
           WHERE st.user_id = sd.user_id AND st.stock_id = sd.stock_id
             AND st.linked_dividend_id = sd.id AND st.date = sd.date
             AND st.type = 'buy' AND st.price = 0
             AND ABS(st.shares - sd.stock_dividend_shares) < 0.001
             AND (st.note LIKE '[SYNTH] 股票股利%' OR st.note LIKE '股票股利配發%')
         )`,
      [userId, stockId, date, shares],
    )?.cnt || 0,
  );
}

async function handlePUT(request, { params }) {
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

  // 股利再投資（DRIP）：與 POST 相同驗證；編輯時需同步重建合成買入交易。
  const stock = queryOne(
    "SELECT market FROM stocks WHERE id = ? AND user_id = ?",
    [d.stock_id, auth.userId],
  );
  let drip;
  try {
    drip = validateDripInput({
      reinvest:
        body.reinvest === undefined ? d.reinvest : body.reinvest,
      cashDividend: cash,
      reinvestShares:
        body.reinvestShares == null
          ? Number(d.reinvest_shares || 0)
          : Number(body.reinvestShares),
      reinvestPrice:
        body.reinvestPrice == null
          ? Number(d.reinvest_price || 0)
          : Number(body.reinvestPrice),
      market: stock?.market || "TW",
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }

  let legacyStockDividendTxId = "";
  const legacyRowsForStock = queryAll(
    "SELECT id FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND type = 'buy' AND price = 0 AND COALESCE(linked_dividend_id, '') = '' AND (note LIKE '[SYNTH] 股票股利%' OR note LIKE '股票股利配發%')",
    [auth.userId, String(d.stock_id)],
  );
  if (
    legacyRowsForStock.length > 0 &&
    (hasUnmatchedLegacyStockDividendTransactions(auth.userId, String(d.stock_id)) ||
      hasAmbiguousLegacyStockDividendTransactions(auth.userId, String(d.stock_id)))
  ) {
    return NextResponse.json(
      { error: "此股票有無法配對的舊版股票股利合成紀錄，無法安全更新；請先整理後再試" },
      { status: 409 },
    );
  }
  if (Number(d.stock_dividend_shares) > 0) {
    const hasLinkedStockDividendTx = queryOne(
      "SELECT id FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ? AND type = 'buy' AND price = 0 AND ABS(shares - ?) < 0.001",
      [auth.userId, id, Number(d.stock_dividend_shares)],
    );
    if (!hasLinkedStockDividendTx) {
      const legacyMatches = findLegacyStockDividendSyntheticTransactions(
        auth.userId,
        String(d.stock_id),
        String(d.date),
        Number(d.stock_dividend_shares),
      );
      if (legacyRowsForStock.length > 0 && legacyMatches.length === 0) {
        return NextResponse.json(
          { error: "舊版股票股利合成紀錄無法歸屬至此股利，無法安全更新；請先整理後再試" },
          { status: 409 },
        );
      }
      if (legacyMatches.length > 1) {
        return NextResponse.json(
          { error: "同日有多筆無法區分的舊版股票股利合成紀錄，無法安全更新；請先整理後再試" },
          { status: 409 },
        );
      }
      if (legacyMatches.length > 0) {
        const unlinkedDividendCount = countUnlinkedStockDividendRecords(
          auth.userId,
          String(d.stock_id),
          String(d.date),
          Number(d.stock_dividend_shares),
        );
        if (legacyMatches.length !== unlinkedDividendCount) {
          return NextResponse.json(
            { error: "同日有重複的舊版股票股利合成紀錄，無法安全更新；請先整理重複股利紀錄" },
            { status: 409 },
          );
        }
        legacyStockDividendTxId = String(legacyMatches[0].id);
      }
    }
  }

  const db = getDB();
  db.run("BEGIN");
  try {
    const existing = findDividendSyntheticTransactions(auth.userId, String(id));
    const legacyTx = legacyStockDividendTxId
      ? queryOne("SELECT id, note, shares, price, created_at FROM stock_transactions WHERE id = ? AND user_id = ?", [legacyStockDividendTxId, auth.userId])
      : null;
    const stockDividendSource =
      existing.find((tx) => String(tx.note || "").startsWith("[SYNTH] 股票股利")) ||
      legacyTx;
    const dripSource = existing.find((tx) => String(tx.note || "").startsWith(DRIP_SYNTH_NOTE_PREFIX));
    const stockDividendTxId =
      stockShares > 0 ? String(stockDividendSource?.id || uid()) : "";
    const stockDividendTxCreatedAt =
      stockDividendSource == null
        ? Date.now()
        : stockDividendSource.created_at == null
          ? null
          : Number(stockDividendSource.created_at);
    const dripTxId = drip.reinvest ? String(dripSource?.id || uid()) : "";
    const dripTxCreatedAt =
      dripSource == null
        ? Date.now()
        : dripSource.created_at == null
          ? null
          : Number(dripSource.created_at);
    const removedIds = existing.map((tx) => String(tx.id));
    if (legacyStockDividendTxId) removedIds.push(legacyStockDividendTxId);
    const added = [
      ...(stockShares > 0
        ? [{ id: stockDividendTxId, date, type: "buy" as const, shares: stockShares, createdAt: stockDividendTxCreatedAt }]
        : []),
      ...(drip.reinvest
        ? [{ id: dripTxId, date, type: "buy" as const, shares: drip.reinvestShares, createdAt: dripTxCreatedAt }]
        : []),
    ];
    const chain = validateStockTransactionChainChanges(
      auth.userId,
      String(d.stock_id),
      removedIds,
      added,
    );
    if (!chain.ok) {
      db.run("ROLLBACK");
      return NextResponse.json(
        { error: `此股利變更會造成 ${chain.conflictDate} 持有量為負 (預期 ${chain.expectedShares} 股)` },
        { status: 400 },
      );
    }

    db.run(
      "UPDATE stock_dividends SET date=?, cash_dividend=?, stock_dividend_shares=?, account_id=?, note=?, reinvest=?, reinvest_shares=?, reinvest_price=? WHERE id=? AND user_id=?",
      [
        date,
        cash,
        stockShares,
        accountId || "",
        note || "",
        drip.reinvest ? 1 : 0,
        drip.reinvestShares,
        drip.reinvestPrice,
        id,
        auth.userId,
      ],
    );

    // 先清掉同一股利（同一股票、同一日期）既有的 DRIP 合成交易，再依新設定重建，
    // 避免編輯日期或股數後留下孤兒合成交易影響 FIFO。
    existing.forEach((tx) => {
      db.run("DELETE FROM stock_transactions WHERE id = ?", [tx.id]);
    });
    if (legacyStockDividendTxId) {
      db.run("DELETE FROM stock_transactions WHERE id = ?", [legacyStockDividendTxId]);
    }
    if (stockShares > 0) {
      const synthNote = `[SYNTH] 股票股利配發 | ${note || ""}`.trim();
      db.run(
        "INSERT INTO stock_transactions (id,user_id,stock_id,date,type,shares,price,fee,tax,account_id,note,created_at,tax_auto_calculated,linked_dividend_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [stockDividendTxId, auth.userId, d.stock_id, date, "buy", stockShares, 0, 0, 0, accountId || null, synthNote, stockDividendTxCreatedAt, 1, id],
      );
    }
    if (drip.reinvest) {
      const dripNote = `${DRIP_SYNTH_NOTE_PREFIX} | 每股 $${drip.reinvestPrice} | ${note || ""}`.trim();
      db.run(
        "INSERT INTO stock_transactions (id,user_id,stock_id,date,type,shares,price,fee,tax,account_id,note,created_at,tax_auto_calculated,linked_dividend_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
        [
          dripTxId,
          auth.userId,
          d.stock_id,
          date,
          "buy",
          drip.reinvestShares,
          drip.reinvestPrice,
          0,
          0,
          accountId || null,
          dripNote,
          dripTxCreatedAt,
          1,
          id,
        ],
      );
    }
    db.run("COMMIT");
  } catch (e) {
    try {
      db.run("ROLLBACK");
    } catch (_) {
      /* noop */
    }
    return NextResponse.json(
      { error: "更新股利失敗：" + e.message },
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
  const old = queryOne(
    "SELECT * FROM stock_dividends WHERE id = ? AND user_id = ?",
    [id, auth.userId],
  );
  if (!old)
    return NextResponse.json({ error: "股利紀錄不存在" }, { status: 404 });

  // Resolve legacy stock-dividend links before changing either table. If the
  // number of indistinguishable legacy lots does not match the dividends, stop
  // rather than deleting the record and leaving an unowned synthetic buy.
  let legacyStockDividendTxId = "";
  const legacyRowsForStock = queryAll(
    "SELECT id FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND type = 'buy' AND price = 0 AND COALESCE(linked_dividend_id, '') = '' AND (note LIKE '[SYNTH] 股票股利%' OR note LIKE '股票股利配發%')",
    [auth.userId, String(old.stock_id)],
  );
  if (
    legacyRowsForStock.length > 0 &&
    (hasUnmatchedLegacyStockDividendTransactions(auth.userId, String(old.stock_id)) ||
      hasAmbiguousLegacyStockDividendTransactions(auth.userId, String(old.stock_id)))
  ) {
    return NextResponse.json(
      { error: "此股票有無法配對的舊版股票股利合成紀錄，無法安全刪除；請先整理後再試" },
      { status: 409 },
    );
  }
  if (Number(old.stock_dividend_shares) > 0) {
    const targetShares = Number(old.stock_dividend_shares);
    const hasLinkedStockDividendTx = queryOne(
      "SELECT id FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ? AND type = 'buy' AND price = 0 AND ABS(shares - ?) < 0.001",
      [auth.userId, id, targetShares],
    );
    if (!hasLinkedStockDividendTx) {
      const legacyMatches = findLegacyStockDividendSyntheticTransactions(
        auth.userId,
        String(old.stock_id),
        String(old.date),
        targetShares,
      );
      if (legacyRowsForStock.length > 0 && legacyMatches.length === 0) {
        return NextResponse.json(
          { error: "舊版股票股利合成紀錄無法歸屬至此股利，無法安全刪除；請先整理後再試" },
          { status: 409 },
        );
      }
      if (legacyMatches.length > 1) {
        return NextResponse.json(
          { error: "同日有多筆無法區分的舊版股票股利合成紀錄，無法安全刪除；請先整理後再試" },
          { status: 409 },
        );
      }
      if (legacyMatches.length > 0) {
        const unlinkedDividendCount = countUnlinkedStockDividendRecords(
          auth.userId,
          String(old.stock_id),
          String(old.date),
          targetShares,
        );
        if (legacyMatches.length !== unlinkedDividendCount) {
          return NextResponse.json(
            { error: "同日有重複的舊版股票股利合成紀錄，無法安全刪除；請先整理重複股利紀錄" },
            { status: 409 },
          );
        }
        legacyStockDividendTxId = String(legacyMatches[0].id);
      }
    }
  }

  const db = getDB();
  let linkedTransactionDeleted = false;
  let dripTransactionDeleted = false;
  db.run("BEGIN");
  try {
    // New synthetic buys carry an explicit owner-dividend id, so same-day
    // dividends for one stock can never delete each other's FIFO lots.
    const linked = findDividendSyntheticTransactions(auth.userId, String(id));
    const removedIds = linked.map((tx) => String(tx.id));
    if (legacyStockDividendTxId) removedIds.push(legacyStockDividendTxId);
    const chain = validateStockTransactionChainChanges(
      auth.userId,
      String(old.stock_id),
      removedIds,
    );
    if (!chain.ok) {
      db.run("ROLLBACK");
      return NextResponse.json(
        { error: `刪除此股利會造成 ${chain.conflictDate} 持有量為負 (預期 ${chain.expectedShares} 股)` },
        { status: 409 },
      );
    }
    linked.forEach((tx) => {
      db.run("DELETE FROM stock_transactions WHERE id = ?", [tx.id]);
      if (String(tx.note || "").startsWith(DRIP_SYNTH_NOTE_PREFIX)) {
        dripTransactionDeleted = true;
      } else {
        linkedTransactionDeleted = true;
      }
    });
    if (legacyStockDividendTxId) {
      db.run("DELETE FROM stock_transactions WHERE id = ?", [legacyStockDividendTxId]);
      linkedTransactionDeleted = true;
    }

    db.run("DELETE FROM stock_dividends WHERE id = ? AND user_id = ?", [
      id,
      auth.userId,
    ]);
    db.run("COMMIT");
  } catch (error) {
    try {
      db.run("ROLLBACK");
    } catch (_) {
      /* noop */
    }
    return NextResponse.json(
      { error: "刪除股利失敗：" + error.message },
      { status: 500 },
    );
  }
  saveDB();

  return NextResponse.json({
    ok: true,
    linkedTransactionDeleted,
    dripTransactionDeleted,
  });
}

export const PUT = withLedgerWriteAudit(handlePUT);
export const DELETE = withLedgerWriteAudit(handleDELETE);
