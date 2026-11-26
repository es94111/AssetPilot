import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../../proxy";
import { POST as retiredLogin } from "../../app/api/auth/line/route";
import { POST as retiredWebhook } from "../../app/api/line/webhook/route";
import { GET as retiredReminders } from "../../app/api/admin/line-expense-reminders/route";

test("retired LINE endpoints are reachable only as retirement responses", async () => {
  for (const [path, handler] of [
    ["/api/auth/line", retiredLogin],
    ["/api/line/webhook", retiredWebhook],
    ["/api/admin/line-expense-reminders", retiredReminders],
  ] as const) {
    assert.equal(proxy(new NextRequest("http://localhost" + path)).headers.get("x-middleware-next"), "1");
    const response = handler();
    assert.equal(response.status, 410);
    assert.equal((await response.json()).code, "line_integration_retired");
    assert.equal(response.headers.get("set-cookie"), null);
  }
});

if (!process.env.DATABASE_URL) {
  test("LINE retirement PostgreSQL integration", { skip: "未設定 DATABASE_URL" }, () => {});
} else {
  test("existing LINE schedules, login methods, and system settings after retirement", async (t) => {
    process.env.APP_URL = "https://app.example.test";
    process.env.EMAIL_PROVIDER_PRIMARY = "zeabur";
    process.env.ZEABUR_API_KEY = "test-key";
    process.env.ZEABUR_FROM_EMAIL = "reports@example.test";
    process.env.TRANSACTION_PHOTO_MAX_BYTES = "1";
    process.env.TRANSACTION_PHOTO_DEFAULT_STORAGE = "s3";
    process.env.STOCK_AUTO_UPDATE_ENABLED = "true";
    process.env.STOCK_AUTO_UPDATE_INTERVAL_MIN = "1440";
    process.env.TURNSTILE_SITE_KEY = "retired-site";
    process.env.TURNSTILE_SECRET_KEY = "retired-secret";
    process.env.FAKE_NOW = "2000-01-01T00:00:00.000Z";

    const { initDB, getDB, queryOne } = await import("../../lib/db");
    const { ensurePersonalLedger } = await import("../../lib/ledgerContext");
    const { createLoginSession } = await import("../../lib/sessionHelpers");
    const { restorePostgresBackupSql } = await import("../../lib/postgresBackup");
    const { runScheduledReportNow, shouldRunSchedule } = await import("../../lib/scheduler");
    const userSchedules = await import("../../app/api/user/report-schedules/route");
    const userSchedule = await import("../../app/api/user/report-schedules/[id]/route");
    const adminSettings = await import("../../app/api/admin/system-settings/route");
    const legacyBatch = await import("../../app/api/admin/report-schedule/route");
    const runNow = await import("../../app/api/admin/report-schedules/[id]/run-now/route");
    const { removeAccountLoginMethod } = await import("../../lib/accountLoginMethods");
    const { assertImageUpload, getDefaultTransactionPhotoStorage, getTransactionPhotoStorageStatus } = await import("../../lib/transactionAttachments");
    const { checkAndRunStockPriceUpdate } = await import("../../lib/stockPriceUpdater");
    const googleRoute = await import("../../app/api/auth/google/route");
    const { __nowMs, __setNowMs } = await import("../../lib/userTime");

    await initDB();
    const db = getDB();
    const id = "line-retirement-" + crypto.randomUUID();
    const lineOnly = id + "-old-schedule";
    const configBefore = queryOne("SELECT * FROM system_settings WHERE id = 1")!;
    const originalFetch = globalThis.fetch;
    const originalNow = Date.now;
    const sentTo: string[] = [];
    globalThis.fetch = async (url, init) => {
      if (String(url) === "https://api.zeabur.com/api/v1/zsend/emails") {
        sentTo.push(...JSON.parse(String(init?.body)).to);
        return new Response(JSON.stringify({ id: "report-test" }), { status: 200 });
      }
      return new Response("{}", { status: 200 });
    };
    try {
      db.run("UPDATE system_settings SET stock_auto_update_enabled = 0 WHERE id = 1");
      db.run(
        "INSERT INTO users (id, email, password_hash, display_name, is_admin, admin_role, line_id) VALUES (?, ?, '', 'Test', 1, 'super', 'legacy-id')",
        [id, id + "@example.test"],
      );
      ensurePersonalLedger(id);
      const retiredUserLedger = ensurePersonalLedger(id + "-missing");
      assert.equal(queryOne("SELECT id FROM financial_ledgers WHERE id = ?", [retiredUserLedger]), null);
      const session = createLoginSession(id, 0, {});
      const request = (path: string, method = "GET", body?: unknown) =>
        new NextRequest("http://localhost" + path, {
          method,
          headers: { cookie: "authToken=" + session.token, "content-type": "application/json", origin: "http://localhost" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      const context = { params: Promise.resolve({ id: lineOnly }) };

      await t.test("restored LINE-only schedule stays off until Email and activation are explicitly selected", async () => {
        restorePostgresBackupSql(`-- AssetPilot PostgreSQL backup
BEGIN;
INSERT INTO "report_schedules" ("id","user_id","ledger_id","freq","notify_email","notify_line","enabled") VALUES ('${lineOnly}','${id}','personal:${id}','daily',0,1,1);
COMMIT;`);
        assert.equal(queryOne("SELECT enabled FROM report_schedules WHERE id = ?", [lineOnly])?.enabled, 0);
        const initial = await userSchedules.GET(request("/api/user/report-schedules"));
        const [row] = await initial.json();
        assert.equal(row.enabled, false);
        assert.equal(row.notifyEmail, false);
        assert.equal("notifyLine" in row, false);
        assert.equal(shouldRunSchedule({ enabled: 1, notify_email: 0, freq: "daily", hour: 9 }, "Asia/Taipei"), false);
        assert.equal((await legacyBatch.PUT(request("/api/admin/report-schedule", "PUT", { freq: "daily", userIds: [id] }))).status, 200);
        assert.equal((await (await runNow.POST(request("/api/admin/report-schedules/" + lineOnly + "/run-now", "POST"), context)).json()).status, "disabled");
        assert.deepEqual(sentTo, []);

        const path = "/api/user/report-schedules/" + lineOnly;
        assert.equal((await userSchedule.PUT(request(path, "PUT", { notifyLine: true }), context)).status, 400);
        assert.equal((await userSchedule.PUT(request(path, "PUT", { enabled: true }), context)).status, 400);
        assert.equal((await userSchedule.PUT(request(path, "PUT", { notifyEmail: "false", enabled: true }), context)).status, 400);
        assert.equal((await userSchedule.PUT(request(path, "PUT", { notifyEmail: true, enabled: "false" }), context)).status, 400);
        const optedIn = await userSchedule.PUT(request(path, "PUT", { notifyEmail: true, notifyLine: false }), context);
        assert.equal((await optedIn.json()).enabled, false);
        const enabled = await userSchedule.PUT(request(path, "PUT", { enabled: true }), context);
        assert.equal((await enabled.json()).enabled, true);
        assert.equal((await runScheduledReportNow(lineOnly)).status, "completed");
        assert.deepEqual(sentTo, [id + "@example.test"]);
      });

      await t.test("new Email reports keep the default channel", async () => {
        const response = await userSchedules.POST(request("/api/user/report-schedules", "POST", { freq: "monthly" }));
        assert.equal(response.status, 201);
        const schedule = await response.json();
        assert.equal(schedule.notifyEmail, true);
        assert.equal("notifyLine" in schedule, false);
        assert.equal((await runScheduledReportNow(schedule.id)).status, "completed");
        assert.equal(sentTo.length, 2);
        assert.equal((await runScheduledReportNow(schedule.id)).status, "skipped");
        assert.equal(sentTo.length, 2);
      });

      await t.test("historical LINE identifiers cannot replace the last Passkey", () => {
        const insertKey = (key: string) => db.run(
          "INSERT INTO passkey_credentials (credential_id, user_id, public_key, algorithm, counter, created_at) VALUES (?, ?, 'pk', 'ES256', 0, 0)",
          [key, id],
        );
        insertKey(id + "-key");
        assert.equal(removeAccountLoginMethod(id, { provider: "passkey", credentialId: id + "-key" }), "last_method");
        insertKey(id + "-backup");
        assert.equal(removeAccountLoginMethod(id, { provider: "passkey", credentialId: id + "-key" }), "removed");
      });

      await t.test("admin settings control upload and stock update limits", async () => {
        const putSettings = (body: unknown) => adminSettings.PUT(request("/api/admin/system-settings", "PUT", body));
        assert.equal(getDefaultTransactionPhotoStorage(), "local");
        assert.equal(getTransactionPhotoStorageStatus().maxBytes, 10 * 1024 * 1024);
        process.env.TRANSACTION_PHOTO_S3_ENDPOINT = "https://storage.example.test";
        process.env.TRANSACTION_PHOTO_S3_BUCKET = "fixture";
        process.env.TRANSACTION_PHOTO_S3_ACCESS_KEY_ID = "test-access";
        process.env.TRANSACTION_PHOTO_S3_SECRET_ACCESS_KEY = "test-secret";
        assert.equal((await putSettings({ transactionPhotoStorage: "s3" })).status, 200);
        assert.equal(getDefaultTransactionPhotoStorage(), "s3");
        assert.equal((await putSettings({ transactionPhotoStorage: "local", transactionPhotoMaxBytes: 100, stockAutoUpdateEnabled: false, stockAutoUpdateIntervalMin: 5 })).status, 200);
        assert.throws(() => assertImageUpload({ size: 101, type: "image/png" }), /照片不可超過/);
        assert.doesNotThrow(() => assertImageUpload({ size: 100, type: "image/png" }));

        const marketTime = Date.parse("2026-11-25T02:00:00Z");
        db.run("UPDATE system_settings SET stock_auto_update_last_run = ? WHERE id = 1", [marketTime - 6 * 60_000]);
        Date.now = () => marketTime;
        await checkAndRunStockPriceUpdate();
        const lastRun = () => queryOne("SELECT stock_auto_update_last_run FROM system_settings WHERE id = 1")?.stock_auto_update_last_run;
        assert.equal(lastRun(), marketTime - 6 * 60_000);
        Date.now = originalNow;
        assert.equal((await putSettings({ stockAutoUpdateEnabled: true, stockAutoUpdateIntervalMin: 5 })).status, 200);
        Date.now = () => marketTime;
        await checkAndRunStockPriceUpdate();
        assert.equal(lastRun(), marketTime);
        Date.now = originalNow;
        assert.equal((await putSettings({ stockAutoUpdateEnabled: false, transactionPhotoMaxBytes: 0 })).status, 200);
        assert.equal(getTransactionPhotoStorageStatus().maxBytes, 10 * 1024 * 1024);
        assert.ok(__nowMs() > Date.parse("2020-01-01"));
        __setNowMs(123);
        assert.equal(__nowMs(), 123);
        __setNowMs(null);
      });

      await t.test("Google Web and App return URLs derive from APP_URL and still require OAuth state", async () => {
        for (const redirect of ["https://app.example.test/", "https://app.example.test/app/google-callback"]) {
          const response = await googleRoute.POST(request("/api/auth/google", "POST", { redirect_uri: redirect, code: "unused" }));
          assert.equal((await response.json()).error, "state_mismatch");
        }
        const response = await googleRoute.POST(request("/api/auth/google", "POST", { redirect_uri: "https://other.example.test/", code: "unused" }));
        assert.equal((await response.json()).error, "invalid_redirect_uri");
      });
    } finally {
      Date.now = originalNow;
      globalThis.fetch = originalFetch;
      __setNowMs(null);
      db.run("DELETE FROM data_operation_audit_log WHERE user_id = ?", [id]);
      db.run("DELETE FROM passkey_credentials WHERE user_id = ?", [id]);
      db.run("DELETE FROM login_sessions WHERE user_id = ?", [id]);
      db.run("DELETE FROM report_schedules WHERE user_id = ?", [id]);
      db.run("DELETE FROM financial_ledgers WHERE id = ?", ["personal:" + id]);
      db.run("DELETE FROM users WHERE id = ?", [id]);
      const columns = Object.keys(configBefore).filter((key) => key !== "id");
      db.run(`UPDATE system_settings SET ${columns.map((key) => key + " = ?").join(", ")} WHERE id = 1`, columns.map((key) => configBefore[key]));
      db.close();
    }
  });
}
