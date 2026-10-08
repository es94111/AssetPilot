// @ts-nocheck
import { withLedgerWriteAudit } from "../../../../lib/ledgerContext";
import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryAll, queryOne, saveDB } from '../../../../lib/db';
import {
  hasAmbiguousLegacyStockDividendTransactions,
  hasUnmatchedLegacyStockDividendTransactions,
  validateStockTransactionChainChanges,
} from '../../../../lib/stockHelpers';

async function handlePOST(request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const { ids } = body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: '請選擇要刪除的紀錄' }, { status: 400 });
  }

  const uniqueIds = [...new Set(ids.map(String))];
  const dividends = uniqueIds
    .map((id) => ({
      id,
      row: queryOne(
        'SELECT * FROM stock_dividends WHERE id = ? AND user_id = ?',
        [id, auth.userId],
      ),
    }))
    .filter((item) => item.row);
  const db = getDB();
  let deleted = 0;
  let linkedDeleted = 0;

  db.run("BEGIN");
  try {
    // Preflight all legacy stock-dividend lots before deleting anything. Older
    // rows lack linked_dividend_id; only proceed when the remaining unmatched
    // dividends and indistinguishable synthetic lots have matching counts.
    const linkedByDividend = new Map<string, Array<Record<string, any>>>();
    const legacyByDividend = new Map<string, string>();
    const claimedLegacyIds = new Set<string>();
    for (const { id, row: old } of dividends) {
      const shares = Number(old.stock_dividend_shares);
      if (!(shares > 0)) continue;
      const linked = queryAll(
        "SELECT id, price, shares, note FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ? AND type = 'buy'",
        [auth.userId, id],
      );
      linkedByDividend.set(id, linked);
      const linkedStockDividendTx = linked.some(
        (tx) => Number(tx.price) === 0 && Math.abs(Number(tx.shares) - shares) < 0.001,
      );
      if (linkedStockDividendTx) continue;

      const legacyRowsForStock = queryAll(
        "SELECT id FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND type = 'buy' AND price = 0 AND COALESCE(linked_dividend_id, '') = '' AND (note LIKE '[SYNTH] 股票股利%' OR note LIKE '股票股利配發%')",
        [auth.userId, String(old.stock_id)],
      );
      if (
        legacyRowsForStock.length > 0 &&
        (hasUnmatchedLegacyStockDividendTransactions(auth.userId, String(old.stock_id)) ||
          hasAmbiguousLegacyStockDividendTransactions(auth.userId, String(old.stock_id)))
      ) {
        db.run("ROLLBACK");
        return NextResponse.json(
          { error: "此股票有無法配對的舊版股票股利合成紀錄，無法安全批次刪除；請先整理後再試" },
          { status: 409 },
        );
      }

      const legacyMatches = queryAll(
        "SELECT id, shares FROM stock_transactions WHERE user_id = ? AND stock_id = ? AND date = ? AND type = 'buy' AND price = 0 AND COALESCE(linked_dividend_id, '') = '' AND (note LIKE '[SYNTH] 股票股利%' OR note LIKE '股票股利配發%')",
        [auth.userId, old.stock_id, old.date],
      ).filter((tx) => Math.abs(Number(tx.shares) - shares) < 0.001);
      if (legacyRowsForStock.length > 0 && legacyMatches.length === 0) {
        db.run("ROLLBACK");
        return NextResponse.json(
          { error: "舊版股票股利合成紀錄無法歸屬至此股利，無法安全批次刪除；請先整理後再試" },
          { status: 409 },
        );
      }
      if (legacyMatches.length === 0) continue;

      const unlinkedDividendCount = Number(
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
          [auth.userId, old.stock_id, old.date, shares],
        )?.cnt || 0,
      );
      if (legacyMatches.length > 1 || legacyMatches.length !== unlinkedDividendCount) {
        db.run("ROLLBACK");
        return NextResponse.json(
          { error: "同日有無法區分的舊版股票股利合成紀錄，無法安全批次刪除；請先整理重複股利紀錄" },
          { status: 409 },
        );
      }
      const legacyMatch = legacyMatches.find((tx) => !claimedLegacyIds.has(String(tx.id)));
      if (legacyMatch) {
        legacyByDividend.set(id, String(legacyMatch.id));
        claimedLegacyIds.add(String(legacyMatch.id));
      }
    }

    const removedByStock = new Map<string, string[]>();
    for (const { id, row: old } of dividends) {
      const linked = linkedByDividend.get(id) || queryAll(
        "SELECT id, price, shares, note FROM stock_transactions WHERE user_id = ? AND linked_dividend_id = ? AND type = 'buy'",
        [auth.userId, id],
      );
      linkedByDividend.set(id, linked);
      const removeIds = removedByStock.get(String(old.stock_id)) || [];
      removeIds.push(...linked.map((tx) => String(tx.id)));
      const legacyId = legacyByDividend.get(id);
      if (legacyId) removeIds.push(legacyId);
      removedByStock.set(String(old.stock_id), removeIds);
    }
    for (const [stockId, removeIds] of removedByStock) {
      const chain = validateStockTransactionChainChanges(
        auth.userId,
        stockId,
        removeIds,
      );
      if (!chain.ok) {
        db.run("ROLLBACK");
        return NextResponse.json(
          { error: `批次刪除會造成 ${chain.conflictDate} 持有量為負 (預期 ${chain.expectedShares} 股)` },
          { status: 409 },
        );
      }
    }

    for (const { id, row: old } of dividends) {
      const linked = linkedByDividend.get(id) || [];
      linked.forEach((tx) => {
        db.run("DELETE FROM stock_transactions WHERE id = ?", [tx.id]);
        linkedDeleted += 1;
      });
      const legacyId = legacyByDividend.get(id);
      if (legacyId) {
        db.run('DELETE FROM stock_transactions WHERE id = ?', [legacyId]);
        linkedDeleted += 1;
      }

      db.run('DELETE FROM stock_dividends WHERE id = ? AND user_id = ?', [id, auth.userId]);
      deleted += db.getRowsModified();
    }
    db.run("COMMIT");
  } catch (error) {
    try {
      db.run("ROLLBACK");
    } catch (_) {
      /* noop */
    }
    return NextResponse.json(
      { error: "批次刪除股利失敗：" + error.message },
      { status: 500 },
    );
  }
  saveDB();

  return NextResponse.json({ deleted, linkedDeleted });
}

export const POST = withLedgerWriteAudit(handlePOST);
