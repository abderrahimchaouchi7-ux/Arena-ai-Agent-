"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { LangSwitch, Spinner } from "@/components/ui";
import { errorKey } from "@/components/authErrors";

function LoginInner() {
  const { t } = useLang();
  const router = useRouter();
  const params = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => setGoogleEnabled(Boolean(d.googleEnabled)))
      .catch(() => {});
  }, []);

  const demoMode = params.get("demo") === "1";
  const role = params.get("role") ?? "customer";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(t(errorKey(data.error)));
        return;
      }
      router.push(data.role === "trade" ? "/home" : "/home");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function demoGoogle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/google/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(t(errorKey(data.error)));
        return;
      }
      router.push("/home");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md bg-white px-5 py-8 pt-safe">
      <div className="mb-6 flex items-center justify-between">
        <Link href="/" className="text-2xl font-extrabold text-brand-800">
          🔗 {t("brand.name")}
        </Link>
        <LangSwitch compact />
      </div>

      <h1 className="mb-1 text-3xl font-extrabold text-ink-900">{t("auth.welcomeBack")}</h1>
      <p className="mb-6 text-ink-500">{t("brand.tagline")}</p>

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">
            {t("auth.email")}
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            className="field"
            placeholder={t("auth.emailHint")}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="password">
            {t("auth.password")}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 font-semibold text-danger">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? t("common.loading") : t("nav.login")}
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-ink-300">
        <span className="h-px flex-1 bg-black/10" />
        <span>{t("auth.or")}</span>
        <span className="h-px flex-1 bg-black/10" />
      </div>

      {googleEnabled ? (
        <a href={`/api/auth/google?role=${role}`} className="btn-secondary w-full">
          <span aria-hidden="true">🔵</span>
          <span>{t("auth.google")}</span>
        </a>
      ) : (
        <>
          {demoMode && (
            <p className="mb-3 rounded-2xl bg-black/5 px-4 py-3 text-sm text-ink-700">{t("auth.demoNotice")}</p>
          )}
          <button type="button" onClick={demoGoogle} className="btn-secondary w-full" disabled={busy}>
            <span aria-hidden="true">🔵</span>
            <span>{t("auth.googleDemo")}</span>
          </button>
        </>
      )}

      <p className="mt-6 text-center">
        <Link href="/signup" className="font-semibold text-brand-700 underline">
          {t("auth.noAccount")}
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <LoginInner />
    </Suspense>
  );
}
