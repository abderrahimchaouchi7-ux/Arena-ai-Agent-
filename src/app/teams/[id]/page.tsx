"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell, Avatar, EmptyState, Spinner, TradeBadge } from "@/components/ui";
import { useLang } from "@/components/LangProvider";
import { useMe } from "@/components/useMe";
import { errorKey } from "@/components/authErrors";
import { regionLabel, tradeLabel, type TradeId } from "@/lib/config";
import type { PublicTrade } from "@/lib/model";

type Member = {
  user_id: number;
  username: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  avatar_media: number | null;
};

type TeamDetail = {
  team: { id: number; name: string; trade: string; owner_id: number; description: string; region: string };
  members: Member[];
  conversationId: number | null;
  isOwner: boolean;
  canChat: boolean;
};

export default function TeamDetailPage() {
  const { t, lang } = useLang();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const teamId = Number(params?.id);
  const { me, loading } = useMe();

  const [detail, setDetail] = useState<TeamDetail | null>(null);
  const [busy, setBusy] = useState(true);

  const [addOpen, setAddOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<PublicTrade[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/teams/${teamId}`);
    if (!res.ok) {
      setDetail(null);
      setBusy(false);
      return;
    }
    setDetail(await res.json());
    setBusy(false);
  }, [teamId]);

  useEffect(() => {
    if (!loading && !me) router.replace("/login");
    if (me) void load();
  }, [me, loading, router, load]);

  // Search for people to invite.
  useEffect(() => {
    if (!addOpen) return;
    const id = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .then((d) => setCandidates(d.results ?? []))
        .catch(() => setCandidates([]));
    }, 300);
    return () => clearTimeout(id);
  }, [query, addOpen]);

  if (loading || !me || busy) return <Spinner />;
  if (!detail) {
    return (
      <AppShell title={t("err.notFound")} showBack>
        <div className="card p-6 text-center text-ink-500">{t("err.notFound")}</div>
      </AppShell>
    );
  }

  const { team, members, conversationId, isOwner, canChat } = detail;
  const memberIds = new Set(members.map((m) => m.user_id));

  async function addMember(userId: number) {
    setError(null);
    const res = await fetch(`/api/teams/${teamId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(t(errorKey(data.error)));
      return;
    }
    await load();
    setAddOpen(false);
    setQuery("");
  }

  async function removeMember(userId: number) {
    await fetch(`/api/teams/${teamId}/members?userId=${userId}`, { method: "DELETE" });
    await load();
  }

  return (
    <AppShell title={team.name} showBack>
      <div className="card mb-4 p-5">
        <div className="flex items-start gap-3">
          <span className="text-4xl" aria-hidden="true">
            {tradeLabel(team.trade, lang) ? "👷" : "👷"}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-extrabold text-ink-900">{team.name}</h2>
            <div className="mt-1">
              <TradeBadge trade={team.trade as TradeId} lang={lang} />
            </div>
            {team.region && (
              <p className="mt-1 text-sm text-ink-500">📍 {regionLabel(team.region, lang)}</p>
            )}
            {team.description && <p className="mt-2 text-ink-700">{team.description}</p>}
            <p className="mt-2 text-sm text-ink-500">{t("teams.memberCount", { count: members.length })}</p>
          </div>
        </div>

        {canChat && conversationId && (
          <Link href={`/chat/${conversationId}`} className="btn-primary mt-4 w-full">
            <span aria-hidden="true">💬</span>
            <span>{t("teams.openChat")}</span>
          </Link>
        )}
      </div>

      <h2 className="section-title">{t("teams.members")}</h2>
      <ul className="space-y-3">
        {members.map((m) => {
          const name = [m.first_name, m.last_name].filter(Boolean).join(" ") || m.username;
          return (
            <li key={m.user_id} className="card flex items-center gap-4 p-4">
              <Avatar url={m.avatar_media ? `/api/media/${m.avatar_media}` : null} name={name} size={56} />
              <div className="min-w-0 flex-1">
                <Link href={`/pro/${m.username}`} className="block truncate text-lg font-bold text-ink-900 hover:underline">
                  {name}
                </Link>
                <p className="text-sm text-ink-500">
                  @{m.username}
                  {m.role === "owner" && ` · ${t("teams.owner")}`}
                </p>
              </div>
              {(isOwner || m.user_id === me!.id) && m.role !== "owner" && (
                <button type="button" className="btn-danger !min-h-12 !px-4 !py-2" onClick={() => removeMember(m.user_id)}>
                  {t("teams.leave")}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {isOwner && (
        <>
          {!addOpen ? (
            <button type="button" onClick={() => setAddOpen(true)} className="btn-secondary mt-4 w-full">
              <span aria-hidden="true">➕</span>
              <span>{t("teams.addMember")}</span>
            </button>
          ) : (
            <div className="card mt-4 p-5">
              <label className="label" htmlFor="mq">{t("teams.searchMember")}</label>
              <input
                id="mq"
                className="field"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("teams.searchMember")}
              />

              {error && (
                <p role="alert" className="mt-3 rounded-2xl bg-danger/10 px-4 py-3 font-semibold text-danger">{error}</p>
              )}

              <ul className="mt-3 space-y-2">
                {candidates.length === 0 && (
                  <li>
                    <EmptyState icon="🔍" text={t("search.empty")} />
                  </li>
                )}
                {candidates.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 rounded-2xl border border-black/5 p-3">
                    <Avatar url={c.avatarUrl} name={c.displayName} size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-ink-900">{c.displayName}</p>
                      <p className="text-sm text-ink-500">
                        {c.yearsExperience} {t("common.years")} · {c.equipmentLabel[lang]}
                      </p>
                    </div>
                    {memberIds.has(c.id) ? (
                      <span className="text-sm font-bold text-brand-700">✓</span>
                    ) : (
                      <button type="button" className="btn-primary !min-h-12 !px-4 !py-2" onClick={() => addMember(c.id)}>
                        {t("common.add")}
                      </button>
                    )}
                  </li>
                ))}
              </ul>

              <button type="button" className="btn-ghost mt-4 w-full" onClick={() => setAddOpen(false)}>
                {t("common.close")}
              </button>
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}
