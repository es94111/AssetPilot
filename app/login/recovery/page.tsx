"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { client as webauthnClient } from "@passwordless-id/webauthn";
import { useT } from "@/components/i18n/I18nProvider";

type Step = "verify" | "register";

export default function RecoveryPage() {
  const { t } = useT();
  const router = useRouter();
  const [step, setStep] = useState<Step>("verify");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [removeOthers, setRemoveOthers] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/recovery/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code }),
      });
      if (!res.ok) {
        setError(t("auth.recovery.invalid"));
        return;
      }
      setCode("");
      setStep("register");
    } catch {
      setError(t("auth.recovery.failed"));
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!webauthnClient.isAvailable()) {
      setError(t("auth.recovery.unsupported"));
      return;
    }
    setBusy(true);
    try {
      const chRes = await fetch("/api/auth/recovery/challenge");
      if (!chRes.ok) throw new Error("challenge");
      const { key, challenge, user } = await chRes.json();
      const registration = await webauthnClient.register({
        challenge,
        user,
        userVerification: "required",
        discoverable: "preferred",
        timeout: 60000,
      });
      const res = await fetch("/api/auth/recovery/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          registration,
          challengeKey: key,
          deviceName: deviceName.trim(),
          removeOtherPasskeys: removeOthers,
        }),
      });
      if (!res.ok) throw new Error("complete");
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError(t("auth.recovery.failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-bg">
      <div className="login-card">
        <h1 className="login-title">{t("auth.recovery.title")}</h1>
        {step === "verify" ? (
          <form className="login-form" onSubmit={handleVerify}>
            <p className="login-subtitle">{t("auth.recovery.subtitle")}</p>
            <input
              type="email"
              required
              autoComplete="username"
              placeholder={t("auth.recovery.email")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              type="text"
              required
              autoComplete="off"
              spellCheck={false}
              placeholder={t("auth.recovery.code")}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="login-btn-google" disabled={busy}>
              {busy ? t("auth.recovery.verifying") : t("auth.recovery.verify")}
            </button>
          </form>
        ) : (
          <form className="login-form" onSubmit={handleRegister}>
            <h2 className="login-subtitle">{t("auth.recovery.registerTitle")}</h2>
            <p className="login-subtitle">{t("auth.recovery.registerHint")}</p>
            <input
              type="text"
              placeholder={t("auth.recovery.deviceName")}
              value={deviceName}
              maxLength={60}
              onChange={(e) => setDeviceName(e.target.value)}
            />
            <label>
              <input
                type="checkbox"
                checked={removeOthers}
                onChange={(e) => setRemoveOthers(e.target.checked)}
              />{" "}
              {t("auth.recovery.removeOthers")}
            </label>
            {error && (
              <p className="login-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="login-btn-google" disabled={busy}>
              {busy ? t("auth.recovery.registering") : t("auth.recovery.register")}
            </button>
          </form>
        )}
        <Link href="/login" className="login-subtitle">
          {t("auth.recovery.back")}
        </Link>
      </div>
    </div>
  );
}
