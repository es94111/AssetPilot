// tests/lib/authzEnforcement.test.ts — 後端權限驗證缺口回歸測試（安全稽核修正）。
//
// 涵蓋三項稽核修正中可純函式驗證的部分：
//  1. OAuth 自助註冊在部署初始化未完成時一律拒絕（first-user admin 接管防護）
//  2. App auth-ticket 必須綁定相符的 deviceNonce（工作階段置換防護）
//  3. 簽發工作階段的瀏覽器端點需通過信任來源檢查（登入 CSRF 防護）
//  4. 敏感操作 step-up 重新驗證的拒絕路徑（帳戶刪除等不可逆操作防護）
//
// 執行方式：node --experimental-transform-types --import ./tests/setup/register.mjs tests/lib/authzEnforcement.test.ts
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.JWT_SECRET ||= 'test-secret-authz-enforcement';

// ── 記憶體 DB stub：僅支援本檔觸及的查詢形狀（不可辨識的 SQL 回傳 null）──
type Row = Record<string, string | number | null | undefined>;
type RowsHandler = (sql: string, params: Array<string | number | null>) => Row | null;

let rowsHandler: RowsHandler = () => null;

(globalThis as Record<string, unknown>).__assetPilotDb = {
  prepare(sql: string) {
    let row: Row | null = null;
    let consumed = false;
    return {
      bind(params: Array<string | number | null> = []) {
        row = rowsHandler(sql, params);
      },
      step() {
        if (consumed || row === null) return false;
        consumed = true;
        return true;
      },
      getAsObject() {
        return row || {};
      },
      free() {},
    };
  },
  run() {},
  exec() {
    return [];
  },
  getRowsModified() {
    return 1;
  },
  close() {},
};

const loginHelpers = await import('../../lib/loginHelpers.ts');
const tickets = await import('../../lib/appAuthTicket.ts');
const originPolicy = await import('../../lib/originPolicy.ts');
const recovery = await import('../../lib/accountRecovery.ts');
const challenge = await import('../../lib/passkeyChallenge.ts');

// ── 1. OAuth 自助註冊 × 部署初始化狀態 ──

test('部署初始化未完成時，OAuth 自助註冊一律拒絕（不得藉 0 使用者取得首位 admin）', () => {
  rowsHandler = (sql) => {
    if (sql.includes('FROM system_bootstrap')) {
      return { token_hash: 'h', created_at: 1, expires_at: 2, consumed_at: 0, completed_at: 0 };
    }
    if (sql.includes('COUNT(1) AS count FROM users')) return { count: 0 };
    return null;
  };
  const result = loginHelpers.canOAuthRegister('attacker@example.com');
  assert.equal(result.ok, false);
  assert.match(String(result.error), /初始化/);
});

test('初始化已完成但無使用者（退化狀態）保留首位使用者救援路徑', () => {
  rowsHandler = (sql) => {
    if (sql.includes('FROM system_bootstrap')) {
      return { token_hash: '', created_at: 0, expires_at: 0, consumed_at: 0, completed_at: 123 };
    }
    if (sql.includes('COUNT(1) AS count FROM users')) return { count: 0 };
    return null;
  };
  assert.equal(loginHelpers.canOAuthRegister('user@example.com').ok, true);
});

test('初始化完成後，註冊仍受公開開關與允許清單管制', () => {
  rowsHandler = (sql) => {
    if (sql.includes('FROM system_bootstrap')) {
      return { token_hash: '', created_at: 0, expires_at: 0, consumed_at: 0, completed_at: 123 };
    }
    if (sql.includes('COUNT(1) AS count FROM users')) return { count: 5 };
    if (sql.includes('FROM system_settings')) return { public_registration: 0, allowed_registration_emails: '' };
    return null;
  };
  assert.equal(loginHelpers.canOAuthRegister('user@example.com').ok, false);
  rowsHandler = (sql) => {
    if (sql.includes('FROM system_bootstrap')) {
      return { token_hash: '', created_at: 0, expires_at: 0, consumed_at: 0, completed_at: 123 };
    }
    if (sql.includes('COUNT(1) AS count FROM users')) return { count: 5 };
    if (sql.includes('FROM system_settings')) return { public_registration: 1, allowed_registration_emails: '' };
    return null;
  };
  assert.equal(loginHelpers.canOAuthRegister('user@example.com').ok, true);
});

// ── 2. App auth-ticket 必須綁定 deviceNonce ──

test('auth-ticket 兌換必須提供相符的 deviceNonce，且僅能使用一次', () => {
  const ticket = tickets.issueAppAuthTicket('u1', 'nonce-1');
  // 錯誤 nonce、缺 nonce 一律拒絕（fail-closed）
  assert.equal(tickets.consumeAppAuthTicket(ticket, 'wrong'), null);
  const t2 = tickets.issueAppAuthTicket('u1', 'nonce-2');
  assert.equal(tickets.consumeAppAuthTicket(t2, undefined), null);
  const t3 = tickets.issueAppAuthTicket('u1', 'nonce-3');
  assert.equal(tickets.consumeAppAuthTicket(t3, ''), null);
  // 正確 nonce 可兌換、單一使用
  const t4 = tickets.issueAppAuthTicket('u1', 'nonce-4');
  assert.equal(tickets.consumeAppAuthTicket(t4, 'nonce-4'), 'u1');
  assert.equal(tickets.consumeAppAuthTicket(t4, 'nonce-4'), null);
  // 空字串 nonce 不得建立可兌換的憑證
  const t5 = tickets.issueAppAuthTicket('u1', '');
  assert.equal(tickets.consumeAppAuthTicket(t5, ''), null);
});

// ── 3. 瀏覽器端點的信任來源檢查 ──

test('isTrustedBrowserOrigin 只接受伺服器信任清單內的來源', () => {
  process.env.ALLOWED_ORIGINS = 'https://app.example';
  try {
    assert.equal(originPolicy.isTrustedBrowserOrigin(new Headers({ origin: 'https://evil.example' })), false);
    assert.equal(originPolicy.isTrustedBrowserOrigin(new Headers()), false);
    assert.equal(originPolicy.isTrustedBrowserOrigin(new Headers({ origin: 'null' })), false);
    assert.equal(originPolicy.isTrustedBrowserOrigin(new Headers({ origin: 'https://app.example' })), true);
  } finally {
    delete process.env.ALLOWED_ORIGINS;
  }
});

// ── 4. 敏感操作 step-up 重新驗證的拒絕路徑 ──

test('step-up：非近期登入且未附重新驗證資料一律拒絕', async () => {
  rowsHandler = () => null;
  const result = await recovery.verifyStepUpReauth('u1', '', {}, new Headers({ origin: 'https://app.example' }));
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.equal(result.reauthRequired, true);
});

test('step-up：無效／綁定不符／用途不符的 challenge 一律拒絕', async () => {
  rowsHandler = () => null;
  const headers = new Headers({ origin: 'https://app.example' });

  const expired = await recovery.verifyStepUpReauth(
    'u1',
    '',
    { authentication: { id: 'c1' }, challengeKey: 'not-a-real-key' },
    headers,
  );
  assert.equal(expired.ok, false);
  assert.equal(expired.status, 400);

  // 綁定其他使用者的 challenge 不得挪用
  const other = challenge.issuePasskeyChallenge('someone-else');
  const mismatched = await recovery.verifyStepUpReauth(
    'u1',
    '',
    { authentication: { id: 'c1' }, challengeKey: other.key },
    headers,
  );
  assert.equal(mismatched.ok, false);
  assert.equal(mismatched.status, 400);

  // 復原用途的 challenge 不得當作一般 step-up 使用
  const recoveryChallenge = challenge.issuePasskeyChallenge('u1', { purpose: recovery.RECOVERY_CHALLENGE_PURPOSE });
  const wrongPurpose = await recovery.verifyStepUpReauth(
    'u1',
    '',
    { authentication: { id: 'c1' }, challengeKey: recoveryChallenge.key },
    headers,
  );
  assert.equal(wrongPurpose.ok, false);
  assert.equal(wrongPurpose.status, 400);
});

test('step-up：查無 Passkey 憑證時拒絕（不得僅憑 challenge 通過）', async () => {
  rowsHandler = (sql) => {
    if (sql.includes('FROM passkey_credentials')) return null;
    return null;
  };
  const fresh = challenge.issuePasskeyChallenge('u1');
  const result = await recovery.verifyStepUpReauth(
    'u1',
    '',
    { authentication: { id: 'unknown-cred' }, challengeKey: fresh.key },
    new Headers({ origin: 'https://app.example' }),
  );
  assert.equal(result.ok, false);
  assert.equal(result.status, 403);
  assert.equal(result.reauthRequired, true);
});
