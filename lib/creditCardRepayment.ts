// lib/creditCardRepayment.ts — 信用卡總金額還款的伺服器端共用邏輯（需要 DB）。
// 供寫入端點（POST /api/accounts/credit-card-repayment）與快照端點
// （GET /api/accounts/{id}/repayment-cards）共用，確保 FR-003 的納入規則與 FR-011 的換算只有一份實作。
import Decimal from 'decimal.js';
import { queryAll } from './db';
import {
  normalizeCurrency,
  calcBalance,
  getExchangeRateToTwdAsDecimal,
} from './accountHelpers';

export interface PayableCard {
  id: string;
  name: string;
  currency: string;
  debt: number; // 付款帳戶幣別的正整數欠款（≥ 1，FR-011a：< 1 一律進位為 1）
  debtInCardCurrency: number; // 卡片幣別欠款（顯示用）
  createdAt: string; // accounts.created_at 原值；僅供伺服器內部排序，不得輸出到 HTTP
}

interface CardAccountRow {
  id: string;
  name: string;
  currency: string | null;
  initial_balance: number | string | null;
  linked_bank_id: string | null;
  created_at: string | number | null;
}

function asRow<T>(row: Record<string, string | number | null> | null): T | null {
  return row as unknown as T | null;
}

/**
 * 取得以 fromAccount 為付款來源時本次納入的信用卡，已依標準順序排好
 * （建立時間早→晚，相同再 id 升冪；FR-003、FR-005b、FR-011）。
 *
 * 納入規則（FR-003）：account_type = '信用卡' 且 linked_bank_id = fromAccountId 且餘額為負（有欠款）。
 * 欠款換算（FR-011）：同幣別 round_half_up(-balance)；異幣別經兩個匯率換算後 half-up；
 *   換算後 < 1 者設為 1（FR-011a：有欠款即必須納入，權重不得為 0）。
 */
export function collectPayableCards(
  userId: string,
  fromAccountId: string,
  fromCurrency: string,
): PayableCard[] {
  const payerCcy = normalizeCurrency(fromCurrency);
  const rows = queryAll(
    "SELECT id, name, currency, initial_balance, linked_bank_id, created_at FROM accounts WHERE user_id = ? AND account_type = '信用卡' AND linked_bank_id = ?",
    [userId, fromAccountId],
  );

  const cards: PayableCard[] = [];
  for (const r of rows) {
    const a = asRow<CardAccountRow>(r);
    if (!a) continue;
    const cardCcy = normalizeCurrency(a.currency);
    const balance = calcBalance(a.id, Number(a.initial_balance) || 0, userId, cardCcy);
    if (balance >= 0) continue; // 無欠款（餘額 0 或正值）→ 排除（FR-003）

    const debtInCardCurrency = -balance; // 卡片幣別欠款原值（顯示用）
    let debt: number;
    if (cardCcy === payerCcy) {
      // 同幣別：round_half_up(-balance)
      debt = new Decimal(debtInCardCurrency).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
    } else {
      // 異幣別：debt = round_half_up(-balance × rate(card) ÷ rate(payer))
      const rateCard = new Decimal(getExchangeRateToTwdAsDecimal(userId, cardCcy));
      const ratePayer = new Decimal(getExchangeRateToTwdAsDecimal(userId, payerCcy));
      debt = new Decimal(debtInCardCurrency)
        .times(rateCard)
        .div(ratePayer)
        .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
        .toNumber();
    }
    if (debt < 1) debt = 1; // FR-011a：權重不得為 0

    cards.push({
      id: a.id,
      name: String(a.name),
      currency: cardCcy,
      debt,
      debtInCardCurrency,
      createdAt: String(a.created_at ?? ''),
    });
  }

  // 標準排序（FR-005b）：created_at 由早到晚；相同則 id 字串升冪。
  // 注意 accounts.created_at 只有 YYYY-MM-DD 日期粒度，同日建立者實際由 id 決定（字串比較即可）。
  cards.sort((a, b) => {
    const ca = String(a.createdAt);
    const cb = String(b.createdAt);
    if (ca < cb) return -1;
    if (ca > cb) return 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  return cards;
}