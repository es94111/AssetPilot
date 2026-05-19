import { getDB, queryAll } from './db';

type AnyRow = Record<string, unknown>;

const BACKUP_HEADER = '-- AssetPilot PostgreSQL backup';

function quoteIdent(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (Buffer.isBuffer(value)) return `'\\x${value.toString('hex')}'`;
  if (value instanceof Uint8Array) return `'\\x${Buffer.from(value).toString('hex')}'`;
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'object') return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  return `'${String(value).replace(/'/g, "''")}'`;
}

function pgColumnType(row: AnyRow): string {
  const dataType = String(row.data_type || '');
  const udtName = String(row.udt_name || '');
  const maxLength = row.character_maximum_length;
  const precision = row.numeric_precision;
  const scale = row.numeric_scale;

  if (dataType === 'character varying' && maxLength) return `varchar(${maxLength})`;
  if (dataType === 'character' && maxLength) return `char(${maxLength})`;
  if (dataType === 'numeric' && precision && scale !== null && scale !== undefined) return `numeric(${precision},${scale})`;
  if (dataType === 'ARRAY') return `${udtName.replace(/^_/u, '')}[]`;
  return dataType || udtName || 'text';
}

function createTableSql(table: string, columns: AnyRow[], primaryKeys: string[]): string {
  const defs = columns.map((column) => {
    const parts = [
      quoteIdent(String(column.column_name)),
      pgColumnType(column),
      column.is_nullable === 'NO' ? 'NOT NULL' : '',
      column.column_default ? `DEFAULT ${column.column_default}` : '',
    ];
    return `  ${parts.filter(Boolean).join(' ')}`;
  });
  if (primaryKeys.length > 0) {
    defs.push(`  PRIMARY KEY (${primaryKeys.map(quoteIdent).join(', ')})`);
  }
  return `CREATE TABLE ${quoteIdent(table)} (\n${defs.join(',\n')}\n);`;
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
    ORDER BY table_name
  `).map((row) => String(row.table_name));

  const lines: string[] = [
    BACKUP_HEADER,
    `-- created_at: ${new Date().toISOString()}`,
    'BEGIN;',
    'SET CONSTRAINTS ALL DEFERRED;',
    '',
  ];

  for (const table of [...tables].reverse()) {
    lines.push(`DROP TABLE IF EXISTS ${quoteIdent(table)} CASCADE;`);
  }
  lines.push('');

  for (const table of tables) {
    const columns = queryAll(`
      SELECT column_name, data_type, udt_name, character_maximum_length, numeric_precision, numeric_scale,
             is_nullable, column_default, ordinal_position
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = ?
      ORDER BY ordinal_position
    `, [table]) as AnyRow[];

    const primaryKeys = queryAll(`
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
    `, [table]).map((row) => String(row.column_name));

    lines.push(createTableSql(table, columns, primaryKeys));

    const columnNames = columns.map((column) => String(column.column_name));
    const rows = queryAll(`SELECT * FROM ${quoteIdent(table)}`) as AnyRow[];
    for (const row of rows) {
      const values = columnNames.map((column) => sqlLiteral(row[column]));
      lines.push(`INSERT INTO ${quoteIdent(table)} (${columnNames.map(quoteIdent).join(', ')}) VALUES (${values.join(', ')});`);
    }
    lines.push('');
  }

  lines.push('COMMIT;');
  lines.push('');
  return lines.join('\n');
}

export function restorePostgresBackupSql(sql: string): void {
  if (!isAssetPilotPostgresBackup(sql)) {
    throw new Error('檔案不是 AssetPilot PostgreSQL SQL 備份');
  }
  getDB().run(sql);
}
