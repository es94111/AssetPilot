import { withLedgerWriteAudit } from "../../../../lib/ledgerContext";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "../../../../lib/apiHelpers";
import { getDB, queryOne } from "../../../../lib/db";
import { writeOperationAudit } from "../../../../lib/auditHelpers";
import { getRequestIpFromHeaders } from "../../../../lib/loginHelpers";
import { importLocks, importProgress } from "@/lib/transactionImportState";
import { parseOfx, OfxParseError } from "../../../../lib/ofxParser";
import {
  parseReconciliationCsv,
  ReconciliationCsvError,
  type ReconciliationCsvProfile,
} from "../../../../lib/csvReconciliationParser";
import { matchReconciliation } from "../../../../lib/reconciliationMatch";
import {
  csvRowsToStatementEntries,
  loadLedgerEntries,
  ofxTransactionsToStatementEntries,
  parseProfileConfig,
  persistReconciliationResult,
  RECONCILIATION_MAX_CONTENT_CHARS,
  RECONCILIATION_MAX_ROWS,
  type ReconciliationSourceFormat,
  type ReconciliationSourceKind,
  type ReconciliationStatementEntry,
} from "../../../../lib/reconciliationStore";
import { normalizeDate } from "../../../../lib/accountHelpers";

type ImportPhase = "parsing" | "matching" | "writing";

interface ReconciliationImportRequest {
  format?: ReconciliationSourceFormat;
  /** OFX 或 CSV 原文。 */
  content?: string;
  /** 欄位對應（與 `profileId` 二選一；`profileId` 為既有 profile）。 */
  profile?: ReconciliationCsvProfile;
  profileId?: string;
  /** CSV 來源類型；OFX 由檔案內容自動判定。 */
  sourceKind?: ReconciliationSourceKind;
  /** 限定比對的帳戶；留空代表全部帳戶。 */
  accountId?: string;
  filename?: string;
  /** 日期配對窗口（天），預設 3。 */
  dateWindowDays?: number;
}

function errorResponse(
  message: string,
  status: number,
  extra: Record<string, unknown> = {},
) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

function acquireImportLock(userId: string): boolean {
  if (importLocks.has(userId)) return false;
  importLocks.add(userId);
  return true;
}

function releaseImportLock(userId: string): void {
  importLocks.delete(userId);
}

/** 正規化對帳單期間：接受 OFX 與 CSV 兩種來源的日期字串。 */
function normalizePeriod(value: string): string {
  return normalizeDate(value) || value || "";
}
async function handlePOST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = (await request
    .json()
    .catch(() => ({}))) as ReconciliationImportRequest;
  const format: ReconciliationSourceFormat =
    body.format === "ofx" ? "ofx" : "csv";
  const ledgerId = String((auth as { ledgerId?: string }).ledgerId || "");
  const windowDays = Math.max(0, Number(body.dateWindowDays ?? 3) || 0);

  if (!acquireImportLock(auth.userId)) {
    return errorResponse("您已有匯入進行中，請稍候完成後再試", 409);
  }

  const ipAddress = getRequestIpFromHeaders(request.headers);
  const userAgent = request.headers.get("user-agent") || "";
  const userRow = queryOne("SELECT is_admin FROM users WHERE id = ?", [
    auth.actorUserId,
  ]);
  const userRole = userRow?.is_admin ? "admin" : "user";
  const filename = String(body.filename || "").slice(0, 255);

  let failureStage: ImportPhase = "parsing";
  let statementEntries: ReconciliationStatementEntry[] = [];
  let sourceKind: ReconciliationSourceKind = body.sourceKind || "bank";
  let skippedTypes: Record<string, number> = {};
  let currency = "TWD";
  let periodStart = "";
  let periodEnd = "";
  let profileId = "";

  importProgress.set(auth.userId, {
    processed: 0,
    total: 0,
    phase: "parsing",
    startedAt: Date.now(),
    completedAt: null,
  });
  const updateProgress = (processed: number, phase: ImportPhase) => {
    const cur = importProgress.get(auth.userId);
    importProgress.set(auth.userId, {
      processed,
      total: cur?.total ?? 0,
      phase,
      startedAt: cur?.startedAt ?? Date.now(),
      completedAt: null,
    });
  };

  /**
   * 被拒的匯入（輸入錯誤、超出上限等）也必須留下失敗稽核：稽核的目的是忠實記錄
   * 「誰在何時嘗試匯入什麼」，若只記錄成功與例外，使用者會誤以為從未發生過匯入。
   */
  const auditRejected = (
    reason: string,
    metadata: Record<string, unknown> = {},
  ) => {
    writeOperationAudit({
      userId: auth.userId,
      role: userRole,
      action: "import_reconciliation",
      ipAddress,
      userAgent,
      result: "failed",
      isAdminOperation: false,
      metadata: {
        filename,
        failure_stage: failureStage,
        failure_reason: reason.slice(0, 200),
        ...metadata,
      },
    });
  };

  const reject = (
    message: string,
    status: number,
    extra: Record<string, unknown> = {},
  ) => {
    auditRejected(message, extra);
    return errorResponse(message, status, extra);
  };

  try {
    // ── 解析階段（純函式，尚未觸碰 DB）──
    failureStage = "parsing";
    // 先擋內容長度再解析：單一超長列可能挾帶巨量內容，在列數上限生效前就吃掉記憶體。
    if (
      typeof body.content === "string" &&
      body.content.length > RECONCILIATION_MAX_CONTENT_CHARS
    ) {
      return reject(
        `對帳檔過大（上限 ${Math.floor(RECONCILIATION_MAX_CONTENT_CHARS / (1024 * 1024))}MB），請分批上傳`,
        413,
      );
    }
    const raw = String(body.content || "");
    if (!raw.trim()) return reject("缺少對帳檔內容（content）", 400);

    if (format === "ofx") {
      const parsed = parseOfx(raw);
      // OFX 可含多個帳戶聲明；以檔案中出現的型別決定來源類型。信用卡帳單金額
      // 方向語意與銀行不同，已於解析階段逐聲明套用。
      sourceKind = parsed.kinds.includes("credit_card")
        ? "credit_card"
        : parsed.kinds.includes("investment")
          ? "investment"
          : "bank";
      statementEntries = ofxTransactionsToStatementEntries(
        parsed.transactions,
        sourceKind,
      );
      skippedTypes = parsed.skippedTypes;
      currency = parsed.currency || "TWD";
      periodStart = parsed.periodStart;
      periodEnd = parsed.periodEnd;
    } else {
      let csvProfile: ReconciliationCsvProfile | null = body.profile || null;
      if (body.profileId) {
        const profileRow = queryOne(
          "SELECT id, config FROM reconciliation_import_profiles WHERE id = ? AND user_id = ?",
          [String(body.profileId), auth.userId],
        );
        if (!profileRow) return reject("找不到指定的欄位對應設定", 404);
        const config = parseProfileConfig(String(profileRow.config));
        if (!config) return reject("欄位對應設定內容毀損，請重新建立", 400);
        csvProfile = config;
        profileId = String(profileRow.id);
      }
      if (!csvProfile)
        return reject("缺少 CSV 欄位對應設定（profile 或 profileId）", 400);

      const parsed = parseReconciliationCsv(raw, csvProfile);
      if (parsed.errors.length > 0) {
        // 原子化：任何一列解析失敗即整批拒絕，不寫入任何資料。
        return reject(
          `CSV 有 ${parsed.errors.length} 列無法解析，已取消整批匯入`,
          400,
          {
            errors: parsed.errors.slice(0, 50),
            headers: parsed.headers,
          },
        );
      }
      statementEntries = csvRowsToStatementEntries(parsed.rows, sourceKind);
      const csvDates = parsed.rows
        .map((row) => row.date)
        .filter(Boolean)
        .sort();
      periodStart = csvDates[0] || "";
      periodEnd = csvDates[csvDates.length - 1] || "";
    }

    if (statementEntries.length === 0) {
      return reject("對帳檔中沒有可匯入的交易", 400);
    }
    if (statementEntries.length > RECONCILIATION_MAX_ROWS) {
      return reject(
        `單次最多匯入 ${RECONCILIATION_MAX_ROWS} 筆，請分批上傳`,
        413,
      );
    }

    // ── 比對階段（讀取帳本，仍不寫入）──
    failureStage = "matching";
    updateProgress(statementEntries.length, "matching");
    const dates = statementEntries
      .map((entry) => entry.date)
      .filter(Boolean)
      .sort();
    const dateFrom = dates[0] || "";
    const dateTo = dates[dates.length - 1] || "";

    const accountId = String(body.accountId || "");
    if (accountId) {
      const owned = queryOne(
        "SELECT id FROM accounts WHERE id = ? AND user_id = ?",
        [accountId, auth.userId],
      );
      if (!owned) return reject("找不到指定的帳戶", 404);
    }

    // 帳本期間雙向擴張，否則邊界外的帳本交易會被誤判為「對帳單有、帳本無」。
    const ledgerEntries = loadLedgerEntries(
      auth.userId,
      dateFrom,
      dateTo,
      accountId,
      windowDays,
    );
    const match = matchReconciliation(ledgerEntries, statementEntries, {
      dateWindowDays: windowDays,
    });

    // ── 寫入階段（整批原子化，任何失敗整批回滾）──
    failureStage = "writing";
    updateProgress(statementEntries.length, "writing");
    const db = getDB();
    let sessionId = "";
    db.run("BEGIN");
    try {
      sessionId = persistReconciliationResult({
        userId: auth.userId,
        ledgerId,
        accountId,
        sourceKind,
        sourceFormat: format,
        filename,
        profileId,
        currency,
        periodStart: normalizePeriod(periodStart),
        periodEnd: normalizePeriod(periodEnd),
        skippedTypes,
        statementEntries,
        match,
      });
      db.run("COMMIT");
    } catch (writeError) {
      try {
        db.run("ROLLBACK");
      } catch (rollbackError) {
        console.error("[reconciliation-import] rollback failed", rollbackError);
      }
      throw writeError;
    }

    const completed = importProgress.get(auth.userId);
    importProgress.set(auth.userId, {
      processed: statementEntries.length,
      total: statementEntries.length,
      phase: "writing",
      startedAt: completed?.startedAt ?? Date.now(),
      completedAt: Date.now(),
    });
    setTimeout(() => importProgress.delete(auth.userId), 5000);

    writeOperationAudit({
      userId: auth.userId,
      role: userRole,
      action: "import_reconciliation",
      ipAddress,
      userAgent,
      result: "success",
      isAdminOperation: false,
      metadata: {
        filename,
        rows: statementEntries.length,
        imported: statementEntries.length,
        skipped: 0,
        dateFrom,
        dateTo,
        reconciliation_session_id: sessionId,
        reconciliation_profile_id: profileId,
        source_format: format,
        source_kind: sourceKind,
        statement_total: statementEntries.length,
        ledger_total: match.ledgerTotal,
        matched: match.matchedCount,
        ledger_only: match.counts.ledger_only,
        statement_only: match.counts.statement_only,
        amount_mismatch: match.counts.amount_mismatch,
      },
    });

    return NextResponse.json({
      sessionId,
      sourceFormat: format,
      sourceKind,
      filename,
      currency,
      periodStart: normalizePeriod(periodStart),
      periodEnd: normalizePeriod(periodEnd),
      dateFrom,
      dateTo,
      statementTotal: statementEntries.length,
      ledgerTotal: match.ledgerTotal,
      matchedCount: match.matchedCount,
      counts: match.counts,
      skippedTypes,
    });
  } catch (error) {
    const isParseError =
      error instanceof OfxParseError || error instanceof ReconciliationCsvError;
    const detail = String(error instanceof Error ? error.message : error);
    const status = isParseError ? 400 : 500;

    importProgress.set(auth.userId, {
      processed: 0,
      total: statementEntries.length,
      phase: failureStage,
      startedAt: Date.now(),
      completedAt: Date.now(),
    });
    setTimeout(() => importProgress.delete(auth.userId), 5000);

    writeOperationAudit({
      userId: auth.userId,
      role: userRole,
      action: "import_reconciliation",
      ipAddress,
      userAgent,
      result: "failed",
      isAdminOperation: false,
      metadata: {
        filename,
        failure_stage: failureStage,
        failure_reason: detail.slice(0, 200),
      },
    });

    return errorResponse(
      isParseError ? detail : "對帳匯入失敗，已整批回滾",
      status,
      {
        message: detail,
        failedAt: failureStage,
      },
    );
  } finally {
    releaseImportLock(auth.userId);
  }
}

export const POST = withLedgerWriteAudit(handlePOST);
