import { disableReportsWithoutEmail, ensureSharedLedgerOwnerProtection, getDB, queryOne, queryAll } from "./db";
import { clearKeyringCache } from "./keyring";
import { isPostgresResultTooLarge } from "./postgresRuntime";

export type AnyRow = Record<string, unknown>;

const BACKUP_HEADER = "-- AssetPilot PostgreSQL backup";

function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (Buffer.isBuffer(value)) return `'\\x${value.toString("hex")}'`;
  if (value instanceof Uint8Array)
    return `'\\x${Buffer.from(value).toString("hex")}'`;
  if (typeof value === "number")
    return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "object")
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

function pgColumnType(row: AnyRow): string {
  const dataType = String(row.data_type || "");
  const udtName = String(row.udt_name || "");
  const maxLength = row.character_maximum_length;
  const precision = row.numeric_precision;
  const scale = row.numeric_scale;

  if (dataType === "character varying" && maxLength)
    return `varchar(${maxLength})`;
  if (dataType === "character" && maxLength) return `char(${maxLength})`;
  if (
    dataType === "numeric" &&
    precision &&
    scale !== null &&
    scale !== undefined
  )
    return `numeric(${precision},${scale})`;
  if (dataType === "ARRAY") return `${udtName.replace(/^_/u, "")}[]`;
  return dataType || udtName || "text";
}

function createTableSql(
  table: string,
  columns: AnyRow[],
  primaryKeys: string[],
): string {
  const defs = columns.map((column) => {
    const parts = [
      quoteIdent(String(column.column_name)),
      pgColumnType(column),
      column.is_nullable === "NO" ? "NOT NULL" : "",
      column.column_default ? `DEFAULT ${column.column_default}` : "",
    ];
    return `  ${parts.filter(Boolean).join(" ")}`;
  });
  if (primaryKeys.length > 0) {
    defs.push(`  PRIMARY KEY (${primaryKeys.map(quoteIdent).join(", ")})`);
  }
  // SAFETY: table/column names come from information_schema and are quoted by
  // quoteIdent; constraint definitions come directly from PostgreSQL metadata.
  return `CREATE TABLE ${quoteIdent(table)} (\n${defs.join(",\n")}\n);`;
}

function createConstraintSql(
  table: string,
  name: string,
  definition: string,
): string {
  // SAFETY: table and constraint names are metadata identifiers and are quoted;
  // definition is returned by pg_get_constraintdef(), not user input.
  return `ALTER TABLE ${quoteIdent(table)} ADD CONSTRAINT ${quoteIdent(name)} ${definition};`;
}

export function isAssetPilotPostgresBackup(sql: string): boolean {
  return sql.trimStart().startsWith(BACKUP_HEADER);
}

// ── Restore-time SQL grammar allowlist ──────────────────────────────────────
// A predictable header comment alone does not stop an attacker from appending
// arbitrary SQL after it. Before executing an uploaded "backup", the file is
// tokenized and every top-level statement must match one of the shapes this
// module itself generates in createPostgresBackupSql(). Anything else — a
// second statement type, a function/procedure body, a role/extension change,
// dollar-quoting, block comments — is rejected outright. This is defense in
// depth for an already super-admin-gated route, not a general SQL sandbox.
export const MAX_RESTORE_SQL_BYTES = 200 * 1024 * 1024;
const MAX_RESTORE_STATEMENTS = 500_000;

// Function/keyword substrings that have no place in a generated backup and
// could otherwise hide inside a permissive CREATE TABLE/INDEX/CONSTRAINT
// clause (e.g. a DEFAULT or index predicate expression).
const DANGEROUS_SQL_SUBSTRINGS = [
  "pg_read_file",
  "pg_read_binary_file",
  "pg_ls_dir",
  "pg_ls_logdir",
  "pg_ls_waldir",
  "pg_stat_file",
  "pg_reload_conf",
  "pg_rotate_logfile",
  "pg_terminate_backend",
  "pg_cancel_backend",
  "lo_import",
  "lo_export",
  "dblink",
  "copy ",
  "\\copy",
  "pg_sleep",
  "current_setting",
  "set_config",
  "create function",
  "create procedure",
  "create extension",
  "create role",
  "create user",
  "alter role",
  "alter user",
  "alter system",
  "grant ",
  "revoke ",
  "do $",
  "do  $",
  "execute ",
  "copy(",
];

const RESTORE_STATEMENT_PATTERNS: RegExp[] = [
  /^DROP TABLE IF EXISTS "(?:[^"]|"")+" CASCADE$/i,
  /^CREATE TABLE "(?:[^"]|"")+" \([\s\S]*\)$/i,
  /^ALTER TABLE "(?:[^"]|"")+" ADD CONSTRAINT "(?:[^"]|"")+" [\s\S]+$/i,
  /^CREATE (?:UNIQUE )?INDEX\s+[\s\S]+\s+ON\s+[\s\S]+$/i,
  /^INSERT INTO "(?:[^"]|"")+" \([\s\S]*?\) VALUES \([\s\S]*\)$/i,
];

export class RestoreValidationError extends Error {}

export class RestoreLimitError extends RestoreValidationError {
  constructor(readonly limit: "bytes" | "statements", message: string) {
    super(message);
  }
}

export class RestoreTransactionError extends Error {
  constructor(readonly rolledBack: boolean, cause: unknown) {
    super("PostgreSQL restore transaction failed", { cause });
  }
}

// Reads top-level (`;`-terminated) statements while respecting
// single-quoted string literals and double-quoted identifiers, and dropping
// line comments. Dollar-quoting and block comments are not part of the
// generated grammar, so encountering either is treated as invalid input.
function* readTopLevelStatements(sql: string) {
  let start = 0;
  let current = "";
  let i = 0;
  const n = sql.length;
  while (i < n) {
    const ch = sql[i];
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let j = i + 1;
      while (j < n) {
        if (sql[j] === quote) {
          if (sql[j + 1] === quote) {
            j += 2;
            continue;
          }
          j += 1;
          break;
        }
        j += 1;
      }
      current += sql.slice(i, j);
      i = j;
      continue;
    }
    if (ch === "-" && sql[i + 1] === "-") {
      let j = i;
      while (j < n && sql[j] !== "\n") j += 1;
      i = j;
      continue;
    }
    if (ch === "/" && sql[i + 1] === "*") {
      throw new RestoreValidationError("備份檔包含不支援的區塊註解");
    }
    if (ch === "$") {
      throw new RestoreValidationError("備份檔包含不支援的字元序列（$）");
    }
    if (ch === ";") {
      yield { text: current, start, end: i + 1 };
      current = "";
      start = i + 1;
      i += 1;
      continue;
    }
    current += ch;
    i += 1;
  }
  if (current.trim()) throw new RestoreValidationError("備份檔包含未結束的 SQL 陳述式");
}

function readRestorableTransaction(sql: string) {
  if (Buffer.byteLength(sql, "utf8") > MAX_RESTORE_SQL_BYTES) {
    throw new RestoreLimitError(
      "bytes",
      `備份檔過大（上限 ${Math.round(MAX_RESTORE_SQL_BYTES / 1024 / 1024)}MB）`,
    );
  }

  let bodyStart: number | undefined;
  let bodyEnd: number | undefined;
  let count = 0;
  const createdTables = new Set<string>();
  for (const statement of readTopLevelStatements(sql)) {
    count += 1;
    if (count > MAX_RESTORE_STATEMENTS) {
      throw new RestoreLimitError(
        "statements",
        `備份檔陳述式數量過多（上限 ${MAX_RESTORE_STATEMENTS}）`,
      );
    }
    const stmt = statement.text.trim();
    if (!stmt) continue;

    if (bodyEnd !== undefined) {
      throw new RestoreValidationError("備份檔必須使用單一 SQL 交易");
    }
    if (bodyStart === undefined) {
      if (!/^BEGIN$/i.test(stmt)) {
        throw new RestoreValidationError("備份檔缺少完整的 SQL 交易");
      }
      bodyStart = statement.end;
      continue;
    }
    if (/^COMMIT$/i.test(stmt)) {
      bodyEnd = statement.start;
      continue;
    }

    const matched = RESTORE_STATEMENT_PATTERNS.some((pattern) =>
      pattern.test(stmt),
    );
    if (!matched) {
      throw new RestoreValidationError("備份檔包含不符合預期格式的 SQL 陳述式，已拒絕還原");
    }
    const created = /^CREATE TABLE "((?:[^"]|"")+)" \(/i.exec(stmt);
    if (created) createdTables.add(created[1].replace(/""/g, '"'));

    // INSERT statements carry only literal row data (never itself executed as
    // SQL), so the keyword blocklist below is scoped to DDL statements, where
    // a crafted DEFAULT/CHECK/index-predicate expression could otherwise hide
    // a dangerous function call. Applying it to INSERT data too would risk
    // false positives on ordinary user text (e.g. a transaction note).
    const isInsert = /^INSERT INTO /i.test(stmt);
    if (!isInsert) {
      const lower = stmt.toLowerCase();
      for (const needle of DANGEROUS_SQL_SUBSTRINGS) {
        if (lower.includes(needle)) {
          throw new RestoreValidationError("備份檔包含不允許的 SQL 內容");
        }
      }
    }
  }
  if (bodyStart === undefined || bodyEnd === undefined) {
    throw new RestoreValidationError("備份檔缺少完整的 SQL 交易");
  }
  return { body: sql.slice(bodyStart, bodyEnd), createdTables: [...createdTables] };
}

export function assertRestorableBackupSql(sql: string): void {
  readRestorableTransaction(sql);
}

export interface PostgresBackupOptions {
  // Return null to omit the row from the dump.
  transformRow?: (table: string, row: AnyRow) => AnyRow | null;
}

function listPostgresBackupTables(): string[] {
  return queryAll(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE 'pg_%'
      AND table_name NOT LIKE 'assetpilot_migration_%'
    ORDER BY table_name
  `).map((row) => String(row.table_name));
}

function* readBackupRows(selectSql: string) {
  const db = getDB();
  const cursor = "assetpilot_backup_rows";
  db.runPostgresSql(`DECLARE "${cursor}" SCROLL CURSOR FOR ${selectSql}`);
  let batchSize = 128;
  let position = 0;
  for (;;) {
    let rows: AnyRow[];
    try {
      rows = queryAll(`FETCH FORWARD ${batchSize} FROM "${cursor}"`);
    } catch (error) {
      if (!isPostgresResultTooLarge(error) || batchSize === 1) throw error;
      // PostgreSQL fetched the oversized batch successfully, so rewind to the last emitted row.
      db.runPostgresSql(`MOVE ABSOLUTE ${position} FROM "${cursor}"`);
      batchSize = Math.floor(batchSize / 2);
      continue;
    }
    yield* rows;
    position += rows.length;
    if (rows.length < batchSize) break;
  }
  db.runPostgresSql(`CLOSE "${cursor}"`);
}

export function createPostgresBackupSnapshot(options: PostgresBackupOptions = {}) {
  const db = getDB();
  db.run("BEGIN");
  try {
    db.runPostgresSql("SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY");
    const tables = listPostgresBackupTables();
    const sql = buildPostgresBackupSql(tables, options);
    db.run("COMMIT");
    return { sql, tables };
  } catch (error) {
    try { db.run("ROLLBACK"); } catch { /* connection may already be closed */ }
    throw error;
  }
}

export function createPostgresBackupSql(options: PostgresBackupOptions = {}): string {
  return createPostgresBackupSnapshot(options).sql;
}

function buildPostgresBackupSql(tables: string[], options: PostgresBackupOptions): string {
  const lines: string[] = [
    BACKUP_HEADER,
    `-- created_at: ${new Date().toISOString()}`,
    "BEGIN;",
    "",
  ];

  for (const table of [...tables].reverse()) {
    lines.push(`DROP TABLE IF EXISTS ${quoteIdent(table)} CASCADE;`);
  }
  lines.push("");

  const deferredConstraints: string[] = [];
  const deferredIndexes: string[] = [];

  for (const table of tables) {
    const columns = queryAll(
      `
      SELECT column_name, data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale,
             is_nullable, column_default, ordinal_position
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ?
      ORDER BY ordinal_position
    `,
      [table],
    ) as AnyRow[];

    const primaryKeys = queryAll(
      `
      SELECT kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
       AND tc.table_name = kcu.table_name
      WHERE tc.table_schema = 'public'
        AND tc.table_name = ?
        AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY kcu.ordinal_position
    `,
      [table],
    ).map((row) => String(row.column_name));

    const constraints = queryAll(
      `
      SELECT conname, pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c
      WHERE c.conrelid = to_regclass(?)
        AND c.contype <> 'p'
      ORDER BY conname
    `,
      [`public.${table}`],
    ) as AnyRow[];
    constraints.forEach((constraint) => {
      deferredConstraints.push(
        createConstraintSql(
          table,
          String(constraint.conname),
          String(constraint.definition),
        ),
      );
    });

    const indexes = queryAll(
      `
      SELECT indexrelid::regclass::text AS index_name, pg_get_indexdef(indexrelid) AS index_definition
      FROM pg_index
      WHERE indrelid = to_regclass(?)
        AND NOT indisprimary
        AND NOT EXISTS (
          SELECT 1 FROM pg_constraint c WHERE c.conindid = pg_index.indexrelid
        )
      ORDER BY indexrelid::regclass::text
    `,
      [`public.${table}`],
    ) as AnyRow[];
    indexes.forEach((index) => {
      const definition = String(index.index_definition).replace(/;\s*$/u, "");
      deferredIndexes.push(`${definition};`);
    });

    lines.push(createTableSql(table, columns, primaryKeys));

    const columnNames = columns.map((column) => String(column.column_name));
    // Keep NUMERIC values as decimal text while exporting; the worker's API
    // compatibility parser converts ordinary NUMERIC reads to Number, which
    // would otherwise round values larger than JavaScript's safe integer range.
    const selectColumns = columns.map((column) => {
      const name = quoteIdent(String(column.column_name));
      return String(column.data_type) === "numeric"
        ? `${name}::text AS ${name}`
        : name;
    });
    // SAFETY: every projection/table identifier is read from information_schema
    // and quoted; no user-provided SQL reaches this statement.
    const rows = readBackupRows(
      `SELECT ${selectColumns.join(", ")} FROM ${quoteIdent(table)}`,
    );
    for (const original of rows) {
      const row = options.transformRow ? options.transformRow(table, original) : original;
      if (!row) continue;
      const values = columnNames.map((column) => sqlLiteral(row[column]));
      lines.push(
        `INSERT INTO ${quoteIdent(table)} (${columnNames.map(quoteIdent).join(", ")}) VALUES (${values.join(", ")});`,
      );
    }
    lines.push("");
  }

  // Add UNIQUE/CHECK/FOREIGN KEY constraints only after every table and row
  // exists; this keeps arbitrary table ordering valid during restore.
  lines.push("-- constraints");
  lines.push(...deferredConstraints);
  lines.push("-- indexes");
  lines.push(...deferredIndexes);
  lines.push("");
  lines.push("COMMIT;");
  lines.push("");
  return lines.join("\n");
}

export function restorePostgresBackupSql(sql: string, options: {
  beforeApply?: (createdTables: string[]) => void;
  dropIntroducedTables?: string[];
} = {}): void {
  if (!isAssetPilotPostgresBackup(sql)) {
    throw new RestoreValidationError("檔案不是 AssetPilot PostgreSQL SQL 備份");
  }
  const { body, createdTables } = readRestorableTransaction(sql);
  options.beforeApply?.(createdTables);
  const db = getDB();
  let started = false;
  let committing = false;
  try {
    db.run("BEGIN");
    started = true;
    for (const table of options.dropIntroducedTables ?? []) {
      db.runPostgresSql(`DROP TABLE IF EXISTS "public".${quoteIdent(table)} CASCADE`);
    }
    if (body.trim()) db.runPostgresSql(body);
    const emailColumn = queryOne(
      "SELECT 1 FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = 'report_schedules' AND column_name = 'notify_email'",
    );
    if (emailColumn) disableReportsWithoutEmail(db);
    const ledgerProtectionMissing = queryOne(`
      SELECT 1
      WHERE to_regclass('users') IS NOT NULL AND to_regclass('financial_ledgers') IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM pg_trigger WHERE tgrelid = to_regclass('users') AND tgname = 'protect_shared_ledger_owner'
        )
    `);
    if (ledgerProtectionMissing) ensureSharedLedgerOwnerProtection(db);
    committing = true;
    db.run("COMMIT");
  } catch (error) {
    let rolledBack = !started;
    if (started) {
      try {
        db.run("ROLLBACK");
        rolledBack = !committing;
      } catch { /* the transaction result may be unknown */ }
    }
    throw new RestoreTransactionError(rolledBack, error);
  }
  clearKeyringCache();
}
