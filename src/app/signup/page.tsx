"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useLang } from "@/components/LangProvider";
import { LangSwitch, Spinner } from "@/components/ui";
import { errorKey } from "@/components/authErrors";
import { minAgeDate, type Role } from "@/lib/config";

function SignupInner() {
  const { t, lang } = useLang();
  const router = useRouter();
  const params = useSearchParams();

  const [role, setRole] = useState<Role>(params.get("role") === "trade" ? "trade" : "customer");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthdate, setBirthdate] = useState("");
  const [is18, setIs18] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((d) => setGoogleEnabled(Boolean(d.googleEnabled)))
      .catch(() => {});
  }, []);

  // The 18+ gate: either confirm the checkbox, or give a date that proves it.
  const ageOk = is18 || (birthdate !== "" && birthdate <= minAgeDate());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!ageOk) {
      setError(t("auth.ageRequired"));
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          email,
          password,
          firstName,
          lastName,
          birthdate: birthdate || null,
          is18Plus: ageOk,
          lang,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(t(errorKey(data.error)));
        return;
      }
      router.push(role === "trade" ? "/me" : "/home");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function demoGoogle() {
    setBusy(true);
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
      router.push(role === "trade" ? "/me" : "/home");
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

      <h1 className="mb-6 text-3xl font-extrabold text-ink-900">{t("auth.createAccount")}</h1>

      <form onSubmit={submit} className="space-y-5">
        {/* Role */}
        <fieldset>
          <legend className="label">{t("land.whoAreYou")}</legend>
          <div className="grid grid-cols-2 gap-3">
            {(["trade", "customer"] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={role === r}
                onClick={() => setRole(r)}
                className={`card flex flex-col items-center gap-2 p-4 ${
                  role === r ? "border-brand-700 bg-brand-50" : ""
                }`}
              >
                <span className="text-4xl" aria-hidden="true">
                  {r === "trade" ? "🛠️" : "🏠"}
                </span>
                <span className="text-base font-bold text-ink-900">
                  {r === "trade" ? t("auth.roleTrade") : t("auth.roleCustomer")}
                </span>
              </button>
            ))}
          </div>
        </fieldset>

        {/* Name */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="fn">
              {t("auth.firstName")}
            </label>
            <input id="fn" className="field" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="ln">
              {t("auth.lastName")}
            </label>
            <input id="ln" className="field" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
        </div>

        {/* Email */}
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

        {/* Password */}
        <div>
          <label className="label" htmlFor="password">
            {t("auth.password")}
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <p className="hint mt-1">{t("auth.passwordHint")}</p>
        </div>

        {/* 18+ gate */}
        <fieldset className="rounded-2xl bg-brand-50 p-4">
          <legend className="label mb-0">{t("auth.ageTitle")}</legend>

          <label className="mt-2 flex items-start gap-3">
            <input
              type="checkbox"
              checked={is18}
              onChange={(e) => setIs18(e.target.checked)}
              className="mt-1 h-6 w-6 shrink-0 accent-[color:var(--color-brand-700)]"
              style={{ minHeight: 24 }}
            />
            <span className="text-base font-semibold text-ink-900">{t("auth.ageCheck")}</span>
          </label>

          <div className="mt-3">
            <label className="hint" htmlFor="bd">
              {t("auth.birthdate")} ({t("common.optional")})
            </label>
            <input
              id="bd"
              type="date"
              max={minAgeDate()}
              className="field mt-1"
              value={birthdate}
              onChange={(e) => setBirthdate(e.target.value)}
            />
          </div>
        </fieldset>

        {error && (
          <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 font-semibold text-danger">
            {error}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? t("common.loading") : t("auth.createAccount")}
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
          <p className="mb-3 rounded-2xl bg-black/5 px-4 py-3 text-sm text-ink-700">{t("auth.demoNotice")}</p>
          <button type="button" onClick={demoGoogle} className="btn-secondary w-full" disabled={busy}>
            <span aria-hidden="true">🔵</span>
            <span>{t("auth.googleDemo")}</span>
          </button>
        </>
      )}

      <p className="mt-6 text-center">
        <Link href="/login" className="font-semibold text-brand-700 underline">
          {t("auth.haveAccount")}
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <SignupInner />
    </Suspense>
  );
}
