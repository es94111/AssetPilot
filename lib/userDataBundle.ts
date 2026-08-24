// lib/userDataBundle.ts — 使用者個人資料完整打包匯出 / 上傳合併還原
//
// 匯出：把目前使用者「全部個人資料」（記帳 + 股票 + 偏好設定 + 交易憑證圖片）
//       打包成單一 ZIP（manifest.json + data/<table>.json + attachments/<id>）。
// 還原：上傳同格式 ZIP，採「合併式」——依主鍵查重，已存在略過、不存在才新增；
//       既有資料一律不刪除/不覆蓋。資料列在 BEGIN/COMMIT 內寫入；圖片先完成儲存，
//       若資料列失敗則以補償刪除已寫入的圖片與 metadata。
import AdmZip from "adm-zip";
import { getDB, saveDB, queryAll, queryOne } from "./db";
import {
  deleteTransactionAttachment,
  readTransactionAttachment,
  restoreAttachmentFromBundle,
  type TransactionAttachmentRow,
} from "./transactionAttachments";
import changelog from "../changelog.json";

export const BUNDLE_FORMAT = "assetpilot-user-bundle";
export const BUNDLE_VERSION = 1;

// 合法 SQL 識別字（欄位名）：還原時欄位名來自上傳 JSON（使用者可控），
// 以此正則杜絕 SQL injection（值一律參數化，表名來自下方固定常數）。
const IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

interface BundleTable {
  table: string;
  keys: string[]; // 合併查重用的主鍵欄位
}

// 依外鍵安全順序插入：被參照的表在前（categories/accounts 早於 transactions；
// stocks 早於 stock_transactions/stock_dividends/stock_recurring）。
// transaction_attachments 另行處理（需還原圖片實體）。
const DATA_TABLES: BundleTable[] = [
  { table: "categories", keys: ["id"] },
  { table: "deleted_defaults", keys: ["user_id", "default_key"] },
  { table: "accounts", keys: ["id"] },
  { table: "transactions", keys: ["id"] },
  { table: "credit_card_repayment_summaries", keys: ["id"] },
  { table: "exchange_rates", keys: ["user_id", "currency"] },
  { table: "exchange_rate_settings", keys: ["user_id"] },
  { table: "budgets", keys: ["id"] },
  { table: "recurring", keys: ["id"] },
  { table: "stocks", keys: ["id"] },
  { table: "stock_transactions", keys: ["id"] },
  { table: "stock_dividends", keys: ["id"] },
  { table: "stock_recurring", keys: ["id"] },
  { table: "stock_settings", keys: ["user_id"] },
  { table: "user_settings", keys: ["user_id"] },
];

const ATTACHMENTS_TABLE = "transaction_attachments";

export class BundleError extends Error {}

export interface RestoreSummary {
  perTable: Record<string, { inserted: number; skipped: number }>;
  attachmentsRestored: number;
  attachmentsFailed: number;
}

type JsonPrimitive = string | number | boolean | null;
type JsonObject = { [key: string]: JsonValue };
type JsonValue = JsonPrimitive | JsonValue[] | JsonObject;
type Row = Record<string, unknown>;

function isJsonObject(value: JsonValue | null): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonValue(value: unknown): value is JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  )
    return true;
  if (Array.isArray(value)) return value.every(isJsonValue);
  if (typeof value === "object")
    return Object.values(value as Record<string, unknown>).every(isJsonValue);
  return false;
}

function bundleTimestamp(date = new Date()): string {
  return date.toISOString().replace(/[-:T]/g, "").slice(0, 14);
}

function appVersion(): string {
  try {
    return String(
      (changelog as { currentVersion?: string }).currentVersion || "",
    );
  } catch {
    return "";
  }
}

// ───────────────────────── 匯出 ─────────────────────────

export async function exportUserBundle(
  userId: string,
): Promise<{
  buffer: Buffer;
  filename: string;
  counts: Record<string, number>;
}> {
  const zip = new AdmZip();
  const counts: Record<string, number> = {};

  for (const { table } of DATA_TABLES) {
    const rows = queryAll(`SELECT * FROM ${table} WHERE user_id = ?`, [userId]);
    counts[table] = rows.length;
    zip.addFile(
      `data/${table}.json`,
      Buffer.from(JSON.stringify(rows), "utf8"),
    );
  }

  // 交易憑證：先寫 metadata，再逐筆讀取圖片實體（local / S3 皆由 readTransactionAttachment 處理）
  // SAFETY: queryAll returns rows from the fixed transaction_attachments schema;
  // the cast only supplies the typed attachment fields used by storage helpers.
  const attachments = queryAll(
    `SELECT * FROM ${ATTACHMENTS_TABLE} WHERE user_id = ?`,
    [userId],
  ) as unknown as TransactionAttachmentRow[];
  counts[ATTACHMENTS_TABLE] = attachments.length;
  zip.addFile(
    `data/${ATTACHMENTS_TABLE}.json`,
    Buffer.from(JSON.stringify(attachments), "utf8"),
  );

  let imageCount = 0;
  for (const row of attachments) {
    try {
      const { body } = await readTransactionAttachment(row);
      zip.addFile(`attachments/${row.id}`, body);
      imageCount += 1;
    } catch {
      // 圖片實體缺失（檔案被刪/S3 不可達）時保留 metadata、略過實體，不中斷整包匯出
    }
  }
  counts.attachment_files = imageCount;

  const manifest = {
    format: BUNDLE_FORMAT,
    version: BUNDLE_VERSION,
    exportedAt: new Date().toISOString(), // UTC ISO 8601 Z（Constitution 原則 IV）
    appVersion: appVersion(),
    userId,
    counts,
  };
  zip.addFile(
    "manifest.json",
    Buffer.from(JSON.stringify(manifest, null, 2), "utf8"),
  );

  const buffer = zip.toBuffer();
  const filename = `assetpilot-backup-${userId.slice(0, 8)}-${bundleTimestamp()}.zip`;
  return { buffer, filename, counts };
}

// ───────────────────────── 還原（合併式） ─────────────────────────

function assertValidColumns(row: Row): string[] {
  const cols = Object.keys(row);
  for (const col of cols) {
    if (!IDENT_RE.test(col))
      throw new BundleError("備份檔含無效的欄位名稱，可能已損毀或被竄改");
  }
  return cols;
}

function rowExists(table: string, keys: string[], row: Row): boolean {
  const where = keys.map((k) => `${k} = ?`).join(" AND ");
  const found = queryOne(
    `SELECT 1 AS x FROM ${table} WHERE ${where}`,
    keys.map((k) => row[k] as never),
  );
  return !!found;
}

function insertRow(
  db: ReturnType<typeof getDB>,
  table: string,
  row: Row,
): void {
  const cols = assertValidColumns(row);
  const placeholders = cols.map(() => "?").join(", ");
  db.run(
    `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders})`,
    cols.map((c) => row[c] as never),
  );
}

function readJsonEntry(
  zip: InstanceType<typeof AdmZip>,
  name: string,
): JsonValue | null {
  const entry = zip.getEntry(name);
  if (!entry) return null;
  try {
    const parsed: unknown = JSON.parse(entry.getData().toString("utf8"));
    if (!isJsonValue(parsed)) throw new Error("not-json-value");
    return parsed;
  } catch {
    throw new BundleError(`${name} 格式錯誤，備份檔可能已損毀`);
  }
}

export async function restoreUserBundle(
  userId: string,
  zipBuffer: Buffer,
): Promise<RestoreSummary> {
  let zip: InstanceType<typeof AdmZip>;
  try {
    zip = new AdmZip(zipBuffer);
  } catch {
    throw new BundleError("無法讀取 ZIP 檔，請確認上傳的是未損毀的備份檔");
  }

  const manifestValue = readJsonEntry(zip, "manifest.json");
  if (!isJsonObject(manifestValue))
    throw new BundleError(
      "備份檔缺少 manifest.json，請確認這是 AssetPilot 完整備份",
    );
  if (String(manifestValue.format || "") !== BUNDLE_FORMAT)
    throw new BundleError("這不是 AssetPilot 完整備份檔");
  if (Number(manifestValue.version) > BUNDLE_VERSION)
    throw new BundleError("備份檔版本較新，請先更新 AssetPilot 後再還原");

  const db = getDB();
  const perTable: RestoreSummary["perTable"] = {};
  let attachmentsRestored = 0;
  let attachmentsFailed = 0;
  const restoredAttachments: Array<{
    transactionId: string;
    attachmentId: string;
  }> = [];
  perTable[ATTACHMENTS_TABLE] = { inserted: 0, skipped: 0 };

  // Storage I/O is asynchronous and cannot run while the synchronous PostgreSQL
  // adapter holds a transaction connection. Restore files first, then perform
  // all database-row work in one synchronous transaction. If row work fails,
  // compensate by deleting files/rows already restored in this phase.
  const attachmentRows = readJsonEntry(zip, `data/${ATTACHMENTS_TABLE}.json`);
  try {
    if (Array.isArray(attachmentRows)) {
      for (const raw of attachmentRows) {
        if (!isJsonObject(raw)) continue;
        // SAFETY: the object comes from the fixed attachment export schema; the
        // helper validates the required id/storage fields before writing.
        const row: Row = { ...raw, user_id: userId };
        const id = String(row.id || "");
        if (!id) continue;
        if (rowExists(ATTACHMENTS_TABLE, ["id"], row)) {
          perTable[ATTACHMENTS_TABLE].skipped += 1;
          continue;
        }
        const imgEntry = zip.getEntry(`attachments/${id}`);
        if (!imgEntry) {
          attachmentsFailed += 1;
          continue;
        }
        try {
          // SAFETY: row was read from data/transaction_attachments.json and its
          // required fields are validated by restoreAttachmentFromBundle.
          await restoreAttachmentFromBundle(
            userId,
            row as unknown as TransactionAttachmentRow,
            imgEntry.getData(),
          );
          restoredAttachments.push({
            transactionId: String(row.transaction_id || ""),
            attachmentId: id,
          });
          perTable[ATTACHMENTS_TABLE].inserted += 1;
          attachmentsRestored += 1;
        } catch {
          attachmentsFailed += 1;
        }
      }
    }

    db.run("BEGIN");
    for (const { table, keys } of DATA_TABLES) {
      perTable[table] = { inserted: 0, skipped: 0 };
      const rows = readJsonEntry(zip, `data/${table}.json`);
      if (!Array.isArray(rows)) continue;
      for (const raw of rows) {
        if (!isJsonObject(raw)) continue;
        const row: Row = { ...raw, user_id: userId };
        if (rowExists(table, keys, row)) {
          perTable[table].skipped += 1;
          continue;
        }
        insertRow(db, table, row);
        perTable[table].inserted += 1;
      }
    }
    db.run("COMMIT");
  } catch (error) {
    try {
      db.run("ROLLBACK");
    } catch (rollbackError) {
      console.error("[userDataBundle] rollback failed", rollbackError);
    }
    for (const restored of restoredAttachments) {
      try {
        await deleteTransactionAttachment(
          userId,
          restored.transactionId,
          restored.attachmentId,
        );
      } catch (cleanupError) {
        console.error(
          "[userDataBundle] attachment compensation failed",
          cleanupError,
        );
      }
    }
    throw error;
  }

  saveDB();
  return { perTable, attachmentsRestored, attachmentsFailed };
}
