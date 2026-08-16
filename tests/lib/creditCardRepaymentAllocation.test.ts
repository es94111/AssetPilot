// tests/lib/creditCardRepaymentAllocation.test.ts — 不需 DB。
// 讀取 shared/repayment-allocation/cases.json，對每組案例斷言 allocateRepayment() 輸出與 expected
// 逐張相同，並額外斷言每組的後置條件（總和 = totalAmount、每張 ≥ 1）；另加前置條件違反時丟例外的案例。
// 執行方式：node --experimental-transform-types --import ./tests/setup/register.mjs tests/lib/creditCardRepaymentAllocation.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { allocateRepayment, type AllocationCard } from '../../lib/creditCardRepaymentAllocation.ts';

const here = dirname(fileURLToPath(import.meta.url));
const cases = JSON.parse(readFileSync(join(here, '..', '..', 'shared', 'repayment-allocation', 'cases.json'), 'utf8')) as Array<{
  name: string;
  totalAmount: number;
  debts: number[];
  expected: number[];
}>;

for (const c of cases) {
  test(`黃金測資：${c.name}`, () => {
    const cards: AllocationCard[] = c.debts.map((d, i) => ({ id: `card_${i}`, debt: d }));
    const result = allocateRepayment(c.totalAmount, cards);
    assert.equal(result.length, c.expected.length, '張數應相同');
    const got = result.map((r) => r.amount);
    assert.deepEqual(got, c.expected, `輸出應逐張等於期望值（got ${JSON.stringify(got)}）`);
    // 後置條件
    const sum = got.reduce((a, b) => a + b, 0);
    assert.equal(sum, c.totalAmount, '總和應等於 totalAmount');
    for (const a of got) assert.ok(a >= 1, '每張應 ≥ 1');
  });
}

test('後置條件：回傳的 cardId 對應輸入順序', () => {
  const cards: AllocationCard[] = [{ id: 'A', debt: 6000 }, { id: 'B', debt: 3000 }, { id: 'C', debt: 1000 }];
  const result = allocateRepayment(10000, cards);
  assert.deepEqual(result.map((r) => r.cardId), ['A', 'B', 'C']);
});

test('前置條件違反：cards 為空 → 丟例外', () => {
  assert.throws(() => allocateRepayment(100, []), /cards/);
});

test('前置條件違反：totalAmount 非正整數 → 丟例外', () => {
  assert.throws(() => allocateRepayment(0, [{ id: 'A', debt: 5 }]), /正整數/);
  assert.throws(() => allocateRepayment(5.5, [{ id: 'A', debt: 5 }]), /正整數/);
  assert.throws(() => allocateRepayment(-3, [{ id: 'A', debt: 5 }]), /正整數/);
});

test('前置條件違反：totalAmount < cards.length → 丟例外', () => {
  assert.throws(() => allocateRepayment(2, [{ id: 'A', debt: 5 }, { id: 'B', debt: 5 }, { id: 'C', debt: 5 }]), /張數/);
});

test('前置條件違反：debt 非正整數 → 丟例外', () => {
  assert.throws(() => allocateRepayment(100, [{ id: 'A', debt: 0 }]), /正整數/);
  assert.throws(() => allocateRepayment(100, [{ id: 'A', debt: 5 }, { id: 'B', debt: 2.5 }]), /正整數/);
});