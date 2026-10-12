"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell, Avatar, EmptyState, Spinner } from "@/components/ui";
import { useLang } from "@/components/LangProvider";
import { useMe } from "@/components/useMe";

type Conversation = {
  id: number;
  type: string;
  team_id: number | null;
  last_body: string | null;
  last_at: string | null;
  peer_name: string | null;
  peer_username: string | null;
  peer_avatar: number | null;
  team_name: string | null;
};

export default function ChatListPage() {
  const { t, lang } = useLang();
  const router = useRouter();
  const { me, loading } = useMe();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    if (!loading && !me) router.replace("/login");
    if (!me) return;
    fetch("/api/chat/conversations")
      .then((r) => r.json())
      .then((d) => setConversations(d.conversations ?? []))
      .catch(() => {})
      .finally(() => setBusy(false));
  }, [me, loading, router]);

  if (loading || !me) return <Spinner />;

  return (
    <AppShell title={t("chat.title")}>
      {busy ? (
        <Spinner />
      ) : conversations.length === 0 ? (
        <EmptyState icon="💬" text={t("chat.empty")} />
      ) : (
        <ul className="space-y-3">
          {conversations.map((c) => {
            const title = c.type === "team" ? `${c.team_name ?? t("chat.team")}` : c.peer_name ?? c.peer_username;
            const avatarUrl = c.peer_avatar ? `/api/media/${c.peer_avatar}` : null;
            return (
              <li key={c.id}>
                <Link href={`/chat/${c.id}`} className="card flex items-center gap-4 p-4 hover:bg-brand-50">
                  {c.type === "team" ? (
                    <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand-100 text-2xl" aria-hidden="true">
                      👷
                    </span>
                  ) : (
                    <Avatar url={avatarUrl} name={title ?? "?"} size={56} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="truncate text-lg font-bold text-ink-900">{title}</p>
                      {c.last_at && (
                        <span className="shrink-0 text-xs text-ink-300">{c.last_at.slice(11, 16)}</span>
                      )}
                    </div>
                    <p className="truncate text-ink-500">
                      {c.type === "team" && <span className="font-semibold">{t("chat.team")}: </span>}
                      {c.last_body || "—"}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <Link href="/search" className="btn-primary mt-5 w-full">
        <span aria-hidden="true">🔎</span>
        <span>{t("chat.new")}</span>
      </Link>
    </AppShell>
  );
}
