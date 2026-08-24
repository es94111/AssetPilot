import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import type { PoolClient } from "pg";

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

interface SqliteIndex {
  seq: number;
  name: string;
  unique: number;
  origin: string;
  partial: number;
}

interface SqliteForeignKey {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string | null;
  on_update: string;
  on_delete: string;
  match: string;
}

interface DeferredForeignKey {
  table: string;
  name: string;
  sql: string;
}

interface ImportedTableResult {
  rows: number;
  skipped: boolean;
  indexes: string[];
  foreignKeys: DeferredForeignKey[];
}

interface MigrationStats {
  skipped: boolean;
  sourceHash: string;
  tables: Array<{ name: string; rows: number; skipped: boolean }>;
}

const META_TABLE = "assetpilot_migration_metadata";

function getPostgresUrl(): string {
  return process.env.DATABASE_URL || process.env.POSTGRES_URL || "";
}

function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function sqliteTypeToPostgres(type: string): string {
  const normalized = type.toUpperCase();
  if (normalized.includes("INT")) return "BIGINT";
  if (
    normalized.includes("REAL") ||
    normalized.includes("FLOA") ||
    normalized.includes("DOUB")
  )
    return "NUMERIC";
  if (normalized.includes("BLOB")) return "BYTEA";
  if (normalized.includes("NUM")) return "NUMERIC";
  return "TEXT";
}

function normalizeDefault(value: string | number | null): string {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text) return "";
  if (/^\(.+\)$/.test(text)) return ` DEFAULT ${text}`;
  if (/^'.*'$/.test(text)) return ` DEFAULT ${text}`;
  if (/^-?\d+(\.\d+)?$/.test(text)) return ` DEFAULT ${text}`;
  if (/^(NULL|CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME)$/i.test(text))
    return ` DEFAULT ${text}`;
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
  // SAFETY: sql.js returns one scalar array per row and the caller supplies the
  // PRAGMA/SELECT result interface matching those column names.
  return values.map(
    (row) =>
      Object.fromEntries(
        columns.map((column, index) => [column, row[index] ?? null]),
      ) as T,
  );
}

function columnContainsRealValues(
  db: SqlJsDatabase,
  table: string,
  column: string,
): boolean {
  try {
    const result = db.exec(
      `SELECT 1 FROM ${quoteIdent(table)} WHERE typeof(${quoteIdent(column)}) = 'real' LIMIT 1`,
    );
    return (result[0]?.values.length || 0) > 0;
  } catch (error) {
    void error;
    return false;
  }
}

function resolvePostgresType(
  db: SqlJsDatabase,
  table: string,
  column: SqliteColumn,
): string {
  const normalized = column.type.toUpperCase();
  // SQLite can store a REAL in an INTEGER-affinity column. Preserve that value
  // with NUMERIC instead of silently widening every integer column to float.
  if (
    normalized.includes("INT") &&
    column.pk === 0 &&
    columnContainsRealValues(db, table, column.name)
  ) {
    return "NUMERIC";
  }
  return sqliteTypeToPostgres(column.type);
}

function sqliteCreateTableSql(db: SqlJsDatabase, table: string): string {
  const result = db.exec(
    `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ${quoteLiteral(table)}`,
  );
  const value = result[0]?.values[0]?.[0];
  return typeof value === "string" ? value : "";
}

function sqliteCheckExpressions(db: SqlJsDatabase, table: string): string[] {
  const source = sqliteCreateTableSql(db, table);
  const expressions: string[] = [];
  const pattern = /\bCHECK\s*\(/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const open = source.indexOf("(", match.index);
    let depth = 0;
    let quote = "";
    for (let index = open; index < source.length; index += 1) {
      const char = source[index];
      const next = source[index + 1];
      if (quote) {
        if (char === quote && next === quote) {
          index += 1;
        } else if (char === quote) {
          quote = "";
        }
        continue;
      }
      if (char === "'" || char === '"' || char === "`") {
        quote = char;
        continue;
      }
      if (char === "(") depth += 1;
      if (char === ")") {
        depth -= 1;
        if (depth === 0) {
          const expression = source.slice(open + 1, index).trim();
          if (expression && !expressions.includes(expression))
            expressions.push(expression);
          break;
        }
      }
    }
  }
  return expressions;
}

function sqliteIndexWhere(db: SqlJsDatabase, indexName: string): string {
  const result = db.exec(
    `SELECT sql FROM sqlite_master WHERE type = 'index' AND name = ${quoteLiteral(indexName)}`,
  );
  const value = result[0]?.values[0]?.[0];
  if (typeof value !== "string") return "";
  const source = value.replace(/;\s*$/u, "");
  const match = /\bWHERE\b([\s\S]*)$/iu.exec(source);
  return match ? match[1].trim() : "";
}

function sqliteIndexDefinitions(db: SqlJsDatabase, table: string): string[] {
  const indexes = sqliteRows<SqliteIndex>(
    db,
    `PRAGMA index_list(${quoteIdent(table)})`,
  );
  return indexes
    .filter((index) => String(index.origin || "") !== "pk")
    .map((index) => {
      const columns = sqliteRows<{ seqno: number; name: string | null }>(
        db,
        `PRAGMA index_info(${quoteIdent(index.name)})`,
      ).sort((left, right) => left.seqno - right.seqno);
      if (columns.length === 0 || columns.some((column) => !column.name))
        return "";
      const indexName = String(index.name).startsWith("sqlite_autoindex_")
        ? `assetpilot_unique_${table}_${index.seq}`
        : String(index.name);
      const where = index.partial ? sqliteIndexWhere(db, index.name) : "";
      return `CREATE ${index.unique ? "UNIQUE " : ""}INDEX IF NOT EXISTS ${quoteIdent(indexName)} ON ${quoteIdent(table)} (${columns.map((column) => quoteIdent(String(column.name))).join(", ")})${where ? ` WHERE ${where}` : ""}`;
    })
    .filter(Boolean);
}

function sqliteForeignAction(value: string): string {
  const action = String(value || "").toUpperCase();
  return [
    "NO ACTION",
    "RESTRICT",
    "SET NULL",
    "SET DEFAULT",
    "CASCADE",
  ].includes(action)
    ? action
    : "NO ACTION";
}

function sqliteForeignKeyDefinitions(
  db: SqlJsDatabase,
  table: string,
): DeferredForeignKey[] {
  const rows = sqliteRows<SqliteForeignKey>(
    db,
    `PRAGMA foreign_key_list(${quoteIdent(table)})`,
  );
  const grouped = new Map<number, SqliteForeignKey[]>();
  rows.forEach((row) => {
    const current = grouped.get(Number(row.id)) || [];
    current.push(row);
    grouped.set(Number(row.id), current);
  });

  return [...grouped.entries()].map(([id, parts]) => {
    const ordered = parts.sort(
      (left, right) => Number(left.seq) - Number(right.seq),
    );
    const first = ordered[0];
    const localColumns = ordered.map((part) => quoteIdent(String(part.from)));
    const foreignColumns = ordered
      .map((part) => (part.to ? quoteIdent(String(part.to)) : ""))
      .filter(Boolean);
    const references =
      foreignColumns.length === ordered.length
        ? `${quoteIdent(String(first.table))} (${foreignColumns.join(", ")})`
        : quoteIdent(String(first.table));
    const update = sqliteForeignAction(first.on_update);
    const remove = sqliteForeignAction(first.on_delete);
    const suffix = `${update !== "NO ACTION" ? ` ON UPDATE ${update}` : ""}${remove !== "NO ACTION" ? ` ON DELETE ${remove}` : ""}`;
    const name = `assetpilot_fk_${table}_${id}`;
    const sql = `ALTER TABLE ${quoteIdent(table)} ADD CONSTRAINT ${quoteIdent(name)} FOREIGN KEY (${localColumns.join(", ")}) REFERENCES ${references}${suffix}`;
    return { table, name, sql };
  });
}

function createTableSql(
  db: SqlJsDatabase,
  table: string,
  columns: SqliteColumn[],
): string {
  const primaryKeys = columns
    .filter((column) => column.pk > 0)
    .sort((a, b) => a.pk - b.pk);
  const singlePrimaryKey = primaryKeys.length === 1 ? primaryKeys[0].name : "";
  const columnDefs = columns.map((column) => {
    const parts = [
      quoteIdent(column.name),
      resolvePostgresType(db, table, column),
      column.notnull || column.name === singlePrimaryKey ? "NOT NULL" : "",
      column.name === singlePrimaryKey ? "PRIMARY KEY" : "",
      normalizeDefault(column.dflt_value),
    ];
    return parts.filter(Boolean).join(" ");
  });

  if (primaryKeys.length > 1) {
    columnDefs.push(
      `PRIMARY KEY (${primaryKeys.map((column) => quoteIdent(column.name)).join(", ")})`,
    );
  }
  for (const expression of sqliteCheckExpressions(db, table)) {
    columnDefs.push(`CHECK (${expression})`);
  }

  // SAFETY: table/column identifiers are read from the trusted SQLite schema
  // and quoteIdent prevents them from becoming SQL syntax.
  return `CREATE TABLE IF NOT EXISTS ${quoteIdent(table)} (${columnDefs.join(", ")})`;
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
  const result = await client.query(
    `SELECT value FROM ${quoteIdent(META_TABLE)} WHERE key = $1`,
    [key],
  );
  return String(result.rows[0]?.value || "");
}

async function upsertMetadata(
  client: PoolClient,
  key: string,
  value: string,
): Promise<void> {
  await client.query(
    `INSERT INTO ${quoteIdent(META_TABLE)} (key, value, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value],
  );
}

async function importTable(
  client: PoolClient,
  sqliteDb: SqlJsDatabase,
  table: string,
  force: boolean,
): Promise<ImportedTableResult> {
  const columns = sqliteRows<SqliteColumn>(
    sqliteDb,
    `PRAGMA table_info(${quoteIdent(table)})`,
  );
  const indexes = sqliteIndexDefinitions(sqliteDb, table);
  const foreignKeys = sqliteForeignKeyDefinitions(sqliteDb, table);
  if (columns.length === 0)
    return { rows: 0, skipped: true, indexes, foreignKeys };

  await client.query(createTableSql(sqliteDb, table, columns));

  const count = await client.query(
    `SELECT COUNT(*)::int AS count FROM ${quoteIdent(table)}`,
  );
  if (!force && Number(count.rows[0]?.count || 0) > 0) {
    return { rows: 0, skipped: true, indexes, foreignKeys };
  }
  if (force) {
    await client.query(`TRUNCATE TABLE ${quoteIdent(table)}`);
  }

  const columnNames = columns.map((column) => column.name);
  const rows = sqliteRows<Record<string, SqlValue>>(
    sqliteDb,
    `SELECT * FROM ${quoteIdent(table)}`,
  );
  if (rows.length === 0)
    return { rows: 0, skipped: false, indexes, foreignKeys };

  const pgColumns = columnNames.map(quoteIdent).join(", ");
  const placeholders = columnNames
    .map((_, index) => `$${index + 1}`)
    .join(", ");
  const insertSql = `INSERT INTO ${quoteIdent(table)} (${pgColumns}) VALUES (${placeholders})`;

  for (const row of rows) {
    await client.query(
      insertSql,
      columnNames.map((column) => convertValue(row[column] ?? null)),
    );
  }

  return { rows: rows.length, skipped: false, indexes, foreignKeys };
}

function readSqliteBuffer(options: MigrationOptions): Buffer {
  const fileBuffer = fs.readFileSync(options.dbPath);
  if (!options.isEncryptedDB(fileBuffer)) return fileBuffer;
  if (!options.encryptionKey) {
    throw new Error(
      "偵測到加密 SQLite .db，但未設定 DB_ENCRYPTION_KEY，無法自動匯入 PostgreSQL",
    );
  }
  return options.decryptBuffer(fileBuffer, options.encryptionKey);
}

export async function migrateSqliteToPostgresIfNeeded(
  options: MigrationOptions,
): Promise<MigrationStats | null> {
  const connectionString = getPostgresUrl();
  if (!connectionString) return null;
  if (!fs.existsSync(options.dbPath)) return null;

  const plainBuffer = readSqliteBuffer(options);
  const sourceHash = crypto
    .createHash("sha256")
    .update(plainBuffer)
    .digest("hex");
  const force = process.env.POSTGRES_MIGRATION_FORCE === "1";

  // Keep pg out of Next's edge/instrumentation bundle. Static import() makes webpack
  // follow pgpass -> stream/net/dns even though this code only runs in Node.js.
  const importModule = new Function(
    "specifier",
    "return import(specifier)",
  ) as (specifier: string) => Promise<typeof import("module")>;
  const { createRequire } = await importModule("module");
  const runtimeRequire = createRequire(import.meta.url);
  const pgPackage = "p" + "g";
  const { Pool } = runtimeRequire(pgPackage) as typeof import("pg");
  // SAFETY: sql.js exposes the documented default initializer; this cast keeps
  // its dynamic import out of the Next.js edge bundle.
  const { default: initSqlJs } = (await import("sql.js")) as unknown as {
    default: (opts: {
      locateFile: (file: string) => string;
    }) => Promise<SqlJsStatic>;
  };

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  let sqliteDb: SqlJsDatabase | null = null;

  try {
    await client.query("BEGIN");
    await ensureMetadataTable(client);

    const previousHash = await metadataValue(client, "sqlite_source_sha256");
    if (!force && previousHash === sourceHash) {
      await client.query("COMMIT");
      return { skipped: true, sourceHash, tables: [] };
    }

    const SQL = await initSqlJs({
      // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal -- file 由 sql.js 內部以固定資產檔名（如 sql-wasm.wasm）傳入，非使用者輸入
      locateFile: (file) =>
        path.join(process.cwd(), "node_modules", "sql.js", "dist", file),
    });
    sqliteDb = new SQL.Database(plainBuffer);

    const tables = sqliteRows<{ name: string }>(
      sqliteDb,
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    ).map((row) => row.name);

    const stats: MigrationStats = { skipped: false, sourceHash, tables: [] };
    const deferredIndexes = new Set<string>();
    const deferredForeignKeys = new Map<string, DeferredForeignKey>();
    for (const table of tables) {
      const imported = await importTable(client, sqliteDb, table, force);
      stats.tables.push({
        name: table,
        rows: imported.rows,
        skipped: imported.skipped,
      });
      imported.indexes.forEach((index) => deferredIndexes.add(index));
      imported.foreignKeys.forEach((foreignKey) =>
        deferredForeignKeys.set(
          `${foreignKey.table}:${foreignKey.name}`,
          foreignKey,
        ),
      );
    }

    // Foreign keys are added after every table and row exists, so the source
    // SQLite table order cannot cause a referenced-table creation failure.
    for (const foreignKey of deferredForeignKeys.values()) {
      const existing = await client.query(
        "SELECT 1 FROM pg_constraint WHERE conname = $1 AND conrelid = to_regclass($2)",
        [foreignKey.name, `public.${foreignKey.table}`],
      );
      if (existing.rowCount === 0) await client.query(foreignKey.sql);
    }
    for (const index of deferredIndexes) await client.query(index);

    await upsertMetadata(client, "sqlite_source_sha256", sourceHash);
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal -- options.dbPath 為內部/CLI 遷移來源路徑，僅作為 metadata 字串記錄，無檔案存取
    await upsertMetadata(
      client,
      "sqlite_source_path",
      path.resolve(options.dbPath),
    );
    await upsertMetadata(
      client,
      "sqlite_migrated_at",
      new Date().toISOString(),
    );
    await client.query("COMMIT");
    return stats;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error("[postgresMigration] rollback failed", rollbackError);
    }
    throw error;
  } finally {
    sqliteDb?.close();
    client.release();
    await pool.end();
  }
}
