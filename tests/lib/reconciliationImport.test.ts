// tests/lib/reconciliationImport.test.ts — 對帳匯入 API 的 PostgreSQL 整合測試（issue #251）。
//
// 涵蓋驗收條件中無法以純函式證明的部分：
//  - 匯入走 DB transaction 原子化，失敗整批回滾（不留半套資料）
//  - 匯入與對帳行為寫入 data_operation_audit_log
//  - 對帳結果三類差異可經 API 讀回
//  - 尊重既有帳本授權邊界（跨帳本／跨使用者一律 404）與匯入互斥鎖（409）
//  - migration 新增的資料表／索引在升級後存在，且差異明細隨 session 級聯刪除
// 需真實 PostgreSQL（DATABASE_URL／POSTGRES_URL）；未設定時略過，
// 保持 `npm test` 在無 DB 環境仍可通過。
// 比照 tests/lib/transactionWriteCore.test.ts 的「模組層級 test() + after()」寫法：
// after() 必須註冊在模組層級才會執行，否則 Postgres worker thread 會讓行程無限掛著。
// 執行方式：node --experimental-transform-types --import tests/setup/register.mjs tests/lib/reconciliationImport.test.ts
import assert from "node:assert/strict";
import test, { after } from "node:test";
import { createRequire } from "node:module";

const DB_URL = process.env.DATABASE_URL || process.env.POSTGRES_URL;

if (!DB_URL) {
  test("reconciliationImport（略過：未設定 DATABASE_URL/POSTGRES_URL，需搭配 PostgreSQL 執行完整驗證）", () => {});
} else {
  const originalRequire = Object.getOwnPropertyDescriptor(
    globalThis,
    "require",
  );
  Object.defineProperty(globalThis, "require", {
    value: createRequire(import.meta.url),
    configurable: true,
  });

  const { initDB, getDB, queryOne, queryAll } = await import("../../lib/db.ts");
  const { uid } = await import("../../lib/userDefaults.ts");
  const { createLoginSession } = await import("../../lib/sessionHelpers.ts");
  const { importLocks } = await import("../../lib/transactionImportState.ts");
  const { NextRequest } = await import("next/server");
  const importRoute =
    await import("../../app/api/reconciliation/import/route.ts");
  const sessionsRoute =
    await import("../../app/api/reconciliation/sessions/route.ts");
  const sessionDetailRoute =
    await import("../../app/api/reconciliation/sessions/[sessionId]/route.ts");
  const profilesRoute =
    await import("../../app/api/reconciliation/profiles/route.ts");
  const ledgersRoute = await import("../../app/api/ledgers/route.ts");

  await initDB();
  const db = getDB();

  const owner = `test_recon_${uid()}`;
  const outsider = `test_recon_${uid()}`;
  const accountId = uid();
  const tokens = new Map<string, string>();
  let sharedLedgerId = "";

  const request = (
    userId: string,
    path: string,
    method = "GET",
    body?: unknown,
    ledgerId = "",
  ): InstanceType<typeof NextRequest> =>
    new NextRequest(`http://localhost${path}`, {
      method,
      headers: {
        Cookie: `authToken=${tokens.get(userId)}`,
        Origin: "http://localhost",
        "Content-Type": "application/json",
        ...(ledgerId ? { "x-ledger-id": ledgerId } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  // 個人帳本：不帶 x-ledger-id，由 requireAuth 的 ensurePersonalLedger 自動建立
  // （測試使用者建立於 migration 之後，`personal:<id>` 列尚不存在）。
  const personal = (
    userId: string,
    path: string,
    method = "GET",
    body?: unknown,
  ) => request(userId, path, method, body, "");

  const sessionCtx = (sessionId: string) => ({
    params: Promise.resolve({ sessionId }),
  });

  // Response body 只能讀一次；先取文字再解析，避免 json() 因 body 已消費而失敗。
  const readJson = async (
    res: Response,
  ): Promise<{ status: number; text: string; body: any }> => {
    const text = await res.text();
    let body: any = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = {};
    }
    return { status: res.status, text, body };
  };

  const insertTx = (
    userId: string,
    date: string,
    amount: number,
    type: string,
    note: string,
  ): string => {
    const id = uid();
    db.run(
      `INSERT INTO transactions (id, user_id, type, amount, currency, original_amount, fx_rate, fx_fee, twd_amount, date, account_id, note, exclude_from_stats, is_fx_fee, created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        id,
        userId,
        type,
        amount,
        "TWD",
        amount,
        "1",
        0,
        amount,
        date,
        accountId,
        note,
        0,
        0,
        Date.now(),
        Date.now(),
      ],
    );
    return id;
  };

  const OFX_BANK = `OFXHEADER:100
DATA:OFXSGML
VERSION:102

<OFX>
<BANKMSGSRSV1>
<STMTTRNRS>
<STMTRS>
<CURDEF>TWD
<BANKACCTFROM>
<BANKID>012
<ACCTID>12345678901234
</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260901
<DTEND>20260930
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260906
<TRNAMT>-1200.00
<FITID>R-1
<NAME>金額不符
</STMTTRN>
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260908
<TRNAMT>-700.00
<FITID>R-2
<NAME>對帳單獨有
</STMTTRN>
</BANKTRANLIST>
</STMTRS>
</STMTTRNRS>
</BANKMSGSRSV1>
</OFX>`;

  let sessionId = "";

  // 前置資料：兩個使用者與各自的 auth token，加上 owner 的共享帳本與一個帳戶。
  for (const person of [owner, outsider]) {
    db.run(
      "INSERT INTO users (id,email,password_hash,display_name,created_at) VALUES (?,?,?,?,?)",
      [
        person,
        `${person}@example.com`,
        "disabled",
        person,
        new Date().toISOString(),
      ],
    );
    tokens.set(person, createLoginSession(person, 0, {}).token);
  }

  test("前置作業：建立共享帳本與帳戶", async () => {
    const createdLedger = await ledgersRoute.POST(
      request(owner, "/api/ledgers", "POST", { name: "Recon ledger" }, ""),
    );
    const created = await readJson(createdLedger);
    assert.equal(created.status, 201, created.text);
    sharedLedgerId = String(created.body.id);
    db.run(
      "INSERT INTO accounts (id, user_id, name, initial_balance, currency, created_at) VALUES (?,?,?,?,?,?)",
      [accountId, owner, "Recon 帳戶", 0, "TWD", new Date().toISOString()],
    );
  });

  test("OFX 匯入：三類差異寫入 session 與 items，並留下不含明細的成功稽核", async () => {
    const ledgerTxId = insertTx(
      owner,
      "2026-09-06",
      1000,
      "expense",
      "金額不符",
    );
    insertTx(owner, "2026-09-04", 500, "expense", "帳本獨有");

    const res = await importRoute.POST(
      personal(owner, "/api/reconciliation/import", "POST", {
        format: "ofx",
        content: OFX_BANK,
        filename: "bank.ofx",
      }),
    );
    const { status, text, body } = await readJson(res);
    assert.equal(status, 200, text);
    sessionId = body.sessionId;

    assert.equal(body.statementTotal, 2);
    assert.equal(body.ledgerTotal, 2);
    assert.equal(body.matchedCount, 0);
    assert.deepEqual(
      body.counts,
      { ledger_only: 1, statement_only: 1, amount_mismatch: 1 },
      text,
    );
    assert.equal(body.periodStart, "2026-09-01");
    assert.equal(body.periodEnd, "2026-09-30");

    const sessionRow = queryOne(
      "SELECT * FROM reconciliation_sessions WHERE id = ?",
      [body.sessionId],
    );
    assert.ok(sessionRow, "session 必須寫入資料庫");
    assert.equal(sessionRow.source_format, "ofx");
    assert.equal(sessionRow.filename, "bank.ofx");
    assert.equal(Number(sessionRow.amount_mismatch_count), 1);

    const itemRows = queryAll(
      "SELECT * FROM reconciliation_items WHERE session_id = ?",
      [body.sessionId],
    );
    assert.equal(itemRows.length, 3, "三類差異必須逐筆寫入 items");

    // 金額不符項目必須指向真實帳本交易 id 與金額差異。
    const mismatchItem = itemRows.find((row) => row.kind === "amount_mismatch");
    assert.ok(mismatchItem);
    assert.equal(mismatchItem.ledger_id, ledgerTxId);
    assert.equal(Number(mismatchItem.ledger_amount), 1000);
    assert.equal(Number(mismatchItem.statement_amount), 1200);
    assert.equal(Number(mismatchItem.difference), -200);

    // 成功稽核：只記錄來源與統計，不記錄帳號或交易明細。
    const auditRow = queryOne(
      "SELECT action, result, metadata FROM data_operation_audit_log WHERE user_id = ? AND action = 'import_reconciliation' ORDER BY timestamp DESC LIMIT 1",
      [owner],
    );
    assert.ok(auditRow, "匯入必須留下稽核紀錄");
    assert.equal(auditRow.result, "success");
    const metadata = JSON.parse(String(auditRow.metadata || "{}"));
    assert.equal(metadata.amount_mismatch, 1);
    assert.equal(metadata.reconciliation_session_id, body.sessionId);
    assert.equal(metadata.source_format, "ofx");
    assert.equal(metadata.filename, "bank.ofx");
  });

  test("解析失敗：整批回滾，不留 session／items，並留下失敗稽核", async () => {
    const sessionsBefore = Number(
      queryOne(
        "SELECT COUNT(*) AS c FROM reconciliation_sessions WHERE user_id = ?",
        [owner],
      )?.c,
    );

    // 第 2 列日期非法（13 月）→ 整批拒絕。
    const csv = [
      "date,amount,description",
      "2026-09-03,-100,ok",
      "2026-13-03,-200,bad",
    ].join("\n");
    const res = await importRoute.POST(
      personal(owner, "/api/reconciliation/import", "POST", {
        format: "csv",
        content: csv,
        filename: "broken.csv",
        profile: {
          columns: {
            date: "date",
            amount: "amount",
            description: "description",
          },
        },
      }),
    );
    const { status, text } = await readJson(res);
    assert.equal(status, 400, text);

    const sessionsAfter = Number(
      queryOne(
        "SELECT COUNT(*) AS c FROM reconciliation_sessions WHERE user_id = ?",
        [owner],
      )?.c,
    );
    assert.equal(sessionsAfter, sessionsBefore, "解析失敗不得寫入任何 session");
    const itemsAfter = Number(
      queryOne(
        "SELECT COUNT(*) AS c FROM reconciliation_items WHERE user_id = ?",
        [owner],
      )?.c,
    );
    assert.equal(
      itemsAfter,
      3,
      "解析失敗不得新增任何差異明細（仍為前一案例的 3 筆）",
    );

    const failedAudit = queryOne(
      "SELECT result, metadata FROM data_operation_audit_log WHERE user_id = ? AND action = 'import_reconciliation' ORDER BY timestamp DESC LIMIT 1",
      [owner],
    );
    assert.equal(
      failedAudit?.result,
      "failed",
      "被拒的匯入必須留下失敗稽核紀錄",
    );
    const failedMeta = JSON.parse(String(failedAudit?.metadata || "{}"));
    assert.equal(failedMeta.failure_stage, "parsing");
    assert.equal(failedMeta.filename, "broken.csv");
  });

  test("非 OFX 內容回 400 且不建立 session，也不改動帳本交易", async () => {
    const sessionsBefore = Number(
      queryOne(
        "SELECT COUNT(*) AS c FROM reconciliation_sessions WHERE user_id = ?",
        [owner],
      )?.c,
    );
    const txBefore = Number(
      queryOne("SELECT COUNT(*) AS c FROM transactions WHERE user_id = ?", [
        owner,
      ])?.c,
    );
    const res = await importRoute.POST(
      personal(owner, "/api/reconciliation/import", "POST", {
        format: "ofx",
        content: "not an ofx file at all",
      }),
    );
    assert.equal(res.status, 400);
    assert.equal(
      Number(
        queryOne(
          "SELECT COUNT(*) AS c FROM reconciliation_sessions WHERE user_id = ?",
          [owner],
        )?.c,
      ),
      sessionsBefore,
    );
    // 對帳匯入只讀帳本、不改帳本：交易筆數不得變動。
    assert.equal(
      Number(
        queryOne("SELECT COUNT(*) AS c FROM transactions WHERE user_id = ?", [
          owner,
        ])?.c,
      ),
      txBefore,
    );
  });

  test("匯入互斥鎖：同一使用者已有匯入進行中時回 409", async () => {
    importLocks.add(owner);
    try {
      const res = await importRoute.POST(
        personal(owner, "/api/reconciliation/import", "POST", {
          format: "csv",
          content: "date,amount\n2026-09-03,-1",
          profile: { columns: { date: "date", amount: "amount" } },
        }),
      );
      assert.equal(res.status, 409);
    } finally {
      importLocks.delete(owner);
    }
  });

  test("對帳結果讀取：三類差異分類回傳；跨使用者與跨帳本一律 404", async () => {
    assert.ok(sessionId, "前一個案例必須先產生 session");
    const detail = await sessionDetailRoute.GET(
      personal(owner, `/api/reconciliation/sessions/${sessionId}`),
      sessionCtx(sessionId),
    );
    const detailResult = await readJson(detail);
    assert.equal(detailResult.status, 200, detailResult.text);
    assert.equal(detailResult.body.items.length, 3);
    for (const kind of ["ledger_only", "statement_only", "amount_mismatch"]) {
      assert.ok(
        detailResult.body.items.some(
          (item: { kind: string }) => item.kind === kind,
        ),
        `必須回傳 ${kind} 這類差異`,
      );
    }

    const list = await sessionsRoute.GET(
      personal(owner, "/api/reconciliation/sessions"),
    );
    assert.equal(list.status, 200);
    const listed = await list.json();
    assert.ok(
      listed.sessions.some((row: { id: string }) => row.id === sessionId),
      "個人帳本的對帳歷史必須包含本次 session",
    );

    // 跨使用者：即使知道 session id 也拿不到資料。
    const otherUser = await sessionDetailRoute.GET(
      personal(outsider, `/api/reconciliation/sessions/${sessionId}`),
      sessionCtx(sessionId),
    );
    assert.equal(otherUser.status, 404);

    // 跨帳本：換成 owner 的共享帳本後，個人帳本的 session 不可見。
    const otherLedger = await sessionDetailRoute.GET(
      request(
        owner,
        `/api/reconciliation/sessions/${sessionId}`,
        "GET",
        undefined,
        sharedLedgerId,
      ),
      sessionCtx(sessionId),
    );
    assert.equal(otherLedger.status, 404);

    const sharedList = await sessionsRoute.GET(
      request(
        owner,
        "/api/reconciliation/sessions",
        "GET",
        undefined,
        sharedLedgerId,
      ),
    );
    assert.equal(sharedList.status, 200);
    assert.equal(
      (await sharedList.json()).sessions.length,
      0,
      "共享帳本不得看到個人帳本的對帳歷史",
    );
  });

  test("共享帳本 viewer 唯讀：不得匯入對帳檔", async () => {
    assert.ok(sharedLedgerId, "前置作業必須先建立共享帳本");
    db.run(
      "INSERT INTO ledger_members (ledger_id, user_id, role, joined_at) VALUES (?,?,?,?)",
      [sharedLedgerId, outsider, "viewer", Date.now()],
    );
    const res = await importRoute.POST(
      request(
        outsider,
        "/api/reconciliation/import",
        "POST",
        {
          format: "csv",
          content: "date,amount\n2026-09-03,-1",
          profile: { columns: { date: "date", amount: "amount" } },
        },
        sharedLedgerId,
      ),
    );
    const viewerResult = await readJson(res);
    assert.equal(viewerResult.status, 403, viewerResult.text);
    assert.match(viewerResult.text, /唯讀/);
  });

  test("欄位對應 profile：建立、同名更新、列出與刪除皆限本人並留下刪除稽核", async () => {
    const created = await profilesRoute.POST(
      personal(owner, "/api/reconciliation/profiles", "POST", {
        name: "測試銀行",
        profile: {
          dateFormat: "YYYY/MM/DD",
          columns: { date: "日期", amount: "金額", description: "摘要" },
        },
      }),
    );
    const createdResult = await readJson(created);
    assert.equal(createdResult.status, 201, createdResult.text);
    const profileId = String(createdResult.body.profile.id);

    // 同名再次送出視為更新，不新增第二筆。
    const updated = await profilesRoute.POST(
      personal(owner, "/api/reconciliation/profiles", "POST", {
        name: "測試銀行",
        profile: { columns: { date: "交易日期", amount: "金額" } },
      }),
    );
    assert.equal(updated.status, 201, await updated.clone().text());
    const listed = await profilesRoute.GET(
      personal(owner, "/api/reconciliation/profiles"),
    );
    const profiles = (await listed.json()).profiles as Array<{
      id: string;
      name: string;
    }>;
    assert.equal(
      profiles.filter((profile) => profile.name === "測試銀行").length,
      1,
    );

    // 結構不完整（缺日期欄）的 profile 必須被拒。
    const invalid = await profilesRoute.POST(
      personal(owner, "/api/reconciliation/profiles", "POST", {
        name: "壞設定",
        profile: { columns: { amount: "金額" } },
      }),
    );
    assert.equal(invalid.status, 400, await invalid.clone().text());

    // 他人不得刪除（回 404，不透露存在性）；本人可刪除並留下稽核。
    const forbiddenDelete = await profilesRoute.DELETE(
      personal(
        outsider,
        `/api/reconciliation/profiles?id=${profileId}`,
        "DELETE",
      ),
    );
    assert.equal(forbiddenDelete.status, 404);
    const ownDelete = await profilesRoute.DELETE(
      personal(owner, `/api/reconciliation/profiles?id=${profileId}`, "DELETE"),
    );
    assert.equal(ownDelete.status, 200);
    const audit = queryOne(
      "SELECT action, metadata FROM data_operation_audit_log WHERE user_id = ? AND action = 'delete_reconciliation_profile' ORDER BY timestamp DESC LIMIT 1",
      [owner],
    );
    assert.ok(audit, "刪除欄位對應設定必須留下稽核紀錄");
    assert.equal(
      JSON.parse(String(audit.metadata || "{}")).reconciliation_profile_id,
      profileId,
    );
  });

  test("CSV 匯入：以既有 profileId 套用信用卡金額語意並與帳本支出配對", async () => {
    const created = await profilesRoute.POST(
      personal(owner, "/api/reconciliation/profiles", "POST", {
        name: "信用卡帳單",
        profile: {
          amountSign: "credit_card",
          columns: { date: "日期", amount: "金額" },
        },
      }),
    );
    const createdResult = await readJson(created);
    assert.equal(createdResult.status, 201, createdResult.text);
    const profileId = String(createdResult.body.profile.id);

    insertTx(owner, "2026-09-20", 880, "expense", "線上購物");
    const csv = ["日期,金額", "2026/09/20,880"].join("\n");
    const res = await importRoute.POST(
      personal(owner, "/api/reconciliation/import", "POST", {
        format: "csv",
        content: csv,
        filename: "card.csv",
        profileId,
      }),
    );
    const { status, text, body } = await readJson(res);
    assert.equal(status, 200, text);
    assert.equal(body.counts.amount_mismatch, 0, text);
    assert.equal(body.counts.ledger_only, 0, text);
    assert.equal(body.counts.statement_only, 0, text);
    assert.equal(body.matchedCount, 1, "信用卡正值消費應與帳本支出配對");

    const sessionRow = queryOne(
      "SELECT profile_id FROM reconciliation_sessions WHERE id = ?",
      [body.sessionId],
    );
    assert.equal(sessionRow?.profile_id, profileId);
  });

  test("migration：資料表與索引存在，且差異明細隨 session 級聯刪除", () => {
    const tables = queryAll(
      "SELECT tablename FROM pg_tables WHERE tablename LIKE 'reconciliation_%' ORDER BY tablename",
    ).map((row) => String(row.tablename));
    assert.deepEqual(tables, [
      "reconciliation_import_profiles",
      "reconciliation_items",
      "reconciliation_sessions",
    ]);

    const indexes = queryAll(
      "SELECT indexname FROM pg_indexes WHERE tablename LIKE 'reconciliation_%'",
    ).map((row) => String(row.indexname));
    for (const expected of [
      "idx_reconciliation_profiles_user",
      "idx_reconciliation_sessions_user",
      "idx_reconciliation_items_session",
    ]) {
      assert.ok(indexes.includes(expected), `缺少索引 ${expected}`);
    }

    // ON DELETE CASCADE：刪除 session 必須連帶刪除差異明細。
    const cascadeId = uid();
    db.run(
      `INSERT INTO reconciliation_sessions (id, user_id, source_kind, source_format, created_at)
       VALUES (?,?,?,?,?)`,
      [cascadeId, owner, "bank", "ofx", Date.now()],
    );
    db.run(
      `INSERT INTO reconciliation_items (id, session_id, user_id, kind, created_at) VALUES (?,?,?,?,?)`,
      [uid(), cascadeId, owner, "ledger_only", Date.now()],
    );
    db.run("DELETE FROM reconciliation_sessions WHERE id = ?", [cascadeId]);
    const orphans = Number(
      queryOne(
        "SELECT COUNT(*) AS c FROM reconciliation_items WHERE session_id = ?",
        [cascadeId],
      )?.c,
    );
    assert.equal(orphans, 0, "刪除 session 必須連帶刪除差異明細");
  });

  after(() => {
    // 清理必須無條件完成：Postgres worker thread 不會自行結束，若清理途中拋錯就
    // 到不了 close()，行程會無限掛著且看不到測試報告。
    const cleanup = [
      [
        "DELETE FROM reconciliation_items WHERE user_id IN (?,?)",
        [owner, outsider],
      ],
      [
        "DELETE FROM reconciliation_sessions WHERE user_id IN (?,?)",
        [owner, outsider],
      ],
      [
        "DELETE FROM reconciliation_import_profiles WHERE user_id IN (?,?)",
        [owner, outsider],
      ],
      [
        "DELETE FROM data_operation_audit_log WHERE user_id IN (?,?)",
        [owner, outsider],
      ],
      ["DELETE FROM transactions WHERE user_id IN (?,?)", [owner, outsider]],
      ["DELETE FROM accounts WHERE user_id IN (?,?)", [owner, outsider]],
      // 共享帳本必須先刪除，否則刪除 users 會觸發 protect_shared_ledger_owner。
      [
        "DELETE FROM financial_ledgers WHERE owner_user_id IN (?,?)",
        [owner, outsider],
      ],
      ["DELETE FROM ledger_members WHERE user_id IN (?,?)", [owner, outsider]],
      ["DELETE FROM users WHERE id IN (?,?)", [owner, outsider]],
    ] as const;
    for (const [sql, params] of cleanup) {
      try {
        db.run(sql, [...params]);
      } catch (cleanupError) {
        console.error(
          "[reconciliationImport-test] cleanup failed",
          sql,
          cleanupError,
        );
      }
    }
    if (originalRequire)
      Object.defineProperty(globalThis, "require", originalRequire);
    db.close();
  });
}
