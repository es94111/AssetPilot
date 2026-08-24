import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/apiHelpers";
import { queryOne } from "../../../../lib/db";
import {
    normalizeCurrency,
    convertToTwd,
    normalizeDate,
} from "../../../../lib/accountHelpers";
import { todayInUserTz } from "../../../../lib/userTime";
import { insertTransferPair } from "../../../../lib/transactionWriteCore";

interface TransferRequest {
    fromAccountId?: string;
    fromId?: string;
    toAccountId?: string;
    toId?: string;
    amount?: number | string;
    note?: string;
    date?: string | null;
}

interface TransferAccountRow {
    id: string;
    currency: string | null;
}

function asRow<T>(
    row: Record<string, string | number | null> | null,
): T | null {
    // SAFETY: the SELECT list is controlled by each caller; the generic only
    // describes that fixed row shape over the adapter's scalar record.
    return row as unknown as T | null;
}

export async function POST(request: NextRequest) {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const body = (await request.json().catch(() => ({}))) as TransferRequest;
    const fromId = body.fromAccountId ?? body.fromId;
    const toId = body.toAccountId ?? body.toId;
    const { amount, note } = body;
    const rawDate = body.date;

    if (!fromId || !toId)
        return NextResponse.json({ error: "缺少帳戶資訊" }, { status: 400 });
    if (fromId === toId)
        return NextResponse.json(
            { error: "轉出與轉入帳戶不可相同" },
            { status: 400 },
        );
    if (!Number.isFinite(Number(amount)) || Number(amount) <= 0) {
        return NextResponse.json({ error: "金額必須大於 0" }, { status: 400 });
    }

    const fromAccount = asRow<TransferAccountRow>(
        queryOne(
            "SELECT id, currency FROM accounts WHERE id = ? AND user_id = ?",
            [fromId, auth.userId],
        ),
    );
    const toAccount = asRow<TransferAccountRow>(
        queryOne(
            "SELECT id, currency FROM accounts WHERE id = ? AND user_id = ?",
            [toId, auth.userId],
        ),
    );
    if (!fromAccount || !toAccount)
        return NextResponse.json({ error: "NotFound" }, { status: 404 });

    const fromCurrency = normalizeCurrency(fromAccount.currency);
    const toCurrency = normalizeCurrency(toAccount.currency);
    if (fromCurrency !== toCurrency) {
        return NextResponse.json(
            {
                error: "CrossCurrencyTransfer",
                message: "跨幣別請分開記一筆支出 + 一筆收入",
            },
            { status: 422 },
        );
    }

    let converted;
    try {
        converted = convertToTwd(
            Number(amount),
            fromCurrency,
            null,
            auth.userId,
        );
    } catch (e) {
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "轉帳金額格式錯誤" },
            { status: 400 },
        );
    }

    const hasDate = rawDate != null && String(rawDate).trim() !== "";
    const txDate = hasDate
        ? normalizeDate(rawDate)
        : todayInUserTz(auth.userTimezone);
    if (hasDate && !txDate) {
        return NextResponse.json(
            { error: "日期格式無效", code: "ValidationError", field: "date" },
            { status: 400 },
        );
    }
    const txNote = note || "轉帳";

    let pair;
    try {
        pair = insertTransferPair({
            userId: auth.userId,
            fromAccountId: fromId,
            toAccountId: toId,
            fromCurrency,
            toCurrency,
            twdAmount: converted.twdAmount,
            originalAmount: converted.originalAmount,
            fxRate: converted.fxRate,
            date: txDate,
            note: txNote,
        });
    } catch (e) {
        return NextResponse.json(
            {
                error: "轉帳建立失敗",
                message: String(e instanceof Error ? e.message : e),
            },
            { status: 500 },
        );
    }
    return NextResponse.json({ ...pair, ok: true }, { status: 201 });
}
