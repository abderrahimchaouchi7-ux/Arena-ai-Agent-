"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell, Avatar, EmptyState, EquipmentBadge, Spinner, Stars, TradeBadge } from "@/components/ui";
import { useLang } from "@/components/LangProvider";
import { useMe, logout } from "@/components/useMe";
import type { PublicTrade } from "@/lib/model";

export default function HomePage() {
  const { t, lang } = useLang();
  const router = useRouter();
  const { me, loading } = useMe();
  const [top, setTop] = useState<PublicTrade[]>([]);
  const [loadingTop, setLoadingTop] = useState(true);

  useEffect(() => {
    if (loading) return;
    if (!me) {
      router.replace("/login");
      return;
    }
    fetch("/api/search?minRating=1")
      .then((r) => r.json())
      .then((d) => setTop((d.results ?? []).slice(0, 4)))
      .catch(() => {})
      .finally(() => setLoadingTop(false));
  }, [me, loading, router]);

  if (loading || !me) return <Spinner />;

  const greetingName = me.first_name || me.username;

  return (
    <AppShell title={t("nav.home")}>
      <div className="card mb-4 flex items-center gap-4 p-5">
        <Avatar url={me.avatar_media ? `/api/media/${me.avatar_media}` : null} name={greetingName} size={64} />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-500">{t("home.hi")}</p>
          <p className="truncate text-2xl font-extrabold text-ink-900">{greetingName}</p>
          <p className="text-sm text-ink-500">
            {me.role === "trade" ? t("auth.roleTrade") : t("auth.roleCustomer")} · @{me.username}
          </p>
        </div>
      </div>

      <h2 className="section-title">{me.role === "trade" ? t("home.tradeActions") : t("home.customerActions")}</h2>
      <div className="grid grid-cols-2 gap-3">
        <Link href="/search" className="card flex flex-col items-center gap-2 p-5 hover:bg-brand-50">
          <span className="text-4xl" aria-hidden="true">
            🔎
          </span>
          <span className="text-center font-bold text-ink-900">{t("home.findWorker")}</span>
        </Link>

        {me.role === "trade" ? (
          <Link href="/me" className="card flex flex-col items-center gap-2 p-5 hover:bg-brand-50">
            <span className="text-4xl" aria-hidden="true">
              📝
            </span>
            <span className="text-center font-bold text-ink-900">{t("home.myProfile")}</span>
          </Link>
        ) : (
          <Link href="/chat" className="card flex flex-col items-center gap-2 p-5 hover:bg-brand-50">
            <span className="text-4xl" aria-hidden="true">
              💬
            </span>
            <span className="text-center font-bold text-ink-900">{t("home.myMessages")}</span>
          </Link>
        )}

        <Link href="/teams" className="card flex flex-col items-center gap-2 p-5 hover:bg-brand-50">
          <span className="text-4xl" aria-hidden="true">
            👷
          </span>
          <span className="text-center font-bold text-ink-900">{t("home.myTeams")}</span>
        </Link>

        <Link href="/chat" className="card flex flex-col items-center gap-2 p-5 hover:bg-brand-50">
          <span className="text-4xl" aria-hidden="true">
            💬
          </span>
          <span className="text-center font-bold text-ink-900">{t("home.myMessages")}</span>
        </Link>
      </div>

      <h2 className="section-title mt-6">{t("home.topRated")}</h2>
      {loadingTop ? (
        <Spinner />
      ) : top.length === 0 ? (
        <EmptyState icon="🔧" text={t("search.empty")} />
      ) : (
        <ul className="space-y-3">
          {top.map((p) => (
            <li key={p.id}>
              <Link href={`/pro/${p.username}`} className="card flex gap-4 p-4 hover:bg-brand-50">
                <Avatar url={p.avatarUrl} name={p.displayName} size={64} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-bold text-ink-900">{p.displayName}</p>
                  <div className="mt-0.5 flex flex-wrap gap-1">
                    {p.trades.map((tr) => (
                      <TradeBadge key={tr} trade={tr} lang={lang} />
                    ))}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars value={p.ratingAvg} size={18} />
                    <span className="text-sm font-semibold text-ink-700">
                      {p.ratingAvg == null ? "—" : p.ratingAvg.toFixed(1)}
                    </span>
                    <EquipmentBadge level={p.equipment} lang={lang} />
                    <span className="text-sm text-ink-500">
                      {p.yearsExperience} {t("common.years")}
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Link href="/search" className="btn-secondary mt-4 w-full">
        {t("home.browse")}
      </Link>

      <button type="button" onClick={logout} className="btn-ghost mt-6 w-full">
        {t("nav.logout")}
      </button>
    </AppShell>
  );
}
