"use client";

import Link from "next/link";
import { useLang } from "@/components/LangProvider";
import { LangSwitch } from "@/components/ui";
import { useMe } from "@/components/useMe";
import { TRADES } from "@/lib/config";

export default function LandingPage() {
  const { t, lang } = useLang();
  const { me, loading } = useMe();

  return (
    <div className="mx-auto min-h-dvh max-w-3xl bg-white pb-10">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 border-b border-black/5 px-4 py-3 pt-safe">
        <div className="flex items-center gap-2">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-700 text-2xl" aria-hidden="true">
            🔗
          </span>
          <div>
            <p className="text-xl font-extrabold leading-none text-brand-800">{t("brand.name")}</p>
            <p className="text-sm text-ink-500">{t("brand.tagline")}</p>
          </div>
        </div>
        <LangSwitch />
      </div>

      {/* Hero */}
      <section className="bg-brand-700 px-5 py-10 text-white">
        <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl">{t("brand.tagline")}</h1>
        <p className="mt-3 text-lg text-brand-100">{t("brand.taglineLong")}</p>
      </section>

      {/* Who are you */}
      <section className="px-4 py-6">
        <h2 className="mb-4 text-2xl font-bold text-ink-900">{t("land.whoAreYou")}</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link href="/signup?role=trade" className="card flex items-center gap-4 p-5 hover:bg-brand-50">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-brand-100 text-4xl" aria-hidden="true">
              🛠️
            </span>
            <div>
              <p className="text-xl font-bold text-ink-900">{t("land.iAmTrade")}</p>
              <p className="text-base text-ink-500">{t("land.iAmTradeHint")}</p>
            </div>
          </Link>

          <Link href="/signup?role=customer" className="card flex items-center gap-4 p-5 hover:bg-brand-50">
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-brand-100 text-4xl" aria-hidden="true">
              🏠
            </span>
            <div>
              <p className="text-xl font-bold text-ink-900">{t("land.iAmCustomer")}</p>
              <p className="text-base text-ink-500">{t("land.iAmCustomerHint")}</p>
            </div>
          </Link>
        </div>

        {!loading && me && (
          <Link href="/home" className="btn-primary mt-4 w-full">
            <span aria-hidden="true">➡️</span>
            <span>{t("land.enter")}</span>
          </Link>
        )}

        {!loading && !me && (
          <Link href="/login" className="btn-secondary mt-4 w-full">
            <span>{t("nav.login")}</span>
          </Link>
        )}
      </section>

      {/* Trades */}
      <section className="px-4 py-2">
        <h2 className="mb-3 text-2xl font-bold text-ink-900">{t("land.trades")}</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TRADES.map((trade) => (
            <li key={trade.id} className="card flex items-center gap-3 p-4">
              <span className="text-3xl" aria-hidden="true">
                {trade.icon}
              </span>
              <span className="text-lg font-semibold text-ink-900">{lang === "ar" ? trade.ar : trade.fr}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* How it works */}
      <section className="px-4 py-6">
        <h2 className="mb-4 text-2xl font-bold text-ink-900">{t("land.howItWorks")}</h2>
        <ol className="space-y-3">
          {[t("land.step1"), t("land.step2"), t("land.step3")].map((step, i) => (
            <li key={i} className="card flex items-start gap-4 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-700 text-lg font-bold text-white">
                {i + 1}
              </span>
              <p className="text-base text-ink-700">{step}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="px-4 pt-2 text-center text-sm text-ink-300">
        <p>{t("brand.name")} — {t("brand.tagline")}</p>
      </footer>
    </div>
  );
}
