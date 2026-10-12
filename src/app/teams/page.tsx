"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell, EmptyState, Spinner, TradeBadge } from "@/components/ui";
import { useLang } from "@/components/LangProvider";
import { useMe } from "@/components/useMe";
import { errorKey } from "@/components/authErrors";
import { REGIONS, TRADES, tradeIcon, tradeLabel, type TradeId } from "@/lib/config";

type Team = {
  id: number;
  name: string;
  trade: string;
  owner_id: number;
  description: string;
  region: string;
  role: string;
  member_count: number;
  conversation_id: number | null;
};

export default function TeamsPage() {
  const { t, lang } = useLang();
  const router = useRouter();
  const { me, loading } = useMe();

  const [mine, setMine] = useState<Team[]>([]);
  const [open, setOpen] = useState<Team[]>([]);
  const [busy, setBusy] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [trade, setTrade] = useState<TradeId>("construction");
  const [description, setDescription] = useState("");
  const [region, setRegion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const res = await fetch("/api/teams");
    const data = await res.json();
    setMine(data.mine ?? []);
    setOpen(data.open ?? []);
    setBusy(false);
  };

  useEffect(() => {
    if (!loading && !me) router.replace("/login");
    if (me) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, loading, router]);

  if (loading || !me) return <Spinner />;

  async function createTeam(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, trade, description, region }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(t(errorKey(data.error)));
        return;
      }
      setName("");
      setDescription("");
      setShowForm(false);
      await load();
      router.push(`/teams/${data.id}`);
    } finally {
      setSaving(false);
    }
  }

  async function join(teamId: number) {
    await fetch(`/api/teams/${teamId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: me!.id }),
    });
    await load();
  }

  return (
    <AppShell title={t("teams.title")}>
      <p className="card mb-4 p-4 text-ink-700">{t("teams.intro")}</p>

      {!showForm ? (
        <button type="button" onClick={() => setShowForm(true)} className="btn-primary mb-5 w-full">
          <span aria-hidden="true">➕</span>
          <span>{t("teams.create")}</span>
        </button>
      ) : (
        <form onSubmit={createTeam} className="card mb-5 space-y-4 p-5">
          <div>
            <label className="label" htmlFor="tname">{t("teams.name")}</label>
            <input id="tname" className="field" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} placeholder={t("teams.name")} />
          </div>

          <div>
            <label className="label" htmlFor="ttrade">{t("teams.trade")}</label>
            <select id="ttrade" className="field" value={trade} onChange={(e) => setTrade(e.target.value as TradeId)}>
              {TRADES.map((tr) => (
                <option key={tr.id} value={tr.id}>
                  {tr.icon} {lang === "ar" ? tr.ar : tr.fr}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="tregion">{t("search.region")} ({t("common.optional")})</label>
            <select id="tregion" className="field" value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="">{t("common.none")}</option>
              {REGIONS.map((r) => (
                <option key={r.id} value={r.id}>{lang === "ar" ? r.ar : r.fr}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label" htmlFor="tdesc">{t("teams.description")} ({t("common.optional")})</label>
            <textarea id="tdesc" rows={3} className="field" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>

          {error && (
            <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 font-semibold text-danger">{error}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? t("common.loading") : t("common.save")}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>
              {t("common.cancel")}
            </button>
          </div>
        </form>
      )}

      <h2 className="section-title mt-2">{t("teams.yours")}</h2>
      {busy ? (
        <Spinner />
      ) : mine.length === 0 ? (
        <EmptyState icon="👷" text={t("teams.empty")} />
      ) : (
        <ul className="space-y-3">
          {mine.map((team) => (
            <li key={team.id}>
              <Link href={`/teams/${team.id}`} className="card block p-5 hover:bg-brand-50">
                <div className="flex items-start gap-3">
                  <span className="text-3xl" aria-hidden="true">{tradeIcon(team.trade)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xl font-bold text-ink-900">{team.name}</p>
                    <p className="text-sm text-ink-500">{tradeLabel(team.trade, lang)} · {t("teams.memberCount", { count: team.member_count })}</p>
                    {team.description && <p className="mt-1 text-ink-700">{team.description}</p>}
                  </div>
                  {team.role === "owner" && <span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-bold text-brand-800">{t("teams.owner")}</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {me.role === "trade" && (
        <>
          <h2 className="section-title mt-6">{t("teams.others")}</h2>
          {open.length === 0 ? (
            <EmptyState icon="🔍" text={t("teams.empty")} />
          ) : (
            <ul className="space-y-3">
              {open.map((team) => (
                <li key={team.id} className="card p-5">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl" aria-hidden="true">{tradeIcon(team.trade)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xl font-bold text-ink-900">{team.name}</p>
                      <p className="text-sm text-ink-500">{tradeLabel(team.trade, lang)} · {t("teams.memberCount", { count: team.member_count })}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <button type="button" className="btn-primary !min-h-12" onClick={() => join(team.id)}>
                      {t("teams.join")}
                    </button>
                    <Link href={`/teams/${team.id}`} className="btn-secondary !min-h-12">
                      {t("common.edit")}
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </AppShell>
  );
}
