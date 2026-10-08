// tests/lib/smartCategorySuggestions.test.ts — 分類建議純函式（issue #252）
// 零相依、不需 PostgreSQL，可離線執行。
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SUGGESTION_DEFAULT_LIMIT,
  SUGGESTION_MIN_CONFIDENCE,
  diceCoefficient,
  suggestCategories,
  tokenizeNote,
  type SuggestionCandidateCategory,
} from '../../lib/smartCategorySuggestions.ts';

const CATEGORIES: SuggestionCandidateCategory[] = [
  { id: 'breakfast', name: '早餐', parentId: 'food', parentName: '餐飲' },
  { id: 'lunch', name: '午餐', parentId: 'food', parentName: '餐飲' },
  { id: 'subscription', name: '訂閱服務', parentId: 'fun', parentName: '娛樂' },
  { id: 'fuel', name: '加油', parentId: 'traffic', parentName: '交通' },
  { id: 'food', name: '餐飲', parentId: '', parentName: null },
];

function history(entries: Array<[string, string, string]>) {
  return entries.map(([categoryId, note, date]) => ({ categoryId, note, date }));
}

test('tokenizeNote 產生 CJK 單字與 bigram、拉丁詞彙小寫化', () => {
  const tokens = tokenizeNote('早餐 Coffee Shop');
  assert.ok(tokens.includes('早'), '應含單字 早');
  assert.ok(tokens.includes('早餐'), '應含 bigram 早餐');
  assert.ok(tokens.includes('coffee'), '拉丁詞應小寫化');
  assert.ok(tokens.includes('shop'));
  assert.deepEqual(tokenizeNote('   '), []);
  assert.deepEqual(tokenizeNote('!!! ,,, ???'), []);
  const koreanTokens = tokenizeNote('커피 구독');
  assert.ok(koreanTokens.includes('커'));
  assert.ok(koreanTokens.includes('커피'));
  assert.ok(koreanTokens.includes('구독'));
});

test('Hangul摘要可依歷史共現產生分類建議', () => {
  const result = suggestCategories({
    note: '커피 구독',
    type: 'expense',
    categories: [{ id: 'korean-subscription', name: '구독', parentId: 'fun', parentName: '娛樂' }],
    today: '2026-10-07',
    history: [
      { categoryId: 'korean-subscription', note: '커피 구독', date: '2026-10-01' },
      { categoryId: 'korean-subscription', note: '커피 구독', date: '2026-09-01' },
      { categoryId: 'korean-subscription', note: '커피 구독', date: '2026-08-01' },
    ],
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].categoryId, 'korean-subscription');
});

test('diceCoefficient 為對稱相似度且空集合為 0', () => {
  assert.equal(diceCoefficient([], ['a']), 0);
  assert.equal(diceCoefficient(['a'], []), 0);
  assert.equal(diceCoefficient(['a', 'b'], ['a', 'b']), 1);
  assert.equal(diceCoefficient(['a'], ['b']), 0);
  assert.equal(diceCoefficient(['a', 'b'], ['a', 'c']), 0.5);
});

test('依歷史摘要共現推薦分類並附信心度與支持筆數', () => {
  const result = suggestCategories({
    note: '早餐',
    type: 'expense',
    categories: CATEGORIES,
    today: '2026-10-07',
    history: history([
      ['breakfast', '早餐', '2026-10-01'],
      ['breakfast', '早餐 豆漿', '2026-09-20'],
      ['breakfast', '早餐', '2026-09-05'],
      ['lunch', '午餐', '2026-10-02'],
    ]),
  });
  assert.equal(result.length, 1, '只有早餐有詞彙交集');
  assert.equal(result[0].categoryId, 'breakfast');
  assert.equal(result[0].categoryName, '早餐');
  assert.equal(result[0].parentName, '餐飲');
  assert.equal(result[0].matchedCount, 3);
  assert.ok(result[0].confidence > 0.8, `信心度應偏高，實際 ${result[0].confidence}`);
  assert.ok(result[0].confidence <= 1);
});

test('沒有詞彙交集時不產生任何建議（不對使用者瞎猜）', () => {
  assert.deepEqual(
    suggestCategories({
      note: '完全無關的摘要',
      type: 'expense',
      categories: CATEGORIES,
      today: '2026-10-07',
      history: history([
        ['breakfast', '早餐', '2026-10-01'],
        ['fuel', '加油', '2026-10-01'],
      ]),
    }),
    [],
  );
});

test('空白摘要與空歷史皆回傳空陣列', () => {
  assert.deepEqual(suggestCategories({
    note: '   ', type: 'expense', categories: CATEGORIES, history: history([['breakfast', '早餐', '2026-10-01']]),
  }), []);
  assert.deepEqual(suggestCategories({
    note: '早餐', type: 'expense', categories: CATEGORIES, history: [],
  }), []);
});

test('父分類不會被建議（交易僅能指派至子分類）', () => {
  const result = suggestCategories({
    note: '餐飲',
    type: 'expense',
    categories: [{ id: 'food', name: '餐飲', parentId: '', parentName: null }],
    today: '2026-10-07',
    history: history([['food', '餐飲', '2026-10-01'], ['food', '餐飲', '2026-09-01']]),
  });
  assert.deepEqual(result, []);
});

test('歷史中指向不存在／已刪除分類的紀錄會被略過', () => {
  const result = suggestCategories({
    note: '早餐',
    type: 'expense',
    categories: CATEGORIES,
    today: '2026-10-07',
    history: history([
      ['deleted-category', '早餐', '2026-10-01'],
      ['breakfast', '早餐', '2026-10-02'],
    ]),
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].categoryId, 'breakfast');
  assert.equal(result[0].matchedCount, 1, '已刪除分類不應被計入支持筆數');
});

test('近期歷史比久遠歷史有更高權重（時間衰減）', () => {
  const recent = suggestCategories({
    note: '早餐',
    type: 'expense',
    categories: CATEGORIES,
    today: '2026-10-07',
    history: history([
      ['breakfast', '早餐', '2026-10-01'],
      ['lunch', '早餐', '2026-10-02'],
      ['breakfast', '早餐', '2026-09-28'],
    ]),
  });
  assert.equal(recent[0].categoryId, 'breakfast');

  const decayed = suggestCategories({
    note: '早餐',
    type: 'expense',
    categories: CATEGORIES,
    today: '2026-10-07',
    history: history([
      ['lunch', '早餐', '2026-10-06'],
      ['breakfast', '早餐', '2016-10-06'],
    ]),
  });
  assert.equal(decayed[0].categoryId, 'lunch', '近期證據應勝過久遠證據');
});

test('Top-N 限制與穩定排序（同分時名稱遞增）', () => {
  const many: SuggestionCandidateCategory[] = ['a', 'b', 'c', 'd', 'e'].map((suffix) => ({
    id: `cat-${suffix}`,
    name: `分類${suffix}`,
    parentId: 'p',
    parentName: '父',
  }));
  const result = suggestCategories({
    note: '早餐',
    type: 'expense',
    categories: many,
    today: '2026-10-07',
    limit: 3,
    history: history(many.flatMap((category) => [
      [category.id, '早餐', '2026-10-01'],
      [category.id, '早餐', '2026-09-01'],
    ])),
  });
  assert.equal(result.length, 3, `limit 應生效（預設 ${SUGGESTION_DEFAULT_LIMIT}）`);
  // 全部同分（同摘要、同筆數、同日期），故依名稱遞增。
  assert.deepEqual(result.map((item) => item.categoryName), ['分類a', '分類b', '分類c']);
});

test('信心度受證據量限制：單筆歷史不會取得滿分', () => {
  const result = suggestCategories({
    note: '早餐',
    type: 'expense',
    categories: CATEGORIES,
    today: '2026-10-07',
    history: history([['breakfast', '早餐', '2026-10-06']]),
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].confidence, 0.33, '1/3 證據量係數 → 0.33');
});

test('低於門檻的建議會被濾除且信心度落在 0～1', () => {
  const result = suggestCategories({
    note: '早餐',
    type: 'expense',
    categories: CATEGORIES,
    today: '2026-10-07',
    history: history([
      ['breakfast', '早餐', '2000-01-01'],
      ['lunch', '午餐', '2026-10-06'],
      ['subscription', '訂閱服務', '2026-10-06'],
      ['fuel', '加油', '2026-10-06'],
    ]),
  });
  for (const suggestion of result) {
    assert.ok(
      suggestion.confidence >= SUGGESTION_MIN_CONFIDENCE,
      `${suggestion.categoryId} 信心度 ${suggestion.confidence} 不應低於門檻`,
    );
    assert.ok(suggestion.confidence <= 1);
  }
});

test('相同輸入產生完全相同的輸出（可重現）', () => {
  const input = {
    note: '早餐',
    type: 'expense' as const,
    categories: CATEGORIES,
    today: '2026-10-07',
    history: history([
      ['breakfast', '早餐', '2026-10-01'],
      ['lunch', '早餐 午餐', '2026-10-02'],
    ]),
  };
  assert.deepEqual(suggestCategories(input), suggestCategories(input));
});
