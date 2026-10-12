import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aggregateTagStats,
  dedupeIds,
  formatTagCell,
  normalizeTagName,
  parseTagCell,
  parseTagMode,
  tagNameKey,
  validateTagName,
  TAG_MAX_PER_TRANSACTION,
  type TagStatLink,
} from '../../lib/transactionTagRules.ts';

test('名稱正規化：NFKC、空白折疊、不分大小寫', () => {
  assert.equal(normalizeTagName('  旅遊　 2026 '), '旅遊 2026');
  assert.equal(tagNameKey('ＡＢＣ'), tagNameKey('abc'));
  assert.equal(validateTagName('   ').ok, false);
  assert.equal(validateTagName('x'.repeat(31)).ok, false);
  assert.deepEqual(validateTagName(' ok '), { ok: true, name: 'ok' });
});

test('parseTagCell / formatTagCell', () => {
  assert.deepEqual(parseTagCell('[]'), []);
  assert.deepEqual(parseTagCell('旅遊|聚餐, 旅遊、Work'), ['旅遊', '聚餐', 'Work']);
  assert.deepEqual(parseTagCell('["a","A","b"]'), ['a', 'b']);
  assert.equal(parseTagCell(Array.from({ length: 30 }, (_, i) => `t${i}`).join('|')).length, TAG_MAX_PER_TRANSACTION);
  assert.equal(formatTagCell(['a', 'b|c']), 'a|b｜c');
});

test('parseTagMode / dedupeIds', () => {
  assert.equal(parseTagMode('ALL'), 'all');
  assert.equal(parseTagMode('x'), 'any');
  assert.deepEqual(dedupeIds(['a', ' a ', '', 'b', 1]), ['a', 'b']);
});

const links: TagStatLink[] = [
  { txId: 't1', tagId: 'A', type: 'expense', amount: 100, month: '2026-01', categoryId: 'c1' },
  { txId: 't1', tagId: 'B', type: 'expense', amount: 100, month: '2026-01', categoryId: 'c1' },
  { txId: 't2', tagId: 'A', type: 'expense', amount: 50, month: '2026-02', categoryId: 'c2' },
  { txId: 't3', tagId: 'B', type: 'income', amount: 30, month: '2026-02', categoryId: 'c3' },
];

test('統計：各標籤重複計入，合計依交易去重', () => {
  const r = aggregateTagStats(links, ['A', 'B'], 'any');
  const a = r.perTag.find((x) => x.tagId === 'A')!;
  const b = r.perTag.find((x) => x.tagId === 'B')!;
  assert.equal(a.expense, 150);
  assert.equal(b.expense, 100);
  assert.equal(r.combined.expense, 150);
  assert.equal(r.combined.income, 30);
  assert.equal(r.combined.count, 3);
  assert.ok(a.expense + b.expense > r.combined.expense);
});

test('統計：All 模式只含同時具備所有標籤的交易', () => {
  const r = aggregateTagStats(links, ['A', 'B'], 'all');
  assert.equal(r.combined.count, 1);
  assert.equal(r.combined.expense, 100);
  assert.deepEqual(r.crossAnalysis, [
    { month: '2026-01', categoryId: 'c1', expense: 100, income: 0, count: 1 },
  ]);
});

test('統計：交叉分析依月份×分類去重', () => {
  const r = aggregateTagStats(links, [], 'any');
  assert.equal(r.crossAnalysis.length, 3);
  assert.equal(r.crossAnalysis[0].expense, 100);
});
