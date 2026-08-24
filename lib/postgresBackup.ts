import { getDB, queryAll } from "./db";

type AnyRow = Record<string, unknown>;

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

export function createPostgresBackupSql(): string {
  const tables = queryAll(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      AND table_name NOT LIKE 'pg_%'
      AND table_name NOT LIKE 'assetpilot_migration_%'
    ORDER BY table_name
  `).map((row) => String(row.table_name));

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
    const rows = queryAll(
      `SELECT ${selectColumns.join(", ")} FROM ${quoteIdent(table)}`,
    ) as AnyRow[];
    for (const row of rows) {
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

export function restorePostgresBackupSql(sql: string): void {
  if (!isAssetPilotPostgresBackup(sql)) {
    throw new Error("檔案不是 AssetPilot PostgreSQL SQL 備份");
  }
  getDB().run(sql);
}
