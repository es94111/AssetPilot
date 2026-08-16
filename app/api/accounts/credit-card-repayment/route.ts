import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { queryOne } from '../../../../lib/db';
import { normalizeCurrency, normalizeDate } from '../../../../lib/accountHelpers';
import { todayInUserTz } from '../../../../lib/userTime';
import {
  collectPayableCards,
  computeRepaymentAllocation,
  executeRepayment,
} from '../../../../lib/creditCardRepayment';
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

  // 分配與幣別換算（FR-002、FR-010）：計算邏輯只有一份實作（lib/creditCardRepayment.ts）。
  // 沿用同一個 try/catch 外殼——原本包的是 allocateRepayment() 例外來源，現在換了一層呼叫。
  let details: ReturnType<typeof computeRepaymentAllocation>;
  try {
    details = computeRepaymentAllocation(auth.userId, fromCurrency, totalAmount, payableCards);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '分配計算失敗' }, { status: 500 });
  }

  // 2N 筆交易 ＋ 1 筆摘要的原子寫入（FR-017／017a）；既有網頁/App 路徑傳 aiCreated: false。
  // executeRepayment() 任何例外一律 ROLLBACK 後 throw，這裡轉既有固定字串 500（逐字元相同）。
  let result: ReturnType<typeof executeRepayment>;
  try {
    result = executeRepayment({
      userId: auth.userId,
      fromAccountId,
      fromAccountName: fromAccount.name,
      fromCurrency,
      date: txDate,
      totalAmount,
      inputMode,
      details,
      aiCreated: false,
    });
  } catch {
    return NextResponse.json({ error: '還款寫入失敗，本次全部未寫入' }, { status: 500 });
  }

  // 回應：contracts 的 RepaymentResponse（形狀逐位元不變，allocations 直接使用 executeRepayment 回傳值）
  return NextResponse.json({
    ok: true,
    summaryId: result.summaryId,
    date: txDate,
    fromAccountId,
    currency: fromCurrency,
    totalAmount,
    allocations: result.allocations,
  });
}