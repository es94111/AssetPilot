import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';
import { normalizeCurrency, convertToTwd, convertFromTwd, normalizeDate } from '../../../../lib/accountHelpers';
import { uid } from '../../../../lib/userDefaults';
import { todayInUserTz } from '../../../../lib/userTime';
import { collectPayableCards } from '../../../../lib/creditCardRepayment';
import { allocateRepayment } from '../../../../lib/creditCardRepaymentAllocation';
import Decimal from 'decimal.js';

interface CreditCardRepaymentItem {
  cardId?: string;
  amount?: number | string;
}

interface CreditCardRepaymentRequest {
  fromAccountId?: string;
  date?: string | null;
  totalAmount?: number | string;
  repayments?: CreditCardRepaymentItem[];
}

interface RepaymentAccountRow {
  currency: string | null;
  account_type: string | null;
  name: string;
}

interface AllocationSnapshot {
  cardId: string;
  cardName: string;
  cardCurrency: string;
  amount: number; // 付款帳戶幣別整數
  amountInCardCurrency: number;
  debtAtWrite: number;
  transferOutId: string;
  transferInId: string;
}

function asRow<T>(row: Record<string, string | number | null> | null): T | null {
  return row as unknown as T | null;
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({})) as CreditCardRepaymentRequest;
  const { fromAccountId, date: rawDate, repayments } = body;

  // V1：fromAccountId 必填（沿用既有純訊息回應，無 code）
  if (!fromAccountId) {
    return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
  }

  // 取得付款帳戶
  const fromAccount = asRow<RepaymentAccountRow>(queryOne(
    'SELECT currency, account_type, name FROM accounts WHERE id = ? AND user_id = ?',
    [fromAccountId, auth.userId]
  ));
  // V1：付款帳戶不存在（沿用既有純訊息回應，無 code，狀態碼 400）
  if (!fromAccount) return NextResponse.json({ error: '付款帳戶不存在' }, { status: 400 });
  // V2：付款帳戶不可為信用卡（沿用既有純訊息回應，無 code）
  if (fromAccount.account_type === '信用卡') return NextResponse.json({ error: '付款帳戶不可為信用卡' }, { status: 400 });

  // 決定總金額與輸入模式（FR-019）
  let totalAmount: number;
  let inputMode: 'total' | 'legacy_items';
  if (body.totalAmount != null && String(body.totalAmount).trim() !== '') {
    // totalAmount 優先，忽略 repayments
    totalAmount = Number(body.totalAmount);
    inputMode = 'total';
  } else if (Array.isArray(repayments) && repayments.length > 0) {
    // 舊格式：以 decimal.js 加總，避免浮點殘留
    let sum = new Decimal(0);
    for (const { amount } of repayments) {
      sum = sum.plus(new Decimal(Number(amount) || 0));
    }
    // 加總結果須為整數（FR-019b）；非整數 → InvalidTotalAmount
    if (!sum.isInteger()) {
      return NextResponse.json({ error: '還款總金額須為大於 0 的整數', code: 'InvalidTotalAmount' }, { status: 400 });
    }
    totalAmount = sum.toNumber();
    inputMode = 'legacy_items';
  } else {
    // 兩者皆無 → 400（沿用既有純訊息）
    return NextResponse.json({ error: '缺少必要參數' }, { status: 400 });
  }

  // V3：totalAmount 為大於 0 的整數（FR-008、FR-019b）
  if (!Number.isInteger(totalAmount) || totalAmount <= 0) {
    return NextResponse.json({ error: '還款總金額須為大於 0 的整數', code: 'InvalidTotalAmount' }, { status: 400 });
  }

  const fromCurrency = normalizeCurrency(fromAccount.currency);
  const txDate = normalizeDate(rawDate) || todayInUserTz(auth.userTimezone);
  const now = Date.now();

  // FR-018：以送出當下重新取得的欠款計算（不沿用前端快照）
  const payableCards = collectPayableCards(auth.userId, fromAccountId, fromCurrency);

  // V4：納入卡片數 ≥ 1（FR-003、FR-009、FR-018a）
  if (payableCards.length === 0) {
    return NextResponse.json({ error: '此付款帳戶目前沒有可還款的信用卡', code: 'NoPayableCards' }, { status: 400 });
  }
  // V5：totalAmount ≥ 納入卡片數（FR-008a、FR-019b、FR-018a）
  if (totalAmount < payableCards.length) {
    return NextResponse.json(
      { error: `金額過小，至少需 ${payableCards.length} 才能讓每張卡都分配到`, code: 'TotalAmountTooSmall' },
      { status: 400 }
    );
  }

  // 分配（FR-002）：前置／後置條件由 allocateRepayment assert，違反時 throw
  let allocations: ReturnType<typeof allocateRepayment>;
  try {
    allocations = allocateRepayment(totalAmount, payableCards.map((c) => ({ id: c.id, debt: c.debt })));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '分配計算失敗' }, { status: 500 });
  }

  // 準備快照與寫入參數
  const summaryId = uid();
  const snapshots: AllocationSnapshot[] = [];
  const db = getDB();

  // FR-017／017a：2N 筆交易 ＋ 1 筆摘要同一交易內完成。
  // 沿用 lib/transactionWriteCore.ts insertTransferPair() 的 try／catch 形狀，
  // 任何例外一律 ROLLBACK 後回 500。
  try {
    db.run('BEGIN');
    for (let i = 0; i < payableCards.length; i++) {
      const card = payableCards[i];
      const alloc = allocations[i];
      const transferAmount = alloc.amount; // 付款帳戶幣別整數
      const toCurrency = card.currency;

      // 跨幣別換算沿用既有第 66-76 行流程，transferAmount 改由分配結果供給（FR-011）
      const outConverted = convertToTwd(transferAmount, fromCurrency, null, auth.userId);
      const inOriginal = toCurrency === fromCurrency
        ? transferAmount
        : convertFromTwd(outConverted.twdAmount, toCurrency, auth.userId);
      const inConverted = convertToTwd(inOriginal, toCurrency, null, auth.userId);

      const outId = uid();
      const inId = uid();
      db.run(
        'INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,fx_fee,twd_amount,date,category_id,account_id,to_account_id,note,linked_id,repayment_summary_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [outId, auth.userId, 'transfer_out', outConverted.twdAmount, fromCurrency, outConverted.originalAmount, outConverted.fxRate, 0, outConverted.twdAmount, txDate, '', fromAccountId, card.id, '信用卡還款', inId, summaryId, now, now]
      );
      db.run(
        'INSERT INTO transactions (id,user_id,type,amount,currency,original_amount,fx_rate,fx_fee,twd_amount,date,category_id,account_id,to_account_id,note,linked_id,repayment_summary_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
        [inId, auth.userId, 'transfer_in', inConverted.twdAmount, toCurrency, inConverted.originalAmount, inConverted.fxRate, 0, inConverted.twdAmount, txDate, '', card.id, fromAccountId, '信用卡還款', outId, summaryId, now, now]
      );

      // 還款後餘額（卡片幣別）：原欠款（正）＋ 轉入金額（> 0 代表預繳）
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
      [summaryId, auth.userId, txDate, fromAccountId, fromAccount.name, fromCurrency, totalAmount, inputMode, JSON.stringify(snapshots), now, now]
    );

    db.run('COMMIT');
  } catch (err) {
    try { db.run('ROLLBACK'); } catch (_) { /* 忽略回滾失敗 */ }
    return NextResponse.json({ error: '還款寫入失敗，本次全部未寫入' }, { status: 500 });
  }

  saveDB();

  // 回應：contracts 的 RepaymentResponse
  const responseAllocations = payableCards.map((card, i) => {
    const alloc = allocations[i];
    const snapshot = snapshots[i];
    const inOriginal = snapshot.amountInCardCurrency;
    const balanceAfter = card.debtInCardCurrency + inOriginal; // 原欠款（正） + 轉入 → 還款後餘額
    return {
      cardId: card.id,
      cardName: card.name,
      cardCurrency: card.currency,
      amount: alloc.amount,
      amountInCardCurrency: inOriginal,
      balanceAfter,
    };
  });

  return NextResponse.json({
    ok: true,
    summaryId,
    date: txDate,
    fromAccountId,
    currency: fromCurrency,
    totalAmount,
    allocations: responseAllocations,
  });
}