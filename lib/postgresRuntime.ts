type DbValue = string | number | null | Uint8Array;
type DbRow = Record<string, string | number | null>;
type RuntimeWorker = import('worker_threads').Worker;

interface PgQueryResult {
  rows: DbRow[];
  fields: string[];
  rowCount: number;
}

interface PgWorkerPayload {
  ok: boolean;
  result?: PgQueryResult;
  error?: string;
}

interface StatementLike {
  bind(params?: DbValue[]): void;
  step(): boolean;
  getAsObject(): DbRow;
  free(): void;
}

const RESULT_BUFFER_BYTES = Number(process.env.POSTGRES_SYNC_RESULT_BUFFER_BYTES || 64 * 1024 * 1024);

let worker: RuntimeWorker | null = null;
let lastRowsModified = 0;

function getWorker(): RuntimeWorker {
  if (!worker) {
    const workerThreads = (process as unknown as { getBuiltinModule?: (name: string) => typeof import('worker_threads') }).getBuiltinModule?.('worker_threads');
    if (!workerThreads) throw new Error('worker_threads module is not available');
    worker = new workerThreads.Worker(`${process.cwd()}/lib/pgSyncWorker.cjs`);
  }
  return worker;
}

function isIdentChar(char: string): boolean {
  return /[A-Za-z0-9_."]/u.test(char);
}

function pgTypeofExpression(sql: string): string {
  return sql.replace(/typeof\s*\(\s*([^)]+?)\s*\)/gi, 'pg_typeof($1)::text');
}

function translatePlaceholders(sql: string, params: DbValue[]): { sql: string; params: DbValue[] } {
  let out = '';
  const outParams: DbValue[] = [];
  let paramIndex = 0;
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];
    const next = sql[i + 1];

    if (char === "'" && !inDouble) {
      out += char;
      if (inSingle && next === "'") {
        out += next;
        i += 1;
      } else {
        inSingle = !inSingle;
      }
      continue;
    }
    if (char === '"' && !inSingle) {
      out += char;
      inDouble = !inDouble;
      continue;
    }
    if (char !== '?' || inSingle || inDouble) {
      out += char;
      continue;
    }

    const value = params[paramIndex++];
    const before = out;
    let j = before.length - 1;
    while (j >= 0 && /\s/u.test(before[j])) j -= 1;
    const opEnd = j + 1;
    while (j >= 0 && /[A-Za-z]/u.test(before[j])) j -= 1;
    const op = before.slice(j + 1, opEnd).toUpperCase();

    if (op === 'IS') {
      out = before.slice(0, j + 1).replace(/\s+$/u, '');
      if (value === null || value === undefined) {
        out += ' IS NULL';
      } else {
        out += ` = $${outParams.length + 1}`;
        outParams.push(value);
      }
    } else {
      out += `$${outParams.length + 1}`;
      outParams.push(value);
    }
  }

  return { sql: out, params: outParams };
}

function translateSql(sql: string, params: DbValue[] = []): { sql: string; params: DbValue[] } {
  let next = sql.trim();
  next = pgTypeofExpression(next);
  return translatePlaceholders(next, params);
}

function runPg(sql: string, params: DbValue[] = []): PgQueryResult {
  const shared = new SharedArrayBuffer(8 + RESULT_BUFFER_BYTES);
  const state = new Int32Array(shared, 0, 2);
  const bytes = new Uint8Array(shared, 8);
  getWorker().postMessage({ sql, params, shared });
  Atomics.wait(state, 0, 0);
  const length = Atomics.load(state, 1);
  const json = Buffer.from(bytes.subarray(0, length)).toString('utf8');
  const payload = JSON.parse(json) as PgWorkerPayload;
  if (!payload.ok) throw new Error(payload.error || 'PostgreSQL query failed');
  return payload.result || { rows: [], fields: [], rowCount: 0 };
}

class PostgresStatement implements StatementLike {
  private rows: DbRow[] = [];
  private index = -1;
  private current: DbRow | null = null;

  constructor(private readonly sql: string) {}

  bind(params: DbValue[] = []): void {
    const query = translateSql(this.sql, params);
    const result = runPg(query.sql, query.params);
    this.rows = result.rows;
    this.index = -1;
    this.current = null;
  }

  step(): boolean {
    this.index += 1;
    this.current = this.rows[this.index] || null;
    return !!this.current;
  }

  getAsObject(): DbRow {
    return this.current || {};
  }

  free(): void {
    this.rows = [];
    this.current = null;
  }
}

export class PostgresCompatDatabase {
  prepare(sql: string): StatementLike {
    return new PostgresStatement(sql);
  }

  run(sql: string, params: DbValue[] = []): void {
    const query = translateSql(sql, params);
    const result = runPg(query.sql, query.params);
    lastRowsModified = result.rowCount;
  }

  exec(sql: string): Array<{ columns: string[]; values: Array<Array<string | number | null>> }> {
    const query = translateSql(sql, []);
    const result = runPg(query.sql, query.params);
    lastRowsModified = result.rowCount;
    if (result.fields.length === 0) return [];
    return [{
      columns: result.fields,
      values: result.rows.map((row) => result.fields.map((field) => row[field] ?? null)),
    }];
  }

  getRowsModified(): number {
    return lastRowsModified;
  }

  close(): void {
    worker?.terminate();
    worker = null;
  }
}
