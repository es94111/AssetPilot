// Dedicated process: exercises resolveRootKek()'s race-safety path. Two replicas can both find
// an empty keyring_control.root_kek_wrapped and both call the OpenBao datakey endpoint; only one
// compare-and-set UPDATE may win. The loser must discard its own freshly-created datakey and
// recover the WINNER's wrapped value instead, so every replica ends up unwrapping purpose keys
// with the same root KEK. Runs in its own process for the same reason as the decrypt-recovery
// test (see package.json).
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

type Row = Record<string, string | number | null>;
type Value = string | number | null;

const WINNER_CIPHERTEXT = 'vault:v1:winning-replica-ciphertext';
const WINNER_PLAINTEXT = crypto.randomBytes(32);
const LOSER_CIPHERTEXT = 'vault:v1:this-replicas-own-ciphertext';
const LOSER_PLAINTEXT = crypto.randomBytes(32);

class RacingControlMemoryDb {
  modified = 0;
  // Starts empty, as both replicas observe before either writes.
  wrapped = '';

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
      return [{ root_kek_wrapped: this.wrapped }];
    }
    throw new Error(`Unsupported test SQL select: ${statement}`);
  }

  run(sql: string, params: Value[] = []): void {
    const statement = sql.replace(/\s+/gu, ' ').trim();
    this.modified = 0;
    if (statement.startsWith("UPDATE keyring_control SET root_kek_provider = 'openbao'")) {
      // Simulate another replica's UPDATE having already committed between this process's SELECT
      // and its own UPDATE: the CAS guard (root_kek_wrapped = '') no longer matches, so this
      // UPDATE affects zero rows — exactly like Postgres would report for a lost race — and the
      // row now holds the WINNER's ciphertext rather than this process's own `params`.
      assert.equal(String(params[0]), LOSER_CIPHERTEXT, 'test setup: this replica should attempt to write its own datakey first');
      this.wrapped = WINNER_CIPHERTEXT;
      this.modified = 0;
      return;
    }
    throw new Error(`Unsupported test SQL run: ${statement}`);
  }

  exec() { return []; }
  getRowsModified() { return this.modified; }
  close() {}
}

const db = new RacingControlMemoryDb();
(globalThis as Record<string, unknown>).__assetPilotDb = db;

const fetchCalls: string[] = [];
(globalThis as { fetch?: typeof fetch }).fetch = (async (url: string, init?: RequestInit) => {
  const pathname = new URL(url).pathname;
  fetchCalls.push(pathname);
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  if (pathname === '/v1/transit/datakey/plaintext/assetpilot-root-kek') {
    return new Response(JSON.stringify({
      data: { plaintext: LOSER_PLAINTEXT.toString('base64'), ciphertext: LOSER_CIPHERTEXT },
    }), { status: 200 }) as unknown as Response;
  }
  if (pathname === '/v1/transit/decrypt/assetpilot-root-kek') {
    assert.equal(body.ciphertext, WINNER_CIPHERTEXT, 'must decrypt the WINNER ciphertext, not its own');
    return new Response(JSON.stringify({ data: { plaintext: WINNER_PLAINTEXT.toString('base64') } }), { status: 200 }) as unknown as Response;
  }
  throw new Error(`Unexpected OpenBao call: ${pathname}`);
}) as typeof fetch;

process.env.KEYRING_ROOT_KEK_PROVIDER = 'openbao';
process.env.OPENBAO_ADDR = 'https://openbao.test:8200';
process.env.OPENBAO_TOKEN = 'test-token';
process.env.OPENBAO_TRANSIT_KEY = 'assetpilot-root-kek';
delete process.env.KEYRING_ROOT_KEK;

const { resolveRootKek } = await import('../../lib/rootKekProvider.ts');

test('falls back to the winning replica\'s wrapped value when this process loses the create-datakey race', async () => {
  await resolveRootKek();
  assert.equal(process.env.KEYRING_ROOT_KEK, WINNER_PLAINTEXT.toString('base64'));
  assert.notEqual(process.env.KEYRING_ROOT_KEK, LOSER_PLAINTEXT.toString('base64'));
  assert.deepEqual(fetchCalls, [
    '/v1/transit/datakey/plaintext/assetpilot-root-kek',
    '/v1/transit/decrypt/assetpilot-root-kek',
  ]);
});
