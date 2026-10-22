import { NextResponse } from 'next/server';
import { requireAuth } from '../../../../lib/apiHelpers';
import { getDB, queryOne, saveDB } from '../../../../lib/db';
import { consumeAppleOAuthStateEntry } from '@/lib/appleOAuthState';
import { verifyAppleIdentityToken, appleEmail } from '@/lib/appleOAuth';

/**
 * 把 Apple 身分綁定到「目前已登入的帳號」。
 *
 * 安全設計：
 * - 必須先登入，且 state 必須是 link 流程簽發、並綁定同一個 userId 的
 *   單次使用憑證（防止他人把 Apple 身分轉接到本帳號）。
 * - 帳號識別以 Apple 的 `sub` 為準；Apple 已綁定其他帳號時直接拒絕。
 * - 不以 email 自動合併既有帳號（Apple 可能隱藏 email）。
 */
export async function POST(request: Request) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => ({}));
  const { identityToken, state, bindingToken: bodyBindingToken } = body;
  if (!identityToken)
    return NextResponse.json({ error: '缺少 Apple 身分憑證' }, { status: 400 });

  const stateEntry = consumeAppleOAuthStateEntry(state);
  if (
    !stateEntry ||
    stateEntry.flow !== 'link' ||
    !stateEntry.userId ||
    stateEntry.userId !== auth.userId
  ) {
    return NextResponse.json({ error: 'state_mismatch' }, { status: 400 });
  }

  const providedBindingToken = String(bodyBindingToken || '');
  if (
    !stateEntry.bindingToken ||
    providedBindingToken !== stateEntry.bindingToken
  ) {
    return NextResponse.json({ error: 'state_mismatch' }, { status: 400 });
  }

  const verified = await verifyAppleIdentityToken(identityToken, {
    expectedNonce: stateEntry.nonce,
  });
  if (!verified.ok)
    return NextResponse.json({ error: verified.error }, { status: 401 });

  const claims = verified.claims;
  const appleId = String(claims.sub);
  const email = appleEmail(claims);

  const existing = queryOne(
    'SELECT id FROM users WHERE apple_id = ? AND id != ?',
    [appleId, auth.userId],
  );
  if (existing)
    return NextResponse.json(
      { error: '此 Apple 帳號已被其他使用者綁定' },
      { status: 400 },
    );

  const me = queryOne('SELECT apple_id FROM users WHERE id = ?', [auth.userId]);
  if (!me) return NextResponse.json({ error: '使用者不存在' }, { status: 404 });

  getDB().run('UPDATE users SET apple_id = ? WHERE id = ?', [
    appleId,
    auth.userId,
  ]);
  saveDB();
  return NextResponse.json({ success: true, appleEmail: email, appleId });
}
