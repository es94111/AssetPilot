import assert from 'node:assert/strict';
import test from 'node:test';
import net from 'node:net';
import { createRequire } from 'node:module';

const hasDatabase = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);

test('shared ledgers: real authenticated routes, invitations and ownership boundaries', { skip: !hasDatabase }, async (t) => {
  // Capture invitation emails locally; never contact a real mail provider.
  const messages: string[] = [];
  const sockets = new Set<net.Socket>();
  const smtp = net.createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.write('220 localhost SMTP\r\n');
    let buffer = '';
    let content = '';
    let inData = false;
    socket.on('data', (chunk) => {
      buffer += chunk.toString();
      let index: number;
      while ((index = buffer.indexOf('\r\n')) >= 0) {
        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        if (inData) {
          if (line === '.') {
            messages.push(content);
            inData = false;
            content = '';
            socket.write('250 Message received\r\n');
          } else content += `${line}\n`;
        } else if (line.startsWith('EHLO') || line.startsWith('HELO')) {
          socket.write('250 localhost\r\n');
        } else if (line === 'DATA') {
          inData = true;
          socket.write('354 End with dot\r\n');
        } else if (line === 'QUIT') socket.end('221 Bye\r\n');
        else socket.write('250 OK\r\n');
      }
    });
  });
  await new Promise<void>((resolve) => smtp.listen(0, '127.0.0.1', resolve));
  t.after(() => {
    for (const socket of sockets) socket.destroy();
    smtp.close();
  });
  const port = (smtp.address() as net.AddressInfo).port;
  const envKeys = ['EMAIL_PROVIDER_PRIMARY', 'EMAIL_PROVIDER_FALLBACK', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_FROM', 'APP_URL', 'STOCK_AUTO_UPDATE_ENABLED'];
  const originalEnv = envKeys.map((key) => [key, process.env[key]] as const);
  Object.assign(process.env, {
    EMAIL_PROVIDER_PRIMARY: 'smtp', EMAIL_PROVIDER_FALLBACK: '', SMTP_HOST: '127.0.0.1', SMTP_PORT: String(port),
    SMTP_SECURE: 'false', SMTP_USER: '', SMTP_FROM: 'test@example.com', APP_URL: 'http://localhost', STOCK_AUTO_UPDATE_ENABLED: 'false',
  });
  const originalRequire = Object.getOwnPropertyDescriptor(globalThis, 'require');
  Object.defineProperty(globalThis, 'require', { value: createRequire(import.meta.url), configurable: true });

  const { initDB, getDB, queryOne } = await import('../../lib/db.ts');
  const { uid } = await import('../../lib/userDefaults.ts');
  const { createLoginSession } = await import('../../lib/sessionHelpers.ts');
  const { requireAuth } = await import('../../lib/apiHelpers.ts');
  const { todayInUserTz } = await import('../../lib/userTime.ts');
  const { NextRequest } = await import('next/server');
  const ledgers = await import('../../app/api/ledgers/route.ts');
  const members = await import('../../app/api/ledgers/[ledgerId]/members/route.ts');
  const invitations = await import('../../app/api/ledgers/[ledgerId]/invitations/route.ts');
  const accept = await import('../../app/api/ledgers/invitations/accept/route.ts');
  const transfer = await import('../../app/api/ledgers/[ledgerId]/transfer/route.ts');
  const leave = await import('../../app/api/ledgers/[ledgerId]/leave/route.ts');
  const audit = await import('../../app/api/ledgers/[ledgerId]/audit/route.ts');
  const tx = await import('../../app/api/transactions/route.ts');
  const txItem = await import('../../app/api/transactions/[txId]/route.ts');
  const accounts = await import('../../app/api/accounts/route.ts');
  const categories = await import('../../app/api/categories/route.ts');
  const budgets = await import('../../app/api/budgets/route.ts');
  const recurring = await import('../../app/api/recurring/route.ts');
  const exports = await import('../../app/api/transactions/export/route.ts');
  const reports = await import('../../app/api/reports/route.ts');
  const calendar = await import('../../app/api/calendar/route.ts');
  const { deleteUserCompletely, LedgerOwnershipTransferRequiredError } = await import('../../lib/userDeletion.ts');
  await initDB();
  const db = getDB();
  const owner = uid(), editor = uid(), viewer = uid(), outsider = uid();
  const people = [owner, editor, viewer, outsider];
  const tokens = new Map<string, string>();
  let ledgerId = '', dataOwner = '', transactionId = '';
  const privateTx = uid();
  const ctx = () => ({ params: Promise.resolve({ ledgerId }) });
  const request = (userId: string, path: string, method = 'GET', body?: unknown, ledger = ledgerId) => new NextRequest(`http://localhost${path}`, {
    method,
    headers: { Cookie: `authToken=${tokens.get(userId)}`, Origin: 'http://localhost', 'Content-Type': 'application/json', ...(ledger ? { 'x-ledger-id': ledger } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const invite = async (person: string, role: 'editor' | 'viewer') => {
    const res = await members.POST(request(owner, `/api/ledgers/${ledgerId}/members`, 'POST', { email: `${person}@example.com`, role }), ctx());
    assert.equal(res.status, 201, await res.text());
    const token = messages.at(-1)?.replace(/=\n/g, '').replace(/=3D/gi, '=').match(/invite=([a-f0-9]{64})/)?.[1];
    assert.ok(token, 'SMTP email must contain an invitation link');
    return token;
  };

  try {
    for (const person of people) {
      db.run('INSERT INTO users (id,email,password_hash,display_name,created_at) VALUES (?,?,?,?,?)', [person, `${person}@example.com`, 'disabled', person, new Date().toISOString()]);
      tokens.set(person, createLoginSession(person, 0, {}).token);
    }
    db.run('INSERT INTO transactions (id,user_id,type,amount,date,note) VALUES (?,?,?,?,?,?)', [privateTx, owner, 'expense', 77, '2026-10-01', 'private']);

    await t.test('new shared ledger starts empty and existing personal data remains private', async () => {
      const personal = await ledgers.GET(request(owner, '/api/ledgers', 'GET', undefined, ''));
      assert.equal((await personal.json()).length, 1);
      const created = await ledgers.POST(request(owner, '/api/ledgers', 'POST', { name: 'Family ledger' }, ''));
      assert.equal(created.status, 201);
      ledgerId = (await created.json()).id;
      dataOwner = String(queryOne('SELECT data_owner_id FROM financial_ledgers WHERE id = ?', [ledgerId])?.data_owner_id);
      assert.notEqual(dataOwner, owner);
      const shared = await tx.GET(request(owner, '/api/transactions'));
      assert.equal((await shared.json()).total, 0);
      const personalRes = await tx.GET(request(owner, '/api/transactions', 'GET', undefined, ''));
      assert.equal((await personalRes.json()).total, 1);
      const forged = await tx.GET(request(outsider, '/api/transactions'));
      assert.equal(forged.status, 404);
    });

    await t.test('email invitations are hashed, bound to recipient, one-time, and revocable', async () => {
      const token = await invite(editor, 'editor');
      assert.notEqual(queryOne('SELECT token_hash FROM ledger_invitations WHERE ledger_id = ?', [ledgerId])?.token_hash, token);
      assert.equal((await accept.POST(request(outsider, '/api/ledgers/invitations/accept', 'POST', { token }))).status, 403);
      assert.equal((await accept.POST(request(editor, '/api/ledgers/invitations/accept', 'POST', { token }))).status, 200);
      assert.equal((await accept.POST(request(editor, '/api/ledgers/invitations/accept', 'POST', { token }))).status, 404);
      const revoked = await invite(viewer, 'viewer');
      const pending = await invitations.GET(request(owner, `/api/ledgers/${ledgerId}/invitations`), ctx());
      const [{ id }] = await pending.json();
      assert.equal((await invitations.DELETE(request(owner, `/api/ledgers/${ledgerId}/invitations`, 'DELETE', { invitationId: id }), ctx())).status, 200);
      assert.equal((await accept.POST(request(viewer, '/api/ledgers/invitations/accept', 'POST', { token: revoked }))).status, 404);
      const expired = await invite(viewer, 'viewer');
      db.run('UPDATE ledger_invitations SET expires_at = 1 WHERE ledger_id = ? AND accepted_at = 0 AND revoked_at = 0', [ledgerId]);
      assert.equal((await accept.POST(request(viewer, '/api/ledgers/invitations/accept', 'POST', { token: expired }))).status, 404);
      const viewerToken = await invite(viewer, 'viewer');
      assert.equal((await accept.POST(request(viewer, '/api/ledgers/invitations/accept', 'POST', { token: viewerToken }))).status, 200);
      process.env.APP_URL = 'file:///untrusted';
      try {
        const failed = await members.POST(request(owner, `/api/ledgers/${ledgerId}/members`, 'POST', { email: `${outsider}@example.com`, role: 'viewer' }), ctx());
        assert.equal(failed.status, 503);
        assert.ok(Number(queryOne('SELECT revoked_at FROM ledger_invitations WHERE ledger_id = ? AND email = ?', [ledgerId, `${outsider}@example.com`])?.revoked_at) > 0);
      } finally {
        process.env.APP_URL = 'http://localhost';
      }
    });

    await t.test('editor creates shared records; cross-ledger references and resource IDs fail closed', async () => {
      const categoryRes = await categories.POST(request(editor, '/api/categories', 'POST', { name: 'Food', type: 'expense', color: '#ff0000' }));
      assert.equal(categoryRes.status, 200);
      const parentId = (await categoryRes.json()).id;
      const childRes = await categories.POST(request(editor, '/api/categories', 'POST', { name: 'Lunch', type: 'expense', color: '#ff0000', parentId }));
      assert.equal(childRes.status, 200);
      const categoryId = (await childRes.json()).id;
      const accountRes = await accounts.POST(request(editor, '/api/accounts', 'POST', { name: 'Shared cash', category: 'cash', currency: 'TWD', initialBalance: 0 }));
      assert.equal(accountRes.status, 201);
      const accountId = (await accountRes.json()).id;
      const created = await tx.POST(request(editor, '/api/transactions', 'POST', { type: 'expense', amount: 125, date: '2026-10-01', categoryId, accountId, note: 'Shared expense' }));
      assert.equal(created.status, 201, await created.clone().text());
      transactionId = (await created.json()).id;
      assert.equal(queryOne('SELECT user_id FROM transactions WHERE id = ?', [transactionId])?.user_id, dataOwner);
      const privateRead = await txItem.GET(request(editor, `/api/transactions/${privateTx}`), { params: Promise.resolve({ txId: privateTx }) });
      assert.equal(privateRead.status, 404);
      const personalCategory = uid();
      db.run('INSERT INTO categories (id,user_id,name,type) VALUES (?,?,?,?)', [personalCategory, owner, 'Private', 'expense']);
      assert.equal((await tx.POST(request(editor, '/api/transactions', 'POST', { type: 'expense', amount: 5, date: '2026-10-01', categoryId: personalCategory }))).status, 400);
      const log = queryOne("SELECT actor_user_id, actor_email, result FROM ledger_audit_log WHERE ledger_id = ? AND action = 'POST /api/transactions' AND result = 'success'", [ledgerId]);
      assert.equal(log?.actor_user_id, editor);
      assert.equal(log?.actor_email, `${editor}@example.com`);
    });

    await t.test('viewer can read all bookkeeping APIs but every write method is forbidden', async () => {
      for (const [path, route] of [['/api/accounts', accounts], ['/api/categories', categories], ['/api/budgets', budgets], ['/api/recurring', recurring], ['/api/transactions', tx]] as const) {
        assert.equal((await route.GET(request(viewer, path))).status, 200, path);
        assert.equal((await route.POST(request(viewer, path, 'POST', {}))).status, 403, path);
      }
      for (const method of ['PUT', 'PATCH', 'DELETE'] as const) {
        assert.equal((await txItem[method](request(viewer, `/api/transactions/${transactionId}`, method, {}), { params: Promise.resolve({ txId: transactionId }) })).status, 403);
      }
      assert.equal((await exports.GET(request(viewer, '/api/transactions/export'))).status, 200);
      assert.equal((await reports.GET(request(viewer, '/api/reports?from=2026-10-01&to=2026-10-31'))).status, 200);
      assert.equal((await calendar.GET(request(viewer, '/api/calendar?date=2026-10-01'))).status, 200);
      assert.equal((await members.PATCH(request(editor, `/api/ledgers/${ledgerId}/members`, 'PATCH', { userId: viewer, role: 'editor' }), ctx())).status, 403);
      assert.equal((await audit.GET(request(viewer, `/api/ledgers/${ledgerId}/audit`), ctx())).status, 403);
      assert.equal((await tx.GET(request(viewer, `/api/transactions?ledgerId=${ledgerId}`, 'GET', undefined, `personal:${viewer}`))).status, 400);
    });

    await t.test('private settings and investment identity stay personal; viewers do not generate shared recurring writes', async () => {
      for (const path of ['/api/stocks', '/api/user/settings/default-currency', '/api/user/api-tokens']) {
        const auth = await requireAuth(request(viewer, path));
        assert.ok(!(auth instanceof Response));
        assert.equal(auth.userId, viewer);
      }
      const recurringId = uid();
      db.run('INSERT INTO recurring (id,user_id,type,amount,frequency,start_date,note,updated_at) VALUES (?,?,?,?,?,?,?,?)',
        [recurringId, dataOwner, 'expense', 10, 'monthly', todayInUserTz('Asia/Taipei'), 'Shared recurring fixture', Date.now()]);
      assert.equal((await recurring.GET(request(viewer, '/api/recurring'))).status, 200);
      assert.equal(queryOne('SELECT id FROM transactions WHERE source_recurring_id = ?', [recurringId]), null);
      assert.equal((await recurring.GET(request(editor, '/api/recurring'))).status, 200);
      assert.ok(queryOne('SELECT id FROM transactions WHERE source_recurring_id = ? AND user_id = ?', [recurringId, dataOwner]));
      db.run('UPDATE users SET is_active = 0 WHERE id = ?', [viewer]);
      assert.equal((await tx.GET(request(viewer, '/api/transactions'))).status, 401);
      db.run('UPDATE users SET is_active = 1 WHERE id = ?', [viewer]);
    });

    await t.test('role changes, removal and leave immediately revoke access without moving data', async () => {
      assert.equal((await members.PATCH(request(owner, `/api/ledgers/${ledgerId}/members`, 'PATCH', { userId: viewer, role: 'editor' }), ctx())).status, 200);
      assert.equal((await members.DELETE(request(owner, `/api/ledgers/${ledgerId}/members`, 'DELETE', { userId: viewer }), ctx())).status, 200);
      assert.equal((await tx.GET(request(viewer, '/api/transactions'))).status, 404);
      assert.equal(queryOne('SELECT user_id FROM transactions WHERE id = ?', [transactionId])?.user_id, dataOwner);
      assert.equal((await leave.POST(request(editor, `/api/ledgers/${ledgerId}/leave`, 'POST'), ctx())).status, 200);
      assert.equal((await tx.GET(request(editor, '/api/transactions'))).status, 404);
      const token = await invite(editor, 'editor');
      assert.equal((await accept.POST(request(editor, '/api/ledgers/invitations/accept', 'POST', { token }))).status, 200);
    });

    await t.test('owner must transfer before leaving/deleting; deletion of a former owner preserves ledger data', async () => {
      assert.equal((await leave.POST(request(owner, `/api/ledgers/${ledgerId}/leave`, 'POST'), ctx())).status, 409);
      await assert.rejects(deleteUserCompletely(owner), LedgerOwnershipTransferRequiredError);
      assert.throws(() => db.run('DELETE FROM users WHERE id = ?', [owner]), /LEDGER_OWNERSHIP_TRANSFER_REQUIRED/);
      assert.equal((await transfer.POST(request(owner, `/api/ledgers/${ledgerId}/transfer`, 'POST', { userId: editor }), ctx())).status, 200);
      assert.equal(queryOne('SELECT owner_user_id FROM financial_ledgers WHERE id = ?', [ledgerId])?.owner_user_id, editor);
      assert.equal(queryOne('SELECT role FROM ledger_members WHERE ledger_id = ? AND user_id = ?', [ledgerId, owner])?.role, 'editor');
      await deleteUserCompletely(owner);
      assert.equal(queryOne('SELECT user_id FROM transactions WHERE id = ?', [transactionId])?.user_id, dataOwner);
      assert.equal(queryOne('SELECT id FROM transactions WHERE id = ?', [privateTx]), null);
      assert.equal((await tx.GET(request(editor, '/api/transactions'))).status, 200);
    });
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 100));
    for (const table of ['transactions', 'accounts', 'categories', 'budgets', 'recurring', 'deleted_defaults', 'credit_card_repayment_summaries', 'transaction_attachments', 'user_photo_keys']) {
      for (const id of [dataOwner, ...people]) db.run(`DELETE FROM ${table} WHERE user_id = ?`, [id]);
    }
    db.run('DELETE FROM financial_ledgers WHERE id = ?', [ledgerId]);
    for (const person of people) {
      db.run('DELETE FROM data_operation_audit_log WHERE user_id = ?', [person]);
      db.run('DELETE FROM login_sessions WHERE user_id = ?', [person]);
      db.run('DELETE FROM users WHERE id = ?', [person]);
    }
    db.close();
    for (const socket of sockets) socket.destroy();
    await new Promise<void>((resolve) => smtp.close(() => resolve()));
    for (const [key, value] of originalEnv) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
    if (originalRequire) Object.defineProperty(globalThis, 'require', originalRequire);
    else Reflect.deleteProperty(globalThis, 'require');
  }
});
