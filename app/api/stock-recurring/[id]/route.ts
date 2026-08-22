// @ts-nocheck
import { NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/apiHelpers";
import { getDB, queryOne, saveDB } from "../../../../lib/db";

function normalizeDate(dateStr) {
  const s = String(dateStr || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export async function PUT(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const current = queryOne(
    "SELECT id, start_date, last_generated FROM stock_recurring WHERE id = ? AND user_id = ?",
    [id, auth.userId],
  );
  if (!current)
    return NextResponse.json({ error: "定期定額不存在" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const {
    stockId,
    amount,
    frequency,
    startDate: rawStartDate,
    accountId,
    note,
  } = body;
  const startDate = normalizeDate(rawStartDate);
  const nAmount = Number(amount);
  const validFreq = ["daily", "weekly", "monthly", "yearly"];
  if (
    !stockId ||
    !(nAmount > 0) ||
    !startDate ||
    !validFreq.includes(frequency)
  ) {
    return NextResponse.json({ error: "欄位格式不正確" }, { status: 400 });
  }
  const stock = queryOne("SELECT id FROM stocks WHERE id = ? AND user_id = ?", [
    stockId,
    auth.userId,
  ]);
  if (!stock)
    return NextResponse.json({ error: "股票不存在" }, { status: 400 });
  if (accountId) {
    const account = queryOne(
      "SELECT id FROM accounts WHERE id = ? AND user_id = ?",
      [accountId, auth.userId],
    );
    if (!account)
      return NextResponse.json(
        { error: "帳戶不存在或無權限" },
        { status: 400 },
      );
  }

  const newLastGenerated =
    startDate !== current.start_date ? null : current.last_generated;
  getDB().run(
    "UPDATE stock_recurring SET stock_id = ?, amount = ?, frequency = ?, start_date = ?, account_id = ?, note = ?, last_generated = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    [
      stockId,
      nAmount,
      frequency,
      startDate,
      accountId || "",
      note || "",
      newLastGenerated,
      Date.now(),
      id,
      auth.userId,
    ],
  );
  saveDB();
  return NextResponse.json({ ok: true });
}

export async function DELETE(request, { params }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  getDB().run("DELETE FROM stock_recurring WHERE id = ? AND user_id = ?", [
    id,
    auth.userId,
  ]);
  saveDB();
  return NextResponse.json({ ok: true });
}
