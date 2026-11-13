import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

type Row = Record<string, string | number | null>;
type Value = string | number | null;

class ControlMemoryDb {
  modified = 0;
  control: Row = { root_kek_provider: 'env', root_kek_wrapped: '', root_kek_updated_at: 0 };

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
    if (statement.startsWith('SELECT root_kek_wrapped, root_kek_updated_at FROM keyring_control')) {
      return [{ root_kek_wrapped: this.control.root_kek_wrapped, root_kek_updated_at: this.control.root_kek_updated_at }];
    }
    throw new Error(`Unsupported test SQL select: ${statement}`);
  }

  run(sql: string, params: Value[] = []): void {
    const statement = sql.replace(/\s+/gu, ' ').trim();
    this.modified = 0;
    if (statement.startsWith("UPDATE keyring_control SET root_kek_provider = 'openbao'")) {
      if (this.control.root_kek_wrapped === '') {
        this.control.root_kek_provider = 'openbao';
        this.control.root_kek_wrapped = String(params[0]);
        this.control.root_kek_updated_at = Number(params[1]);
        this.modified = 1;
      }
      return;
    }
    if (statement.startsWith('UPDATE keyring_control SET root_kek_wrapped = ?')) {
      const [next, updatedAt, expected] = params.map(String);
      if (this.control.root_kek_wrapped === expected) {
        this.control.root_kek_wrapped = next;
        this.control.root_kek_updated_at = Number(updatedAt);
        this.modified = 1;
      }
      return;
    }
    throw new Error(`Unsupported test SQL run: ${statement}`);
  }

  exec() { return []; }
  getRowsModified() { return this.modified; }
  close() {}
}

const db = new ControlMemoryDb();
(globalThis as Record<string, unknown>).__assetPilotDb = db;

interface FetchCall { method: string; url: string; body: unknown }
const fetchCalls: FetchCall[] = [];
type RouteHandler = (body: unknown) => { status: number; json: unknown };
let routes: Record<string, RouteHandler> = {};

function installFetchMock(nextRoutes: Record<string, RouteHandler>): void {
  routes = nextRoutes;
  (globalThis as { fetch?: typeof fetch }).fetch = (async (url: string, init?: RequestInit) => {
    const method = init?.method || 'GET';
    const pathname = new URL(url).pathname;
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    fetchCalls.push({ method, url, body });
    const handler = routes[`${method} ${pathname}`];
    if (!handler) throw new Error(`Unexpected OpenBao call: ${method} ${pathname}`);
    const { status, json } = handler(body);
    return new Response(JSON.stringify(json), { status }) as unknown as Response;
  }) as typeof fetch;
}

function b64(buf: Buffer): string {
  return buf.toString('base64');
}

const {
  rootKekProviderId,
  resolveRootKek,
  rewrapStoredRootKek,
  getRootKekProviderStatus,
  testOpenBaoConnection,
  RootKekProviderError,
} = await import('../../lib/rootKekProvider.ts');

test('defaults to the env provider and never calls OpenBao', async () => {
  delete process.env.KEYRING_ROOT_KEK_PROVIDER;
  delete process.env.KEYRING_ROOT_KEK;
  assert.equal(rootKekProviderId(), 'env');
  fetchCalls.length = 0;
  await resolveRootKek();
  assert.equal(fetchCalls.length, 0);
  assert.equal(process.env.KEYRING_ROOT_KEK, undefined);
});

test('rejects when OpenBao address or token is missing, without setting KEYRING_ROOT_KEK', async () => {
  process.env.KEYRING_ROOT_KEK_PROVIDER = 'openbao';
  delete process.env.OPENBAO_ADDR;
  delete process.env.OPENBAO_TOKEN;
  await assert.rejects(resolveRootKek(), (error: unknown) =>
    error instanceof RootKekProviderError && /OPENBAO_ADDR/.test(error.message));
  assert.equal(process.env.KEYRING_ROOT_KEK, undefined);
});

test('rejects a datakey response whose plaintext is not exactly 32 bytes, without persisting it', async () => {
  process.env.OPENBAO_ADDR = 'https://openbao.test:8200';
  process.env.OPENBAO_TOKEN = 'test-token';
  process.env.OPENBAO_TRANSIT_KEY = 'assetpilot-root-kek';
  installFetchMock({
    'POST /v1/transit/datakey/plaintext/assetpilot-root-kek': () => ({
      status: 200,
      json: { data: { plaintext: b64(crypto.randomBytes(16)), ciphertext: 'vault:v1:short' } },
    }),
  });
  await assert.rejects(resolveRootKek(), (error: unknown) =>
    error instanceof RootKekProviderError && /32 bytes/.test(error.message));
  assert.equal(process.env.KEYRING_ROOT_KEK, undefined);
  assert.equal(db.control.root_kek_wrapped, '', 'a rejected datakey must never be persisted');
});

let createdPlaintext: Buffer;
test('creates a datakey on first boot, persists only the OpenBao ciphertext, and sets KEYRING_ROOT_KEK', async () => {
  createdPlaintext = crypto.randomBytes(32);
  const ciphertext = 'vault:v1:created-ciphertext';
  fetchCalls.length = 0;
  installFetchMock({
    'POST /v1/transit/datakey/plaintext/assetpilot-root-kek': (body) => {
      assert.deepEqual(body, { bits: 256 });
      return { status: 200, json: { data: { plaintext: b64(createdPlaintext), ciphertext } } };
    },
  });
  await resolveRootKek();
  assert.equal(process.env.KEYRING_ROOT_KEK, b64(createdPlaintext));
  assert.equal(db.control.root_kek_wrapped, ciphertext);
  assert.equal(db.control.root_kek_provider, 'openbao');
  assert.equal(fetchCalls.length, 1);
});

test('is idempotent within the same process: a second call makes no network request', async () => {
  const callsBefore = fetchCalls.length;
  await resolveRootKek();
  assert.equal(fetchCalls.length, callsBefore);
  assert.equal(process.env.KEYRING_ROOT_KEK, b64(createdPlaintext));
});

test('rewrapStoredRootKek refuses to run under the env provider', async () => {
  process.env.KEYRING_ROOT_KEK_PROVIDER = 'env';
  await assert.rejects(rewrapStoredRootKek(), (error: unknown) =>
    error instanceof RootKekProviderError && /openbao/.test(error.message));
  process.env.KEYRING_ROOT_KEK_PROVIDER = 'openbao';
});

test('rewrapStoredRootKek upgrades the stored ciphertext to the latest Transit key version', async () => {
  const upgraded = 'vault:v2:upgraded-ciphertext';
  installFetchMock({
    'POST /v1/transit/rewrap/assetpilot-root-kek': (body) => {
      assert.deepEqual(body, { ciphertext: db.control.root_kek_wrapped });
      return { status: 200, json: { data: { ciphertext: upgraded } } };
    },
  });
  const result = await rewrapStoredRootKek();
  assert.equal(result.rewrapped, true);
  assert.equal(db.control.root_kek_wrapped, upgraded);
  // The plaintext root KEK already resolved into this process must be completely unaffected.
  assert.equal(process.env.KEYRING_ROOT_KEK, b64(createdPlaintext));
});

test('rewrapStoredRootKek reports no-op when OpenBao already returns the same ciphertext', async () => {
  const current = db.control.root_kek_wrapped;
  installFetchMock({
    'POST /v1/transit/rewrap/assetpilot-root-kek': () => ({ status: 200, json: { data: { ciphertext: current } } }),
  });
  const result = await rewrapStoredRootKek();
  assert.equal(result.rewrapped, false);
  assert.equal(db.control.root_kek_wrapped, current);
});

test('getRootKekProviderStatus and testOpenBaoConnection reflect configuration without mutating anything', async () => {
  installFetchMock({
    'GET /v1/sys/health': () => ({ status: 200, json: {} }),
  });
  const status = await getRootKekProviderStatus();
  assert.equal(status.provider, 'openbao');
  assert.equal(status.configured, true);
  assert.equal(status.wrapped, true);
  await testOpenBaoConnection();
});

test('surfaces a non-2xx OpenBao response as a fail-closed RootKekProviderError', async () => {
  installFetchMock({
    'POST /v1/transit/rewrap/assetpilot-root-kek': () => ({
      status: 403,
      json: { errors: ['permission denied'] },
    }),
  });
  await assert.rejects(rewrapStoredRootKek(), (error: unknown) =>
    error instanceof RootKekProviderError && /403/.test(error.message) && /permission denied/.test(error.message));
});
