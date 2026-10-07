// tests/lib/reconciliationMatch.test.ts — 對帳差異比對純函式測試（issue #251）。
//
// 驗收條件要求對帳結果能列出三類差異：「帳本有、對帳單無」「對帳單有、帳本無」
// 「金額不符」。本測試逐類驗證，並涵蓋 FITID 精確配對、日期窗口、多筆同金額的
// 穩定性與輸入順序無關性。不需資料庫。
// 執行方式：node --experimental-transform-types --import tests/setup/register.mjs tests/lib/reconciliationMatch.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';

const { matchReconciliation } = await import('../../lib/reconciliationMatch.ts');

type LedgerEntry = {
  id: string;
  date: string;
  amount: number;
  direction: 'debit' | 'credit';
  description: string;
  fitid?: string;
};
type StatementEntry = {
  line: number;
  date: string;
  amount: number;
  direction: 'debit' | 'credit';
  description: string;
  fitid: string;
};

function ledger(partial: Partial<LedgerEntry> & { id: string; date: string; amount: number }): LedgerEntry {
  return {
    direction: 'debit',
    description: '',
    ...partial,
  } as LedgerEntry;
}

function statement(
  partial: Partial<StatementEntry> & { line: number; date: string; amount: number },
): StatementEntry {
  return {
    direction: 'debit',
    description: '',
    fitid: '',
    ...partial,
  } as StatementEntry;
}

test('完全相符時三類差異皆為空，且配對數等於雙方筆數', () => {
  const result = matchReconciliation(
    [
      ledger({ id: 'l1', date: '2026-09-03', amount: 1250 }),
      ledger({ id: 'l2', date: '2026-09-05', amount: 30000, direction: 'credit' }),
    ],
    [
      statement({ line: 2, date: '2026-09-03', amount: 1250 }),
      statement({ line: 3, date: '2026-09-05', amount: 30000, direction: 'credit' }),
    ],
  );

  assert.equal(result.diffs.length, 0);
  assert.equal(result.matchedCount, 2);
  assert.deepEqual(result.counts, { ledger_only: 0, statement_only: 0, amount_mismatch: 0 });
  assert.equal(result.ledgerTotal, 2);
  assert.equal(result.statementTotal, 2);
});

test('三類差異：帳本有對帳單無、對帳單有帳本無、金額不符', () => {
  const result = matchReconciliation(
    [
      ledger({ id: 'ledger-only', date: '2026-09-04', amount: 500, description: '帳本獨有' }),
      ledger({ id: 'mismatch', date: '2026-09-06', amount: 1000, description: '金額不符' }),
    ],
    [
      statement({ line: 7, date: '2026-09-08', amount: 700, description: '對帳單獨有' }),
      statement({ line: 9, date: '2026-09-06', amount: 1200, description: '金額不符' }),
    ],
  );

  assert.deepEqual(result.counts, { ledger_only: 1, statement_only: 1, amount_mismatch: 1 });

  const ledgerOnly = result.diffs.find((diff) => diff.kind === 'ledger_only');
  assert.ok(ledgerOnly);
  assert.equal(ledgerOnly.ledgerId, 'ledger-only');
  assert.equal(ledgerOnly.ledgerAmount, 500);
  assert.equal(ledgerOnly.statementAmount, 0);
  assert.equal(ledgerOnly.statementLine, 0);

  const statementOnly = result.diffs.find((diff) => diff.kind === 'statement_only');
  assert.ok(statementOnly);
  assert.equal(statementOnly.statementLine, 7);
  assert.equal(statementOnly.ledgerAmount, 0);
  assert.equal(statementOnly.statementAmount, 700);

  const mismatch = result.diffs.find((diff) => diff.kind === 'amount_mismatch');
  assert.ok(mismatch);
  assert.equal(mismatch.ledgerId, 'mismatch');
  assert.equal(mismatch.ledgerAmount, 1000);
  assert.equal(mismatch.statementAmount, 1200);
  assert.equal(mismatch.difference, -200);
  assert.equal(mismatch.confidence, 'fuzzy');
});

test('FITID 精確配對：日期相差很遠仍視為同一筆（入帳日與消費日不同）', () => {
  const result = matchReconciliation(
    [ledger({ id: 'l1', date: '2026-09-30', amount: 880, fitid: 'FIT-1' })],
    [statement({ line: 2, date: '2026-09-01', amount: 880, fitid: 'FIT-1' })],
  );

  assert.equal(result.diffs.length, 0);
  assert.equal(result.matchedCount, 1);
});

test('FITID 相同但金額不同 → 金額不符且信心度為 exact', () => {
  const result = matchReconciliation(
    [ledger({ id: 'l1', date: '2026-09-03', amount: 1000, fitid: 'FIT-9' })],
    [statement({ line: 2, date: '2026-09-03', amount: 1100, fitid: 'FIT-9' })],
  );

  assert.equal(result.counts.amount_mismatch, 1);
  assert.equal(result.diffs[0].confidence, 'exact');
  assert.equal(result.diffs[0].difference, -100);
});

test('日期窗口：超出窗口（預設 ±3 天）不配對，窗口內才配對', () => {
  const inside = matchReconciliation(
    [ledger({ id: 'l1', date: '2026-09-03', amount: 100 })],
    [statement({ line: 2, date: '2026-09-06', amount: 100 })],
  );
  assert.equal(inside.matchedCount, 1);
  assert.equal(inside.diffs.length, 0);

  const outside = matchReconciliation(
    [ledger({ id: 'l1', date: '2026-09-03', amount: 100 })],
    [statement({ line: 2, date: '2026-10-03', amount: 100 })],
  );
  assert.equal(outside.matchedCount, 0);
  assert.deepEqual(outside.counts, { ledger_only: 1, statement_only: 1, amount_mismatch: 0 });

  const customWindow = matchReconciliation(
    [ledger({ id: 'l1', date: '2026-09-03', amount: 100 })],
    [statement({ line: 2, date: '2026-09-10', amount: 100 })],
    { dateWindowDays: 7 },
  );
  assert.equal(customWindow.matchedCount, 1);
});

test('方向不同即使金額相同也不配對（支出不會吃掉收入）', () => {
  const result = matchReconciliation(
    [ledger({ id: 'l1', date: '2026-09-03', amount: 1000, direction: 'debit' })],
    [statement({ line: 2, date: '2026-09-03', amount: 1000, direction: 'credit' })],
  );
  assert.equal(result.matchedCount, 0);
  assert.deepEqual(result.counts, { ledger_only: 1, statement_only: 1, amount_mismatch: 0 });
});

test('多筆同金額：逐筆配對不重複，且結果不因輸入順序而異', () => {
  const ledgerEntries = [
    ledger({ id: 'l1', date: '2026-09-03', amount: 100 }),
    ledger({ id: 'l2', date: '2026-09-03', amount: 100 }),
  ];
  const statementEntries = [
    statement({ line: 2, date: '2026-09-03', amount: 100 }),
    statement({ line: 3, date: '2026-09-03', amount: 100 }),
  ];

  const forward = matchReconciliation(ledgerEntries, statementEntries);
  const reversed = matchReconciliation([...ledgerEntries].reverse(), [...statementEntries].reverse());

  assert.equal(forward.matchedCount, 2);
  assert.equal(forward.diffs.length, 0);
  assert.deepEqual(forward, reversed);
});

test('金額容差 1 分以內視為相同（對帳檔四捨五入差異）', () => {
  const result = matchReconciliation(
    [ledger({ id: 'l1', date: '2026-09-03', amount: 1250.0001 })],
    [statement({ line: 2, date: '2026-09-03', amount: 1250 })],
  );
  assert.equal(result.matchedCount, 1);
  assert.equal(result.diffs.length, 0);
});

test('模糊配對：同日同方向取最接近金額，每筆僅配對一次', () => {
  const result = matchReconciliation(
    [
      ledger({ id: 'a', date: '2026-09-04', amount: 1000 }),
      ledger({ id: 'b', date: '2026-09-04', amount: 5000 }),
    ],
    [
      statement({ line: 2, date: '2026-09-04', amount: 1100 }),
      statement({ line: 3, date: '2026-09-04', amount: 5400 }),
    ],
  );

  assert.equal(result.counts.amount_mismatch, 2);
  assert.equal(result.counts.ledger_only, 0);
  assert.equal(result.counts.statement_only, 0);

  const byLedger = new Map(result.diffs.map((diff) => [diff.ledgerId, diff.statementLine]));
  assert.equal(byLedger.get('a'), 2);
  assert.equal(byLedger.get('b'), 3);
});

test('金額不符推定僅限同日：日期不同且金額不同者一律歸為單邊缺漏', () => {
  // 日期相差 1 天（仍在日期配對窗口內）但金額不同；若放寬推定窗口，新的消費會被
  // 誤判成帳本某筆交易的金額不符，反而掩蓋「對帳單有、帳本無」這個真正要補登的差異。
  const result = matchReconciliation(
    [ledger({ id: 'l1', date: '2026-09-03', amount: 1000 })],
    [statement({ line: 2, date: '2026-09-04', amount: 1100 })],
  );

  assert.deepEqual(result.counts, { ledger_only: 1, statement_only: 1, amount_mismatch: 0 });
  assert.equal(result.matchedCount, 0);

  // 明確放寬推定窗口後才視為金額不符（供呼叫端依情境調整）。
  const relaxed = matchReconciliation(
    [ledger({ id: 'l1', date: '2026-09-03', amount: 1000 })],
    [statement({ line: 2, date: '2026-09-04', amount: 1100 })],
    { amountMismatchWindowDays: 1 },
  );
  assert.equal(relaxed.counts.amount_mismatch, 1);
});

test('空輸入不拋錯且計數為零', () => {
  const empty = matchReconciliation([], []);
  assert.deepEqual(empty.counts, { ledger_only: 0, statement_only: 0, amount_mismatch: 0 });
  assert.equal(empty.matchedCount, 0);
  assert.deepEqual(empty.diffs, []);

  const onlyLedger = matchReconciliation([ledger({ id: 'l1', date: '2026-09-03', amount: 1 })], []);
  assert.deepEqual(onlyLedger.counts, { ledger_only: 1, statement_only: 0, amount_mismatch: 0 });

  const onlyStatement = matchReconciliation([], [statement({ line: 2, date: '2026-09-03', amount: 1 })]);
  assert.deepEqual(onlyStatement.counts, { ledger_only: 0, statement_only: 1, amount_mismatch: 0 });
});
