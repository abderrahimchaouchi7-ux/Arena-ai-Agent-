"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppShell, Avatar, Spinner } from "@/components/ui";
import { useLang } from "@/components/LangProvider";
import { useMe } from "@/components/useMe";

type Message = {
  id: number;
  sender_id: number;
  body: string;
  media_id: number | null;
  created_at: string;
  sender_name: string;
  sender_avatar: number | null;
};

const POLL_MS = 3000;

export default function ChatPage() {
  const { t } = useLang();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const conversationId = Number(params?.id);
  const { me, loading } = useMe();

  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Poll for new messages — works on any free host, no websocket needed.
  useEffect(() => {
    if (!me || !conversationId) return;

    let cancelled = false;

    const load = async () => {
      try {
        const since = messages.length ? messages[messages.length - 1].id : 0;
        const res = await fetch(`/api/chat/${conversationId}/messages?since=${since}`);
        if (res.status === 403) {
          setForbidden(true);
          setBusy(false);
          return;
        }
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        const incoming: Message[] = data.messages ?? [];
        if (incoming.length) {
          setMessages((prev) => {
            const seen = new Set(prev.map((m) => m.id));
            const merged = [...prev, ...incoming.filter((m) => !seen.has(m.id))];
            merged.sort((a, b) => a.id - b.id);
            return merged;
          });
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    };

    void load();
    const id = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // `messages` is intentionally read from state inside `load` via closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!loading && !me) router.replace("/login");
  }, [me, loading, router]);

  if (loading || !me) return <Spinner />;

  async function sendText(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setSending(true);
    setText("");
    try {
      const res = await fetch(`/api/chat/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (res.ok && data.messages) setMessages(data.messages);
    } finally {
      setSending(false);
    }
  }

  async function sendImage(file: File) {
    setSending(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/chat/${conversationId}/messages`, { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.messages) setMessages(data.messages);
    } finally {
      setSending(false);
    }
  }

  if (forbidden) {
    return (
      <AppShell title={t("chat.title")} showBack>
        <div className="card p-6 text-center text-ink-500">{t("err.forbidden")}</div>
      </AppShell>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-3xl flex-col bg-[#f6f8f7]">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/95 px-4 py-3 backdrop-blur pt-safe">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.back()} className="btn-ghost !min-h-11 !px-3 !py-2" aria-label={t("common.back")}>
            <span aria-hidden="true">←</span>
          </button>
          <h1 className="flex-1 truncate text-xl font-bold text-ink-900">{t("chat.title")}</h1>
        </div>
      </header>

      <div className="flex-1 space-y-3 px-4 py-4" style={{ paddingBottom: "1rem" }}>
        {busy && messages.length === 0 ? (
          <Spinner />
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-ink-300">{t("chat.noMessages")}</p>
        ) : (
          messages.map((m) => {
            const mine = m.sender_id === me.id;
            return (
              <div key={m.id} className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                {!mine && <Avatar url={m.sender_avatar ? `/api/media/${m.sender_avatar}` : null} name={m.sender_name} size={36} />}
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-3 ${
                    mine ? "bg-brand-700 text-white" : "bg-white text-ink-900 border border-black/5"
                  }`}
                >
                  {!mine && <p className="mb-1 text-xs font-bold text-brand-700">{m.sender_name}</p>}

                  {m.media_id && (
                    <a href={`/api/media/${m.media_id}`} target="_blank" rel="noreferrer" className="mb-2 block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/media/${m.media_id}`}
                        alt=""
                        className="max-h-64 w-full rounded-xl object-cover"
                        loading="lazy"
                      />
                    </a>
                  )}

                  {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                  <p className={`mt-1 text-xs ${mine ? "text-brand-100" : "text-ink-300"}`}>
                    {m.created_at.slice(11, 16)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form
        onSubmit={sendText}
        className="sticky bottom-0 border-t border-black/5 bg-white px-3 py-3"
        style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="btn-ghost !min-h-14 !px-4"
            aria-label={t("chat.sendImage")}
            disabled={sending}
          >
            <span className="text-2xl" aria-hidden="true">📷</span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void sendImage(f);
              e.target.value = "";
            }}
          />
          <input
            className="field"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("chat.placeholder")}
            aria-label={t("chat.placeholder")}
          />
          <button type="submit" className="btn-primary !min-h-14 !px-5" disabled={sending || !text.trim()}>
            <span aria-hidden="true">➤</span>
            <span className="sr-only">{t("common.send")}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
