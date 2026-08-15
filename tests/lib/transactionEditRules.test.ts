import assert from 'node:assert/strict';
import test from 'node:test';
import { findTransactionEditBlock, TRANSACTION_NOTE_MAX_LENGTH } from '../../lib/transactionEditRules.ts';

// 純函式測試，不需要資料庫 —— 刻意不加 DATABASE_URL 略過守衛，這正是它能在無資料庫的 CI 環境
// 也跑得動的價值。釘住「抽出 is_fx_fee 規則時不得疏漏」的迴歸護欄（plan.md Principle V 第 6 款風險一）。

const FX_FEE_MESSAGE = '此為自動產生的國外刷卡手續費交易，請改編輯對應的國外交易（修改後手續費會自動同步）';

test('findTransactionEditBlock 對 is_fx_fee=1 回傳 FxFeeImmutable 422 阻擋', () => {
  const block = findTransactionEditBlock({ is_fx_fee: 1 });
  assert.ok(block, '應回傳阻擋物件');
  assert.equal(block!.code, 'FxFeeImmutable');
  assert.equal(block!.status, 422);
  // 訊息必須與既有路由逐字元相同（迴歸護欄）
  assert.equal(block!.message, FX_FEE_MESSAGE);
});

test('findTransactionEditBlock 對 is_fx_fee=0 與 null 回傳 null（可編輯）', () => {
  assert.equal(findTransactionEditBlock({ is_fx_fee: 0 }), null);
  assert.equal(findTransactionEditBlock({ is_fx_fee: null }), null);
});

test('TRANSACTION_NOTE_MAX_LENGTH 為 200', () => {
  assert.equal(TRANSACTION_NOTE_MAX_LENGTH, 200);
});