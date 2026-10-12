"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AppShell, Avatar, EmptyState, EquipmentBadge, Spinner, Stars, TradeBadge } from "@/components/ui";
import { useLang } from "@/components/LangProvider";
import { useMe } from "@/components/useMe";
import { EQUIPMENT, REGIONS, TRADES, type EquipmentLevel, type TradeId } from "@/lib/config";
import type { PublicTrade } from "@/lib/model";

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

export default function SearchPage() {
  const { t, lang } = useLang();
  const router = useRouter();
  const { me, loading } = useMe();

  const [q, setQ] = useState("");
  const [trade, setTrade] = useState<TradeId | "">("");
  const [region, setRegion] = useState("");
  const [equipment, setEquipment] = useState<EquipmentLevel | "">("");
  const [minRating, setMinRating] = useState(0);

  const [results, setResults] = useState<PublicTrade[]>([]);
  const [busy, setBusy] = useState(true);

  const debouncedQ = useDebounced(q);

  useEffect(() => {
    if (!loading && !me) router.replace("/login");
  }, [me, loading, router]);

  useEffect(() => {
    if (!me) return;
    setBusy(true);
    const sp = new URLSearchParams();
    if (debouncedQ.trim()) sp.set("q", debouncedQ.trim());
    if (trade) sp.set("trade", trade);
    if (region) sp.set("region", region);
    if (equipment) sp.set("equipment", equipment);
    if (minRating) sp.set("minRating", String(minRating));

    fetch(`/api/search?${sp.toString()}`)
      .then((r) => r.json())
      .then((d) => setResults(d.results ?? []))
      .catch(() => setResults([]))
      .finally(() => setBusy(false));
  }, [debouncedQ, trade, region, equipment, minRating, me]);

  const hasFilters = Boolean(q || trade || region || equipment || minRating);

  const clearAll = () => {
    setQ("");
    setTrade("");
    setRegion("");
    setEquipment("");
    setMinRating(0);
  };

  if (loading || !me) return <Spinner />;

  return (
    <AppShell title={t("search.title")}>
      {/* Text search */}
      <div className="card mb-4 p-4">
        <label className="label" htmlFor="q">
          {t("common.search")}
        </label>
        <div className="flex items-center gap-2">
          <span className="text-2xl" aria-hidden="true">
            🔎
          </span>
          <input
            id="q"
            className="field"
            placeholder={t("search.placeholder")}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {/* Trades */}
      <div className="card mb-4 p-4">
        <p className="label">{t("search.trade")}</p>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar">
          <button
            type="button"
            aria-pressed={trade === ""}
            onClick={() => setTrade("")}
            className={trade === "" ? "chip-on shrink-0" : "chip-off shrink-0"}
          >
            {t("common.all")}
          </button>
          {TRADES.map((tr) => (
            <button
              key={tr.id}
              type="button"
              aria-pressed={trade === tr.id}
              onClick={() => setTrade(tr.id as TradeId)}
              className={trade === tr.id ? "chip-on shrink-0" : "chip-off shrink-0"}
            >
              <span aria-hidden="true">{tr.icon}</span>
              <span>{lang === "ar" ? tr.ar : tr.fr}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Region + equipment + rating */}
      <div className="card mb-4 space-y-4 p-4">
        <div>
          <label className="label" htmlFor="region">
            {t("search.region")}
          </label>
          <select id="region" className="field" value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">{t("common.all")}</option>
            {REGIONS.map((r) => (
              <option key={r.id} value={r.id}>
                {lang === "ar" ? r.ar : r.fr}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p className="label">{t("search.equipment")}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              aria-pressed={equipment === ""}
              onClick={() => setEquipment("")}
              className={equipment === "" ? "chip-on" : "chip-off"}
            >
              {t("common.all")}
            </button>
            {EQUIPMENT.map((e) => (
              <button
                key={e.id}
                type="button"
                aria-pressed={equipment === e.id}
                onClick={() => setEquipment(e.id)}
                className={equipment === e.id ? "chip-on" : "chip-off"}
              >
                <span aria-hidden="true">{e.icon}</span>
                <span>{lang === "ar" ? e.ar : e.fr}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="rating">
            {t("search.minRating")}
          </label>
          <select
            id="rating"
            className="field"
            value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value))}
          >
            <option value={0}>{t("common.all")}</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {"★".repeat(n)} {n}+
              </option>
            ))}
          </select>
        </div>

        {hasFilters && (
          <button type="button" onClick={clearAll} className="btn-ghost w-full">
            {t("search.clear")}
          </button>
        )}
      </div>

      {/* Results */}
      <p className="mb-3 font-semibold text-ink-700">{t("search.results", { count: results.length })}</p>

      {busy ? (
        <Spinner />
      ) : results.length === 0 ? (
        <EmptyState icon="🔧" text={t("search.empty")} />
      ) : (
        <ul className="space-y-3">
          {results.map((p) => (
            <li key={p.id}>
              <Link href={`/pro/${p.username}`} className="card block p-4 hover:bg-brand-50">
                <div className="flex gap-4">
                  <Avatar url={p.avatarUrl} name={p.displayName} size={72} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xl font-bold text-ink-900">{p.displayName}</p>
                    <p className="text-sm text-ink-500">@{p.username}</p>

                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {p.trades.map((tr) => (
                        <TradeBadge key={tr} trade={tr} lang={lang} />
                      ))}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Stars value={p.ratingAvg} size={18} />
                      <span className="font-bold text-ink-900">
                        {p.ratingAvg == null ? "—" : p.ratingAvg.toFixed(1)}
                      </span>
                      <span className="text-sm text-ink-500">({p.ratingCount})</span>
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-700">
                      <EquipmentBadge level={p.equipment} lang={lang} />
                      <span>
                        🕒 {p.yearsExperience} {t("common.years")}
                      </span>
                      {p.regionLabels[lang].length > 0 && <span>📍 {p.regionLabels[lang].join(" · ")}</span>}
                    </div>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
