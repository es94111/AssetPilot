"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { client as webauthnClient } from "@passwordless-id/webauthn";
import { useT } from "@/components/i18n/I18nProvider";

export default function SetupPage() {
  const { t } = useT();
  const router = useRouter();
  const [state, setState] = useState<"loading" | "open" | "closed">("loading");
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/setup/status", { cache: "no-store" })
      .then((r) => r.json())
      .then((s) => setState(s?.required ? "open" : "closed"))
      .catch(() => setState("closed"));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!webauthnClient.isAvailable()) {
      setError(t("setup.unsupported"));
      return;
    }
    setBusy(true);
    try {
      const chRes = await fetch("/api/setup/passkey/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), email, displayName }),
      });
      if (!chRes.ok) {
        setError(
          chRes.status === 401
            ? t("setup.invalidToken")
            : chRes.status === 429
              ? t("setup.tooMany")
              : t("setup.failed"),
        );
        return;
      }
      const { key, challenge, user } = await chRes.json();
      const registration = await webauthnClient.register({
        challenge,
        user,
        userVerification: "required",
        discoverable: "preferred",
        timeout: 60000,
      });
      const res = await fetch("/api/setup/passkey/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: token.trim(),
          registration,
          challengeKey: key,
          email,
          displayName,
          deviceName: deviceName.trim(),
        }),
      });
      if (!res.ok) {
        setError(res.status === 401 ? t("setup.invalidToken") : t("setup.failed"));
        return;
      }
      setToken("");
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError(t("setup.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-bg">
      <div className="login-card">
        <h1 className="login-title">{t("setup.title")}</h1>
        {state === "loading" && <p className="login-subtitle">…</p>}
        {state === "closed" && (
          <>
            <p className="login-subtitle">{t("setup.closed")}</p>
            <Link href="/login" className="login-subtitle">
              {t("setup.backToLogin")}
            </Link>
          </>
        )}
        {state === "open" && (
          <form className="login-form" onSubmit={handleSubmit}>
            <p className="login-subtitle">{t("setup.subtitle")}</p>
            <input
              type="password"
              required
              autoComplete="off"
              spellCheck={false}
              placeholder={t("setup.token")}
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            <input
              type="email"
              required
              autoComplete="username"
              placeholder={t("setup.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="text"
              required
              maxLength={60}
              placeholder={t("setup.displayName")}
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
            <input
              type="text"
              maxLength={60}
              placeholder={t("setup.deviceName")}
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
            />
            <p className="login-subtitle">{t("setup.backupReminder")}</p>
            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="login-btn-google" disabled={busy}>
              {busy ? t("setup.submitting") : t("setup.submit")}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
