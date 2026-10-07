import assert from "node:assert/strict";
import test from "node:test";
import { canManageLedger, canWriteLedger, resolveLedgerAccess, isLedgerDataPath, ledgerFileUrl } from "../../lib/ledgerPolicy.ts";
import { safeOAuthReturnTo } from "../../lib/loginReturn.ts";

test("owners and editors can write while viewers stay read-only", () => {
  assert.equal(canWriteLedger("owner"), true);
  assert.equal(canWriteLedger("editor"), true);
  assert.equal(canWriteLedger("viewer"), false);
  assert.equal(canManageLedger("owner"), true);
  assert.equal(canManageLedger("editor"), false);
});

test("ledger access fails closed when the membership lookup finds no member", () => {
  assert.deepEqual(
    resolveLedgerAccess({ role: "owner", method: "GET", memberFound: false }),
    { allowed: false, reason: "not-a-member" },
  );
  assert.deepEqual(
    resolveLedgerAccess({ role: "unexpected", method: "GET", memberFound: true }),
    { allowed: false, reason: "not-a-member" },
  );
});

test("viewers can read but cannot mutate through any unsafe HTTP method", () => {
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    assert.deepEqual(
      resolveLedgerAccess({ role: "viewer", method, memberFound: true }),
      { allowed: true, role: "viewer" },
    );
  }
  for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
    assert.deepEqual(
      resolveLedgerAccess({ role: "viewer", method, memberFound: true }),
      { allowed: false, reason: "read-only" },
    );
  }
});

test("bookkeeping and investment APIs use the selected ledger context", () => {
  assert.equal(isLedgerDataPath('/api/transactions/tx-1'), true);
  assert.equal(isLedgerDataPath('/api/accounts'), true);
  assert.equal(isLedgerDataPath('/api/imports/progress'), true);
  for (const path of ['/api/stocks', '/api/stock-transactions', '/api/stock-dividends', '/api/stock-recurring', '/api/stock-realized', '/api/stock-realized-pl', '/api/stock-settings', '/api/exchange-rates', '/api/exchange-rates/USD']) {
    assert.equal(isLedgerDataPath(path), true, path);
  }
  assert.equal(isLedgerDataPath('/api/exchange-rates/settings'), true);
  assert.equal(isLedgerDataPath('/api/reconciliation'), true);
  assert.equal(isLedgerDataPath('/api/reconciliation/import'), true);
  assert.equal(isLedgerDataPath('/api/reconciliation/sessions/abc'), true);
  assert.equal(isLedgerDataPath('/api/ledgers'), false);
  assert.equal(isLedgerDataPath('/api/user/settings/default-currency'), false);
  assert.equal(isLedgerDataPath('/api/transactions-other'), false);
  assert.equal(isLedgerDataPath('/api/reconciliation-other'), false);
});

test('invitation login redirects and file links retain ledger context without allowing external redirects', () => {
  assert.equal(safeOAuthReturnTo('/settings/ledgers?invite=abc'), '/settings/ledgers?invite=abc');
  assert.equal(safeOAuthReturnTo('//evil.test/settings/ledgers'), '');
  assert.equal(safeOAuthReturnTo('https://evil.test/settings/ledgers'), '');
  assert.equal(safeOAuthReturnTo('/settings/ledgers/extra'), '');
  assert.equal(ledgerFileUrl('/api/transactions/a/attachments/b/file', 'shared'), '/api/transactions/a/attachments/b/file?ledgerId=shared');
});

test("owner and editor mutations are authorized", () => {
  for (const role of ["owner", "editor"]) {
    assert.deepEqual(
      resolveLedgerAccess({ role, method: "PATCH", memberFound: true }),
      { allowed: true, role },
    );
  }
});
