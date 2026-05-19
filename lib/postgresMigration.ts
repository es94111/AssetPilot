import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import type { PoolClient } from 'pg';

type SqlValue = string | number | Uint8Array | null;

interface SqlJsDatabase {
  exec(sql: string): Array<{ columns: string[]; values: SqlValue[][] }>;
  close(): void;
}

interface SqlJsStatic {
  Database: new (data?: Uint8Array | number[] | Buffer) => SqlJsDatabase;
}

interface MigrationOptions {
  dbPath: string;
  encryptionKey?: string;
  decryptBuffer: (buffer: Buffer, passphrase: string) => Buffer;
  isEncryptedDB: (buffer: Buffer) => boolean;
}

interface SqliteColumn {
  cid: number;
  name: string;
  type: string;
  notnull: number;
  dflt_value: string | number | null;
  pk: number;
}

interface MigrationStats {
  skipped: boolean;
  sourceHash: string;
  tables: Array<{ name: string; rows: number; skipped: boolean }>;
}

const META_TABLE = 'assetpilot_migration_metadata';

function getPostgresUrl(): string {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || '';
}

function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqliteTypeToPostgres(type: string): string {
  const normalized = type.toUpperCase();
  if (normalized.includes('INT')) return 'BIGINT';
  if (normalized.includes('REAL') || normalized.includes('FLOA') || normalized.includes('DOUB')) return 'DOUBLE PRECISION';
  if (normalized.includes('BLOB')) return 'BYTEA';
  if (normalized.includes('NUM')) return 'NUMERIC';
  return 'TEXT';
}

function normalizeDefault(value: string | number | null): string {
  if (value === null || value === undefined) return '';
  const text = String(value).trim();
  if (!text) return '';
  if (/^\(.+\)$/.test(text)) return ` DEFAULT ${text}`;
  if (/^'.*'$/.test(text)) return ` DEFAULT ${text}`;
  if (/^-?\d+(\.\d+)?$/.test(text)) return ` DEFAULT ${text}`;
  if (/^(NULL|CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME)$/i.test(text)) return ` DEFAULT ${text}`;
  return ` DEFAULT ${quoteLiteral(text)}`;
}

function convertValue(value: SqlValue): SqlValue | Buffer {
  if (value instanceof Uint8Array) return Buffer.from(value);
  return value;
}

function sqliteRows<T extends object>(db: SqlJsDatabase, sql: string): T[] {
  const result = db.exec(sql);
  if (result.length === 0) return [];
  const [{ columns, values }] = result;
  return values.map((row) => Object.fromEntries(columns.map((column, index) => [column, row[index] ?? null])) as T);
}

function createTableSql(table: string, columns: SqliteColumn[]): string {
  const primaryKeys = columns.filter((column) => column.pk > 0).sort((a, b) => a.pk - b.pk);
  const singlePrimaryKey = primaryKeys.length === 1 ? primaryKeys[0].name : '';
  const columnDefs = columns.map((column) => {
    const parts = [
      quoteIdent(column.name),
      sqliteTypeToPostgres(column.type),
      column.notnull || column.name === singlePrimaryKey ? 'NOT NULL' : '',
      column.name === singlePrimaryKey ? 'PRIMARY KEY' : '',
      normalizeDefault(column.dflt_value),
    ];
    return parts.filter(Boolean).join(' ');
  });

  if (primaryKeys.length > 1) {
    columnDefs.push(`PRIMARY KEY (${primaryKeys.map((column) => quoteIdent(column.name)).join(', ')})`);
  }

  return `CREATE TABLE IF NOT EXISTS ${quoteIdent(table)} (${columnDefs.join(', ')})`;
}

async function ensureMetadataTable(client: PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS ${quoteIdent(META_TABLE)} (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function metadataValue(client: PoolClient, key: string): Promise<string> {
  const result = await client.query(`SELECT value FROM ${quoteIdent(META_TABLE)} WHERE key = $1`, [key]);
  return String(result.rows[0]?.value || '');
}

async function upsertMetadata(client: PoolClient, key: string, value: string): Promise<void> {
  await client.query(
    `INSERT INTO ${quoteIdent(META_TABLE)} (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value],
  );
}

async function importTable(client: PoolClient, sqliteDb: SqlJsDatabase, table: string, force: boolean): Promise<{ rows: number; skipped: boolean }> {
  const columns = sqliteRows<SqliteColumn>(sqliteDb, `PRAGMA table_info(${quoteIdent(table)})`);
  if (columns.length === 0) return { rows: 0, skipped: true };

  await client.query(createTableSql(table, columns));

  const count = await client.query(`SELECT COUNT(*)::int AS count FROM ${quoteIdent(table)}`);
  if (!force && Number(count.rows[0]?.count || 0) > 0) {
    return { rows: 0, skipped: true };
  }
  if (force) {
    await client.query(`TRUNCATE TABLE ${quoteIdent(table)}`);
  }

  const columnNames = columns.map((column) => column.name);
  const rows = sqliteRows<Record<string, SqlValue>>(sqliteDb, `SELECT * FROM ${quoteIdent(table)}`);
  if (rows.length === 0) return { rows: 0, skipped: false };

  const pgColumns = columnNames.map(quoteIdent).join(', ');
  const placeholders = columnNames.map((_, index) => `$${index + 1}`).join(', ');
  const insertSql = `INSERT INTO ${quoteIdent(table)} (${pgColumns}) VALUES (${placeholders})`;

  for (const row of rows) {
    await client.query(insertSql, columnNames.map((column) => convertValue(row[column] ?? null)));
  }

  return { rows: rows.length, skipped: false };
}

function readSqliteBuffer(options: MigrationOptions): Buffer {
  const fileBuffer = fs.readFileSync(options.dbPath);
  if (!options.isEncryptedDB(fileBuffer)) return fileBuffer;
  if (!options.encryptionKey) {
    throw new Error('偵測到加密 SQLite .db，但未設定 DB_ENCRYPTION_KEY，無法自動匯入 PostgreSQL');
  }
  return options.decryptBuffer(fileBuffer, options.encryptionKey);
}

export async function migrateSqliteToPostgresIfNeeded(options: MigrationOptions): Promise<MigrationStats | null> {
  const connectionString = getPostgresUrl();
  if (!connectionString) return null;
  if (!fs.existsSync(options.dbPath)) return null;

  const plainBuffer = readSqliteBuffer(options);
  const sourceHash = crypto.createHash('sha256').update(plainBuffer).digest('hex');
  const force = process.env.POSTGRES_MIGRATION_FORCE === '1';

  const [{ Pool }, { default: initSqlJs }] = await Promise.all([
    import('pg'),
    import('sql.js') as unknown as Promise<{ default: (opts: { locateFile: (file: string) => string }) => Promise<SqlJsStatic> }>,
  ]);

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  let sqliteDb: SqlJsDatabase | null = null;

  try {
    await client.query('BEGIN');
    await ensureMetadataTable(client);

    const previousHash = await metadataValue(client, 'sqlite_source_sha256');
    if (!force && previousHash === sourceHash) {
      await client.query('COMMIT');
      return { skipped: true, sourceHash, tables: [] };
    }

    const SQL = await initSqlJs({
      locateFile: (file) => path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', file),
    });
    sqliteDb = new SQL.Database(plainBuffer);

    const tables = sqliteRows<{ name: string }>(
      sqliteDb,
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    ).map((row) => row.name);

    const stats: MigrationStats = { skipped: false, sourceHash, tables: [] };
    for (const table of tables) {
      const imported = await importTable(client, sqliteDb, table, force);
      stats.tables.push({ name: table, rows: imported.rows, skipped: imported.skipped });
    }

    await upsertMetadata(client, 'sqlite_source_sha256', sourceHash);
    await upsertMetadata(client, 'sqlite_source_path', path.resolve(options.dbPath));
    await upsertMetadata(client, 'sqlite_migrated_at', new Date().toISOString());
    await client.query('COMMIT');
    return stats;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { /* noop */ }
    throw error;
  } finally {
    sqliteDb?.close();
    client.release();
    await pool.end();
  }
}
