import { getDB, queryOne, saveDB } from "./db";

type LoginMethod = { provider: "google" | "apple" } | { provider: "passkey"; credentialId: string };
type RemovalResult = "removed" | "missing" | "last_method";

export function removeAccountLoginMethod(userId: string, method: LoginMethod): RemovalResult {
  const db = getDB();
  db.run("BEGIN");
  let result: RemovalResult;
  try {
    const user = queryOne("SELECT google_id, apple_id FROM users WHERE id = ? FOR UPDATE", [userId]);
    result = user ? removeLockedMethod(userId, method, user) : "missing";
    db.run("COMMIT");
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
  if (result === "removed") saveDB();
  return result;
}

function removeLockedMethod(
  userId: string,
  method: LoginMethod,
  user: Record<string, string | number | null>,
): RemovalResult {
  const params = [userId];
  const passkeys = Number(queryOne("SELECT COUNT(*) AS count FROM passkey_credentials WHERE user_id = ?", params)?.count || 0);
  const google = Boolean(user.google_id);
  const apple = Boolean(user.apple_id);
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  const appleEnabled = Boolean(process.env.APPLE_CLIENT_ID);
  const remaining = Number(google && googleEnabled && method.provider !== "google")
    + Number(apple && appleEnabled && method.provider !== "apple")
    + passkeys - Number(method.provider === "passkey");

  if (method.provider === "passkey") {
    const credential = [method.credentialId, userId];
    if (!queryOne("SELECT credential_id FROM passkey_credentials WHERE credential_id = ? AND user_id = ?", credential)) {
      return "missing";
    }
    if (remaining === 0) return "last_method";
    getDB().run("DELETE FROM passkey_credentials WHERE credential_id = ? AND user_id = ?", credential);
  } else {
    if (method.provider === "google" ? !google : !apple) return "missing";
    if (remaining === 0) return "last_method";
    const column = method.provider === "google" ? "google_id" : "apple_id";
    getDB().run(`UPDATE users SET ${column} = '' WHERE id = ?`, params);
  }
  return "removed";
}

export const LAST_LOGIN_METHOD_ERROR = "至少保留一種有效的 Google、Apple 或 Passkey 登入方式";
