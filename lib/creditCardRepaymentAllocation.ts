// lib/creditCardRepaymentAllocation.ts — 信用卡還款分配純函式（純整數運算，無 DB／無 Next.js 相依）。
//
// 權威定義見 specs/006-credit-card-total-repayment/research.md 第 4 節。
// 本檔同時被伺服器寫入端點與 Web 預覽（'use client' 元件）import，因此兩者不可能分歧；
// Dart 對照實作 mobile/lib/credit_card_repayment_allocation.dart 須逐步驟對應，
// 並以同一份 shared/repayment-allocation/cases.json 黃金測資釘住（FR-016a、SC-009）。
//
// 不得 import ./db 或任何伺服器限定模組。
//
// 註：本專案 tsconfig target 為 ES2017，不允許 BigInt 字面量（如 0n），
// 故此處以 BigInt(n) 建構式表達常數；執行期為 Node 24，BigInt 完全可用。

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TWO = BigInt(2);

export interface AllocationCard {
  id: string;
  debt: number; // 付款帳戶幣別的正整數欠款（呼叫端已正規化，恆 ≥ 1）
}

export interface AllocationResult {
  cardId: string;
  amount: number; // 付款帳戶幣別的整數分配金額，恆 ≥ 1
}

// halfUpDiv(n, m) = ⌊(2n + m) / 2m⌋，等價於 round_half_up(n / m)，全程 BigInt。
// n ≥ 0、m > 0；回傳非負整數。
function halfUpDiv(n: bigint, m: bigint): bigint {
  return (TWO * n + m) / (TWO * m); // BigInt 除法自動取下界
}

/**
 * 依 research.md 第 4 節的權威定義分配總金額。
 * @param totalAmount 正整數總金額（付款帳戶幣別）
 * @param cards 已依標準順序排好的卡片（建立時間早→晚，同值再 id 升冪），長度 ≥ 1
 * @throws 前置條件不成立（totalAmount 非正整數、cards 為空、totalAmount < cards.length）
 * @throws 後置條件不成立（總和 ≠ totalAmount，或任一 amount < 1）
 */
export function allocateRepayment(totalAmount: number, cards: AllocationCard[]): AllocationResult[] {
  // 前置條件（呼叫端先擋，函式再 assert）。
  if (!Array.isArray(cards) || cards.length < 1) {
    throw new Error('allocateRepayment: cards 至少需 1 張');
  }
  if (!Number.isInteger(totalAmount) || totalAmount <= 0) {
    throw new Error('allocateRepayment: totalAmount 必須為正整數');
  }
  if (totalAmount < cards.length) {
    throw new Error('allocateRepayment: totalAmount 不得小於卡片張數');
  }

  const n = cards.length;
  const T = BigInt(totalAmount);

  // 步驟 1：sumDebt = Σ debt_i
  let sumDebt = ZERO;
  const debts: bigint[] = [];
  for (const c of cards) {
    if (!Number.isInteger(c.debt) || c.debt < 1) {
      throw new Error('allocateRepayment: 每張卡 debt 必須為正整數');
    }
    const d = BigInt(c.debt);
    debts.push(d);
    sumDebt += d;
  }
  if (sumDebt <= ZERO) {
    throw new Error('allocateRepayment: sumDebt 必須 > 0');
  }

  // 步驟 2：anchor = 「欠款最大」的索引：由前往後掃描，只有嚴格大於目前最大值才更新
  //        → 並列時取陣列中最前者（＝建立時間最早、再 id 最小）（FR-005b）
  let anchor = 0;
  let maxDebt = debts[0];
  for (let i = 1; i < n; i++) {
    if (debts[i] > maxDebt) {
      maxDebt = debts[i];
      anchor = i;
    }
  }

  // 步驟 3：amount_i = halfUpDiv(T × debt_i, sumDebt)
  const amounts: bigint[] = new Array(n);
  let sumAmount = ZERO;
  for (let i = 0; i < n; i++) {
    amounts[i] = halfUpDiv(T * debts[i], sumDebt);
    sumAmount += amounts[i];
  }

  // 步驟 4：amount_anchor += T − Σ amount_i（殘差併入最大卡；有號）
  amounts[anchor] += T - sumAmount;

  // 步驟 5：對每個 amount_i < 1 者設為 1（FR-005a 保底）
  for (let i = 0; i < n; i++) {
    if (amounts[i] < ONE) amounts[i] = ONE;
  }

  // 步驟 6：diff = Σ amount_i − T
  let diff = amounts.reduce((acc, v) => acc + v, ZERO) - T;
  if (diff > ZERO) {
    // 依「amount 由大到小、同值依陣列順序」逐張扣減，每張最多扣到剩 1，直到 diff = 0。
    // ★ 排序在進入步驟 6 時計算一次（穩定排序），之後依該固定順序單趟掃描，
    //   每張卡最多被處理一次，不因扣減而重新排序。TS 與 Dart 兩端必須一致。
    //   單趟必然足夠：可扣總量 Σ(amount_i − 1) = T + diff − N ≥ diff，由前置條件 T ≥ N 保證。
    const order = amounts
      .map((v, idx) => ({ v, idx }))
      .sort((a, b) => (a.v < b.v ? 1 : a.v > b.v ? -1 : a.idx - b.idx));
    for (const { idx } of order) {
      if (diff <= ZERO) break;
      const canTake = amounts[idx] - ONE;
      if (canTake <= ZERO) continue;
      const take = canTake < diff ? canTake : diff;
      amounts[idx] -= take;
      diff -= take;
    }
  } else if (diff < ZERO) {
    // diff < 0：全數加到 anchor（防禦性分支：步驟 4 後總和已等於 T、步驟 5 只會增加，
    //   故此分支理論上不可達；保留以免未來調整步驟時靜默失衡）
    amounts[anchor] += -diff;
  }

  // 步驟 7：後置條件 assert
  const finalSum = amounts.reduce((acc, v) => acc + v, ZERO);
  if (finalSum !== T) {
    throw new Error(`allocateRepayment: 後置條件失敗（總和 ${finalSum} ≠ ${T}）`);
  }
  for (let i = 0; i < n; i++) {
    if (amounts[i] < ONE) {
      throw new Error(`allocateRepayment: 後置條件失敗（第 ${i} 張 amount ${amounts[i]} < 1）`);
    }
  }

  return cards.map((c, i) => ({ cardId: c.id, amount: Number(amounts[i]) }));
}