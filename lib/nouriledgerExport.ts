// lib/nouriledgerExport.ts — 產生交給 NouriLedger 的「單一使用者」精確匯出包。
//
// 這是 NouriLedger lib/migration/sourceExport.ts（exportExactAssetBundle）的移植：
//   - 以獨立的 pg 連線在 REPEATABLE READ READ ONLY 交易內取得一致快照；
//   - NUMERIC／BIGINT 一律以 ::text 讀出，繞過本站 runtime 把 NUMERIC 轉成 JS Number 的解析器，
//     所以超過 2^53 或高精度的金額／股數可以零誤差往返；
//   - 每個 data/*.json 與附件都有 SHA-256，manifest 標示 numericEncoding: postgres-numeric-text。
// 與 NouriLedger 離線 CLI 版的差異：讀不到的附件（檔案遺失／S3 不可達／解密失敗）會略過並回報警告，
// 而不是讓整包失敗——來源本來就已經遺失，擋住整批匯入對使用者沒有幫助。
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { Client } from 'pg';
import { queryOne } from './db';
import { readTransactionAttachment, type TransactionAttachmentRow } from './transactionAttachments';

export const ASSET_FORMAT = 'assetpilot-user-bundle';
export const ASSET_VERSION = 1;
/** 必須與 NouriLedger lib/migration/adapters/assetPilot.ts 的 ASSET_TABLES 完全一致。 */
export const ASSET_TABLES = [
  'categories', 'deleted_defaults', 'accounts', 'transactions',
  'credit_card_repayment_summaries', 'exchange_rates', 'exchange_rate_settings',
  'budgets', 'recurring', 'stocks', 'stock_transactions', 'stock_dividends',
  'stock_recurring', 'stock_settings', 'user_settings',
] as const;
const ATTACHMENTS_TABLE = 'transaction_attachments';
/** NouriLedger 拒收單張超過此大小的附件。 */
export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
/** 低於 NouriLedger 256 MiB 單包上限，留一點餘裕。 */
export const MAX_PACKAGE_BYTES = 240 * 1024 * 1024;
/** NouriLedger 只接受 32 位十六進位的來源使用者 ID（去掉連字號的 UUID）。 */
export const SOURCE_USER_ID_RE = /^[a-f0-9]{32}$/u;

export class UnsupportedAccountError extends Error {
  constructor() { super('unsupported_account'); this.name = 'UnsupportedAccountError'; }
}
export class PackageTooLargeError extends Error {
  constructor() { super('export_too_large'); this.name = 'PackageTooLargeError'; }
}

type Row = Record<string, unknown>;
export interface ReadOnlySourceClient {
  query(sql: string, values?: unknown[]): Promise<{ rows: Row[] }>;
}
export interface AssetPackage {
  buffer: Buffer;
  counts: Record<string, number>;
  warnings: string[];
}

const sha256 = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

/** NUMERIC 與 bigint 以文字投影，繞過 runtime 的 Number 解析器。表名只能是白名單內的常數。 */
export async function readExactRows(client: ReadOnlySourceClient, table: string, userId: string): Promise<Row[]> {
  if (![...ASSET_TABLES, ATTACHMENTS_TABLE].includes(table as typeof ASSET_TABLES[number])) throw new Error('Source table is not allowlisted');
  const columns = (await client.query(
    `SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1 ORDER BY ordinal_position`, [table],
  )).rows;
  if (!columns.length) throw new Error(`Source table is missing: ${table}`);
  const projection = columns.map((column) => {
    const name = String(column.column_name);
    if (!/^[a-z_][a-z0-9_]*$/u.test(name)) throw new Error(`Unsupported source column in ${table}`);
    return ['numeric', 'decimal', 'bigint'].includes(String(column.data_type)) ? `${name}::text AS ${name}` : name;
  }).join(',');
  return (await client.query(`SELECT ${projection} FROM ${table} WHERE user_id=$1 ORDER BY 1`, [userId])).rows;
}

/** 在單一唯讀快照內讀出該使用者所有白名單資料表，然後交易結束（之後才讀附件檔案，不佔用快照）。 */
async function readSnapshot(userId: string): Promise<{ tables: Record<string, Row[]>; attachments: Row[] }> {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) throw new Error('Database URL is not configured');
  const client = new Client({ connectionString, connectionTimeoutMillis: 10_000 });
  await client.connect();
  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
    await client.query("SET LOCAL statement_timeout='120s'");
    const tables: Record<string, Row[]> = {};
    for (const table of ASSET_TABLES) tables[table] = await readExactRows(client, table, userId);
    const attachments = await readExactRows(client, ATTACHMENTS_TABLE, userId);
    await client.query('COMMIT');
    return { tables, attachments };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    await client.end().catch(() => {});
  }
}

export type AttachmentReader = (row: Row) => Promise<Buffer>;
const defaultReader: AttachmentReader = async (row) => (await readTransactionAttachment(row as unknown as TransactionAttachmentRow)).body;

/** 組出可被 NouriLedger parseNouriLedgerBundle 直接吃下的精確 ZIP（含 checksum）。 */
export function assemblePackage(userId: string, tables: Record<string, Row[]>, files: Array<{ row: Row; bytes: Buffer }>, warnings: string[]): Promise<AssetPackage> {
  const zip = new JSZip();
  const counts: Record<string, number> = {};
  const checksums: Record<string, string> = {};
  let total = 0;
  const add = (name: string, bytes: Buffer) => {
    total += bytes.length;
    if (total > MAX_PACKAGE_BYTES) throw new PackageTooLargeError();
    zip.file(name, bytes);
    checksums[name] = sha256(bytes);
  };
  for (const table of ASSET_TABLES) {
    const rows = tables[table] ?? [];
    counts[table] = rows.length;
    add(`data/${table}.json`, Buffer.from(JSON.stringify(rows)));
  }
  for (const { row, bytes } of files) add(`attachments/${String(row.id)}`, bytes);
  counts[ATTACHMENTS_TABLE] = files.length;
  counts.attachment_files = files.length;
  add(`data/${ATTACHMENTS_TABLE}.json`, Buffer.from(JSON.stringify(files.map(({ row }) => row))));
  zip.file('manifest.json', JSON.stringify({
    format: ASSET_FORMAT, version: ASSET_VERSION, userId, exportedAt: new Date().toISOString(),
    numericEncoding: 'postgres-numeric-text', snapshotIsolation: 'repeatable-read-read-only', counts, checksums,
  }));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }).then((buffer) => ({ buffer, counts, warnings }));
}

export async function buildAssetPilotPackage(userId: string, readAttachment: AttachmentReader = defaultReader): Promise<AssetPackage> {
  if (!SOURCE_USER_ID_RE.test(userId)) throw new UnsupportedAccountError();
  const { tables, attachments } = await readSnapshot(userId);

  const files: Array<{ row: Row; bytes: Buffer }> = [];
  let unreadable = 0;
  let oversized = 0;
  let resized = 0;
  for (const row of attachments) {
    if (typeof row.id !== 'string' || !SOURCE_USER_ID_RE.test(row.id) || typeof row.transaction_id !== 'string' || !row.transaction_id) { unreadable += 1; continue; }
    let bytes: Buffer | null = null;
    try { bytes = await readAttachment(row); } catch { bytes = null; }
    if (!bytes || bytes.length === 0) { unreadable += 1; continue; }
    if (bytes.length > MAX_ATTACHMENT_BYTES) { oversized += 1; continue; }
    // 以實際檔案為準：NouriLedger 會拒絕宣告大小與內容不符的附件。
    let metadata = row;
    if (Number(row.byte_size) !== bytes.length) { metadata = { ...row, byte_size: String(bytes.length) }; resized += 1; }
    files.push({ row: metadata, bytes });
  }

  const warnings: string[] = [];
  if (unreadable) warnings.push(`${unreadable} 張交易照片在舊站已無法讀取，已略過（交易本身仍會匯入）。`);
  if (oversized) warnings.push(`${oversized} 張交易照片超過 20 MB，已略過（交易本身仍會匯入）。`);
  if (resized) warnings.push(`${resized} 張交易照片的大小紀錄與實際檔案不符，已以實際檔案為準。`);
  return assemblePackage(userId, tables, files, warnings);
}

export interface AssetUserSummary {
  sourceUserId: string;
  account: { email: string; name: string };
  counts: Record<string, number>;
}

/** NouriLedger 確認頁顯示的身分與筆數（只做 COUNT，使用本站既有的同步資料庫層）。 */
export function summarizeAssetUser(userId: string): AssetUserSummary | null {
  const user = queryOne('SELECT id, email, display_name FROM users WHERE id = ?', [userId]);
  if (!user) return null;
  const count = (table: string) => Number(queryOne(`SELECT COUNT(*) AS count FROM ${table} WHERE user_id = ?`, [userId])?.count ?? 0);
  return {
    sourceUserId: String(user.id),
    account: { email: String(user.email ?? ''), name: String(user.display_name ?? '') },
    counts: {
      accounts: count('accounts'), categories: count('categories'), transactions: count('transactions'), budgets: count('budgets'),
      recurring: count('recurring'), stocks: count('stocks'), stock_transactions: count('stock_transactions'),
      stock_dividends: count('stock_dividends'), transaction_attachments: count(ATTACHMENTS_TABLE),
    },
  };
}
