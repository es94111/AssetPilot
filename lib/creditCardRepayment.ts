// lib/creditCardRepayment.ts — 信用卡總金額還款的伺服器端共用邏輯（需要 DB）。
// 供寫入端點（POST /api/accounts/credit-card-repayment）與快照端點
// （GET /api/accounts/{id}/repayment-cards）共用，確保 FR-003 的納入規則與 FR-011 的換算只有一份實作。
// 007-mcp-credit-card-repayment 新增三個共用函式（computeRepaymentAllocation／executeRepayment／
// evaluateRepaymentSummary），讓既有兩支 HTTP 路由與三個新 MCP 工具共用同一份計算與寫入邏輯
// （FR-002、FR-010、FR-012）——計算邏輯只有一份實作，不得另外寫第二份。
import Decimal from 'decimal.js';
import { queryAll, queryOne, getDB, saveDB } from './db';
import {
  normalizeCurrency,
  calcBalance,
  getExchangeRateToTwdAsDecimal,
  convertToTwd,
  convertFromTwd,
} from './accountHelpers';
import type { ConvertToTwdResult } from './accountHelpers';
import { uid } from './userDefaults';
import { allocateRepayment } from './creditCardRepaymentAllocation';

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

// ── 007 共用函式：計算、寫入、陳舊判定只有一份實作 ──────────────────────────────────
// 以下三個匯出函式從既有兩支 HTTP 路由原樣抽出，供既有路由與三個新 MCP 工具共用同一份程式碼
// （FR-002、FR-010、FR-012；research.md 第 2、7 節）。

/**
 * 內部形狀：單張卡的完整分配明細（含幣別換算中間值），不直接對外輸出。
 * 對外輸出請用 {@link PublicAllocation} 窄化形狀（FR-013：不外洩 fxRate／twdAmount 等帳本實作細節）。
 */
export interface AllocationDetail {
  card: PayableCard;              // 既有型別（006），含 id/name/currency/debt/debtInCardCurrency
  transferAmount: number;         // 付款帳戶幣別整數（= allocateRepayment 的結果）
  toCurrency: string;             // 該卡幣別
  outConverted: ConvertToTwdResult; // convertToTwd() 既有回傳形狀（twdAmount/originalAmount/fxRate/currency）
  inOriginal: number;             // 卡片幣別金額（換算後，寫入 transfer_in.original_amount）
  inConverted: ConvertToTwdResult;
  balanceAfter: number;           // 卡片幣別；= card.debtInCardCurrency + inOriginal
                                   // （逐字比照既有 POST /api/accounts/credit-card-repayment
                                   //   回應公式，research.md 第 3 節）
}

/**
 * 對外輸出形狀：MCP 回應與既有路由回應共用，只含使用者需看到的欄位。
 */
export interface PublicAllocation {
  cardId: string;
  cardName: string;
  cardCurrency: string;
  amount: number;                 // 付款帳戶幣別整數分配金額
  amountInCardCurrency: number;
  balanceAfter: number;
}

/**
 * 依 totalAmount 與已取得的 payableCards 計算分配結果與卡片幣別換算（FR-002、FR-010）。
 *
 * **純讀取**：只呼叫 `convertToTwd`／`convertFromTwd` 查匯率，**不寫入任何資料**——這使試算工具
 * （`get_credit_card_repayment_preview`）在型別層面就不可能觸及寫入路徑（research.md 第 2 節）。
 * `allocateRepayment()` 的既有後置條件 assert 若失敗會直接 `throw`，呼叫端自行決定如何處理
 * （route.ts 包 try/catch 轉 500；MCP 工具讓例外原樣拋出）。
 */
export function computeRepaymentAllocation(
  userId: string,
  fromCurrency: string,
  totalAmount: number,
  payableCards: PayableCard[],
): AllocationDetail[] {
  // 分配（FR-002）：前置／後置條件由 allocateRepayment assert，違反時 throw。
  const allocations = allocateRepayment(
    totalAmount,
    payableCards.map((c) => ({ id: c.id, debt: c.debt })),
  );

  // 對每張卡依既有 route.ts:139-143 的換算流程算出 outConverted／inOriginal／inConverted。
  return payableCards.map((card, i) => {
    const transferAmount = allocations[i].amount; // 付款帳戶幣別整數
    const toCurrency = card.currency;

    const outConverted = convertToTwd(transferAmount, fromCurrency, null, userId);
    const inOriginal = toCurrency === fromCurrency
      ? transferAmount
      : convertFromTwd(outConverted.twdAmount, toCurrency, userId);
    const inConverted = convertToTwd(inOriginal, toCurrency, null, userId);

    // 還款後餘額（卡片幣別）：逐字比照既有 route.ts:188 公式
    // card.debtInCardCurrency + inOriginal（原欠款（正）＋ 轉入 → 還款後餘額）
    const balanceAfter = card.debtInCardCurrency + inOriginal;

    return {
      card,
      transferAmount,
      toCurrency,
      outConverted,
      inOriginal,
      inConverted,
      balanceAfter,
    };
  });
}

/**
 * `executeRepayment()` 的參數。`details` 須為 {@link computeRepaymentAllocation} 的結果。
 */
export interface ExecuteRepaymentParams {
  userId: string;
  fromAccountId: string;
  fromAccountName: string;
  fromCurrency: string;
  date: string;
  totalAmount: number;
  inputMode: 'total' | 'legacy_items';
  details: AllocationDetail[];     // computeRepaymentAllocation() 的結果
  aiCreated: boolean;              // FR-007：MCP 呼叫傳 true，既有網頁/App 路徑傳 false
}

export interface ExecuteRepaymentResult {
  summaryId: string;
  allocations: PublicAllocation[];
}

/**
 * 2N 筆交易 ＋ 1 筆摘要的原子寫入（BEGIN/COMMIT/ROLLBACK），從既有
 * POST /api/accounts/credit-card-repayment 路由原樣抽出（FR-001、FR-002、FR-004、FR-006、FR-007）。
 *
 * 兩個既有 INSERT 陳述式各自的欄位清單新增 `ai_created`，值取自 `params.aiCreated`
 * （research.md 第 9 節）。**不在此函式內組 HTTP 錯誤回應**——任何例外 `ROLLBACK` 後原樣拋出，
 * 讓呼叫端決定措辭（route.ts 轉固定字串 500；MCP 工具讓 MCP SDK 轉為 `isError: true`）。
 */
export function executeRepayment(params: ExecuteRepaymentParams): ExecuteRepaymentResult {
  const { userId, fromAccountId, fromAccountName, fromCurrency, date: txDate, totalAmount, inputMode, details, aiCreated } = params;
  const summaryId = uid();
  const now = Date.now();

  // 內部快照形狀同既有 AllocationSnapshot（寫入 credit_card_repayment_summaries.allocations）
  interface AllocationSnapshot {
    cardId: string;
    cardName: string;
    cardCurrency: string;
    amount: number;          // 付款帳戶幣別整數
    amountInCardCurrency: number;
    debtAtWrite: number;
    transferOutId: string;
    transferInId: string;
  }
  const snapshots: AllocationSnapshot[] = [];

  const db = getDB();
  // FR-017／017a：2N 筆交易 ＋ 1 筆摘要同一交易內完成；任何例外一律 ROLLBACK 後 throw。
  try {
    db.run('BEGIN');
    for (const detail of details) {
      const { card, transferAmount, toCurrency, outConverted, inOriginal, inConverted } = detail;
      const aiCreatedFlag = aiCreated ? 1 : 0; // FR-007：新增 ai_created 欄位

      const outId = uid();
      const inId = uid();
      db.run(
        'INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,fx_fee,twd_amount,date,category_id,account_id,to_account_id,note,linked_id,repayment_summary_id,ai_created,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [outId, userId, 'transfer_out', outConverted.twdAmount, fromCurrency, outConverted.originalAmount, outConverted.fxRate, 0, outConverted.twdAmount, txDate, '', fromAccountId, card.id, '信用卡還款', inId, summaryId, aiCreatedFlag, now, now]
      );
      db.run(
        'INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,fx_fee,twd_amount,date,category_id,account_id,to_account_id,note,linked_id,repayment_summary_id,ai_created,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [inId, userId, 'transfer_in', inConverted.twdAmount, toCurrency, inConverted.originalAmount, inConverted.fxRate, 0, inConverted.twdAmount, txDate, '', card.id, fromAccountId, '信用卡還款', outId, summaryId, aiCreatedFlag, now, now]
      );

      snapshots.push({
        cardId: card.id,
        cardName: card.name,
        cardCurrency: toCurrency,
        amount: transferAmount,
        amountInCardCurrency: inOriginal,
        debtAtWrite: card.debt,
        transferOutId: outId,
        transferInId: inId,
      });
    }

    // 寫入摘要（input_mode 與 from_account_name 必須明確給值，不得倚賴預設）
    db.run(
      'INSERT INTO credit_card_repayment_summaries (id,user_id,date,from_account_id,from_account_name,from_currency,total_amount,input_mode,allocations,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [summaryId, userId, txDate, fromAccountId, fromAccountName, fromCurrency, totalAmount, inputMode, JSON.stringify(snapshots), now, now]
    );

    db.run('COMMIT');
  } catch (err) {
    try { db.run('ROLLBACK'); } catch (_) { /* 忽略回滾失敗 */ }
    throw err;
  }

  saveDB();

  // 回傳 PublicAllocation：由 details 上已算好的值組出，不重算
  const allocations: PublicAllocation[] = details.map((d) => ({
    cardId: d.card.id,
    cardName: d.card.name,
    cardCurrency: d.card.currency,
    amount: d.transferAmount,
    amountInCardCurrency: d.inOriginal,
    balanceAfter: d.balanceAfter,
  }));

  return { summaryId, allocations };
}

/**
 * 清單／單筆查詢時各卡的陳舊狀態（FR-011、FR-012）。
 */
export interface RepaymentAllocationStatus {
  cardId: string;
  cardName: string;
  cardCurrency: string;
  amount: number;
  amountInCardCurrency: number;
  status: 'intact' | 'modified' | 'deleted';
}

// 金額比對容差（research.md 第 7 節）：original_amount 為 REAL，需容許往返誤差。
// 逐字沿用既有 GET /api/credit-card-repayment-summaries/[id]/route.ts 的常數，不重新推導，
// 避免容差值日後在兩處各自硬編漂移。
const AMOUNT_TOLERANCE = 0.005;

/**
 * 讀取時比對各卡 status（intact／modified／deleted），從既有
 * GET /api/credit-card-repayment-summaries/[id]/route.ts 原樣抽出（FR-011、FR-012；research.md 第 7 節）。
 *
 * 函式簽章刻意只吃 `date`／`from_account_id`／`allocations` 三個欄位——這是 T005 與
 * `list_credit_card_repayments` 的 SQL 查詢結果列天然具備的最小交集，呼叫端傳整個列物件即可，
 * 多餘欄位被忽略不影響型別相容。
 */
export function evaluateRepaymentSummary(
  userId: string,
  summary: { date: string; from_account_id: string; allocations: string },
): { allocations: RepaymentAllocationStatus[]; stale: boolean } {
  interface AllocationSnapshot {
    cardId: string;
    cardName: string;
    cardCurrency: string;
    amount: number;
    amountInCardCurrency: number;
    debtAtWrite: number;
    transferOutId: string;
    transferInId: string;
  }
  interface TxRow {
    date: string;
    account_id: string;
    to_account_id: string | null;
    original_amount: number;
    amount: number;
  }
  const asRow = <T>(row: Record<string, string | number | null> | null): T | null =>
    row as unknown as T | null;

  let snapshots: AllocationSnapshot[] = [];
  try {
    snapshots = JSON.parse(summary.allocations) as AllocationSnapshot[];
  } catch {
    snapshots = [];
  }

  let anyStale = false;
  const allocations: RepaymentAllocationStatus[] = snapshots.map((snap) => {
    const outRow = asRow<TxRow>(queryOne(
      'SELECT date, account_id, to_account_id, original_amount, amount FROM transactions WHERE id = ? AND user_id = ?',
      [snap.transferOutId, userId]
    ));
    const inRow = asRow<TxRow>(queryOne(
      'SELECT date, account_id, to_account_id, original_amount, amount FROM transactions WHERE id = ? AND user_id = ?',
      [snap.transferInId, userId]
    ));

    let status: 'intact' | 'modified' | 'deleted' = 'intact';
    if (!outRow || !inRow) {
      status = 'deleted';
    } else {
      // date 比對
      if (outRow.date !== summary.date || inRow.date !== summary.date) {
        status = 'modified';
      }
      // 轉出列：account_id = 付款帳戶、to_account_id = 該卡
      else if (outRow.account_id !== summary.from_account_id || outRow.to_account_id !== snap.cardId) {
        status = 'modified';
      }
      // 轉入列：account_id = 該卡
      else if (inRow.account_id !== snap.cardId) {
        status = 'modified';
      }
      // 金額比對（容差 0.005）
      else if (Math.abs(Number(outRow.original_amount) - snap.amount) >= AMOUNT_TOLERANCE
        || Math.abs(Number(inRow.original_amount) - snap.amountInCardCurrency) >= AMOUNT_TOLERANCE) {
        status = 'modified';
      }
    }
    if (status !== 'intact') anyStale = true;
    return {
      cardId: snap.cardId,
      cardName: snap.cardName,
      cardCurrency: snap.cardCurrency,
      amount: snap.amount,
      amountInCardCurrency: snap.amountInCardCurrency,
      status,
    };
  });

  return { allocations, stale: anyStale };
}