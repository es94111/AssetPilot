// Dedicated process: exercises resolveRootKek()'s "subsequent boot" path, where a wrapped root
// KEK already exists in keyring_control and must be recovered via Transit `decrypt` instead of
// creating a brand-new datakey. Runs in its own process (see package.json) because
// lib/rootKekProvider.ts's one-resolve-per-process guard would otherwise make a second scenario
// in the same process a no-op.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

type Row = Record<string, string | number | null>;
type Value = string | number | null;

const STORED_CIPHERTEXT = 'vault:v3:already-wrapped-root-kek';
const EXPECTED_PLAINTEXT = crypto.randomBytes(32);

class ControlMemoryDb {
  modified = 0;
  control: Row = { root_kek_provider: 'openbao', root_kek_wrapped: STORED_CIPHERTEXT, root_kek_updated_at: 1 };

  prepare(sql: string) {
    let rows: Row[] = [];
    let index = 0;
    return {
      bind: (params: Value[] = []) => { rows = this.select(sql, params); index = 0; },
      step: () => index < rows.length,
      getAsObject: () => rows[index++],
      free: () => {},
    };
  }

  select(sql: string, _params: Value[]): Row[] {
    const statement = sql.replace(/\s+/gu, ' ').trim();
    if (statement.startsWith('SELECT root_kek_wrapped FROM keyring_control')) {
      return [{ root_kek_wrapped: this.control.root_kek_wrapped }];
    }
    throw new Error(`Unsupported test SQL select: ${statement}`);
  }

  run(): void {
    throw new Error('No write is expected while recovering an already-wrapped root KEK');
  }

  exec() { return []; }
  getRowsModified() { return this.modified; }
  close() {}
}

const db = new ControlMemoryDb();
(globalThis as Record<string, unknown>).__assetPilotDb = db;

const fetchCalls: string[] = [];
(globalThis as { fetch?: typeof fetch }).fetch = (async (url: string, init?: RequestInit) => {
  const pathname = new URL(url).pathname;
  fetchCalls.push(pathname);
  if (pathname === '/v1/transit/decrypt/assetpilot-root-kek') {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.ciphertext, STORED_CIPHERTEXT);
    return new Response(JSON.stringify({ data: { plaintext: EXPECTED_PLAINTEXT.toString('base64') } }), { status: 200 }) as unknown as Response;
  }
  throw new Error(`Unexpected OpenBao call on recovery boot: ${pathname}`);
}) as typeof fetch;

process.env.KEYRING_ROOT_KEK_PROVIDER = 'openbao';
process.env.OPENBAO_ADDR = 'https://openbao.test:8200';
process.env.OPENBAO_TOKEN = 'test-token';
process.env.OPENBAO_TRANSIT_KEY = 'assetpilot-root-kek';
delete process.env.KEYRING_ROOT_KEK;

const { resolveRootKek } = await import('../../lib/rootKekProvider.ts');

test('recovers the exact stored plaintext via decrypt on a subsequent boot, never creating a new datakey', async () => {
  await resolveRootKek();
  assert.equal(process.env.KEYRING_ROOT_KEK, EXPECTED_PLAINTEXT.toString('base64'));
  assert.deepEqual(fetchCalls, ['/v1/transit/decrypt/assetpilot-root-kek']);
});
