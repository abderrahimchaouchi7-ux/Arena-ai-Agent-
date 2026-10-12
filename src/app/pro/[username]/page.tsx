"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AppShell, Avatar, EquipmentBadge, RatingLine, Spinner, Stars, TradeBadge } from "@/components/ui";
import { useLang } from "@/components/LangProvider";
import { useMe } from "@/components/useMe";
import { errorKey } from "@/components/authErrors";
import type { PublicTrade } from "@/lib/model";

type Review = { id: number; rating: number; comment: string; created_at: string; author: string };

export default function PublicProfilePage() {
  const { t, lang } = useLang();
  const router = useRouter();
  const params = useParams<{ username: string }>();
  const username = decodeURIComponent(params?.username ?? "");

  const { me, loading: meLoading } = useMe();
  const [profile, setProfile] = useState<PublicTrade | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [myRating, setMyRating] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/trades/${encodeURIComponent(username)}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      const data = await res.json();
      setProfile(data.profile ?? null);
      setReviews(data.reviews ?? []);
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitReview(e: React.FormEvent) {
    e.preventDefault();
    if (!myRating) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/trades/${encodeURIComponent(username)}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: myRating, comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(t(errorKey(data.error)));
        return;
      }
      setProfile(data.profile);
      setReviews(data.reviews);
      setComment("");
    } finally {
      setSaving(false);
    }
  }

  async function startChat() {
    if (!profile) return;
    const res = await fetch("/api/chat/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: profile.id }),
    });
    const data = await res.json();
    if (res.ok) router.push(`/chat/${data.id}`);
  }

  if (loading || meLoading) return <Spinner />;

  if (notFound || !profile) {
    return (
      <AppShell title={t("err.notFound")} showBack>
        <div className="card p-6 text-center text-ink-500">{t("err.notFound")}</div>
      </AppShell>
    );
  }

  const isSelf = me?.id === profile.id;

  return (
    <AppShell title={profile.displayName} showBack>
      {/* Identity */}
      <div className="card mb-4 p-5">
        <div className="flex gap-4">
          <Avatar url={profile.avatarUrl} name={profile.displayName} size={88} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-2xl font-extrabold text-ink-900">{profile.displayName}</h2>
            <p className="text-ink-500">@{profile.username}</p>
            <div className="mt-2">
              <RatingLine avg={profile.ratingAvg} count={profile.ratingCount} />
            </div>
            {profile.isPrivate && (
              <p className="mt-2 inline-block rounded-full bg-black/5 px-3 py-1 text-sm font-semibold text-ink-700">
                🔒 {t("pub.private")}
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {profile.trades.map((tr) => (
            <TradeBadge key={tr} trade={tr} lang={lang} />
          ))}
        </div>

        {/* Always-visible block: rating, username, equipment, experience */}
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-2xl bg-brand-50 p-4">
          <div>
            <p className="text-sm text-ink-500">{t("profile.experience")}</p>
            <p className="text-xl font-bold text-ink-900">
              🕒 {profile.yearsExperience} {t("common.years")}
            </p>
          </div>
          <div>
            <p className="text-sm text-ink-500">{t("profile.equipment")}</p>
            <div className="mt-1">
              <EquipmentBadge level={profile.equipment} lang={lang} />
            </div>
          </div>
        </div>
      </div>

      {/* Contact */}
      {!isSelf && (
        <div className="card mb-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <button type="button" onClick={startChat} className="btn-primary">
              <span aria-hidden="true">💬</span>
              <span>{t("pub.message")}</span>
            </button>
            {profile.phone ? (
              <a href={`tel:${profile.phone}`} className="btn-secondary">
                <span aria-hidden="true">📞</span>
                <span>{t("pub.call")}</span>
              </a>
            ) : (
              <div className="btn-ghost !cursor-default opacity-60">
                <span aria-hidden="true">📞</span>
                <span>{t("common.hidden")}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* About */}
      <div className="card mb-4 p-5">
        <h3 className="section-title">{t("pub.about")}</h3>
        {profile.bio ? (
          <p className="text-ink-700">{profile.bio}</p>
        ) : (
          <p className="text-ink-300">—</p>
        )}

        <dl className="mt-4 space-y-2 text-base">
          {profile.city && (
            <div className="flex gap-2">
              <dt className="text-ink-500">📍</dt>
              <dd className="text-ink-900">{profile.city}</dd>
            </div>
          )}
          {profile.regionLabels[lang].length > 0 && (
            <div className="flex gap-2">
              <dt className="text-ink-500">🗺️</dt>
              <dd className="text-ink-900">{profile.regionLabels[lang].join(" · ")}</dd>
            </div>
          )}
          {profile.certificateUrl && (
            <div className="flex gap-2">
              <dt className="text-ink-500">📜</dt>
              <dd>
                <a href={profile.certificateUrl} target="_blank" rel="noreferrer" className="font-semibold text-brand-700 underline">
                  {t("pub.certified")}
                </a>
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Portfolio */}
      <div className="card mb-4 p-5">
        <h3 className="section-title">{t("pub.work")}</h3>
        {profile.portfolio.length === 0 ? (
          <p className="text-ink-300">{t("pub.noWork")}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {profile.portfolio.map((p) => (
              <li key={p.id}>
                <a href={p.url} target="_blank" rel="noreferrer" className="block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={p.url}
                    alt={p.caption}
                    className="aspect-square w-full rounded-2xl border border-black/5 object-cover"
                    loading="lazy"
                  />
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Reviews */}
      <div className="card mb-4 p-5">
        <h3 className="section-title">{t("pub.reviews")}</h3>
        {reviews.length === 0 ? (
          <p className="text-ink-300">{t("pub.noReviews")}</p>
        ) : (
          <ul className="space-y-4">
            {reviews.map((r) => (
              <li key={r.id} className="border-b border-black/5 pb-3 last:border-0 last:pb-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-bold text-ink-900">{r.author}</span>
                  <Stars value={r.rating} size={16} />
                </div>
                {r.comment && <p className="mt-1 text-ink-700">{r.comment}</p>}
                <p className="mt-1 text-sm text-ink-300">{r.created_at}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Rate */}
      {!isSelf && (
        <form onSubmit={submitReview} className="card mb-4 p-5">
          <h3 className="section-title">{t("pub.rate")}</h3>

          {!me ? (
            <p className="text-ink-500">{t("pub.loginToRate")}</p>
          ) : (
            <>
              <p className="label">{t("pub.yourRating")}</p>
              <div className="flex gap-1" role="radiogroup" aria-label={t("pub.yourRating")}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={myRating === n}
                    aria-label={`${n}/5`}
                    onClick={() => setMyRating(n)}
                    className="rounded-xl p-1"
                  >
                    <svg width="40" height="40" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45 6.2 20.5l1.1-6.45-4.7-4.6 6.5-.95z"
                        fill={n <= myRating ? "var(--color-star)" : "#d8dedc"}
                      />
                    </svg>
                  </button>
                ))}
              </div>

              <label className="label mt-4" htmlFor="comment">
                {t("pub.comment")}
              </label>
              <textarea
                id="comment"
                className="field"
                rows={3}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={t("pub.comment")}
              />

              {error && (
                <p role="alert" className="mt-3 rounded-2xl bg-danger/10 px-4 py-3 font-semibold text-danger">
                  {error}
                </p>
              )}

              <button type="submit" className="btn-primary mt-4 w-full" disabled={!myRating || saving}>
                {saving ? t("common.loading") : t("pub.rate")}
              </button>
            </>
          )}
        </form>
      )}
    </AppShell>
  );
}
