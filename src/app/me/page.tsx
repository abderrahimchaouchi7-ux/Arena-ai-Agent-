"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AppShell, Avatar, ChipGroup, EquipmentBadge, Spinner, Stars } from "@/components/ui";
import { useLang } from "@/components/LangProvider";
import { useMe, logout } from "@/components/useMe";
import { errorKey } from "@/components/authErrors";
import { EQUIPMENT, REGIONS, TRADES, type EquipmentLevel, type TradeId } from "@/lib/config";

type TradeData = {
  years_experience: number;
  certificate_media: number | null;
  equipment: EquipmentLevel;
  is_private: boolean;
  show_phone: boolean;
  show_real_name: boolean;
  regions: string[];
  trades: TradeId[];
  portfolio: { id: number; url: string; caption: string }[];
  ratingAvg: number | null;
  ratingCount: number;
};

type ProfileResponse = {
  me: {
    id: number;
    role: string;
    email: string;
    username: string;
    first_name: string;
    last_name: string;
    phone: string;
    address: string;
    city: string;
    avatar_media: number | null;
    bio: string;
  };
  trade: TradeData | null;
};

export default function MePage() {
  const { t, lang } = useLang();
  const router = useRouter();
  const { me, loading } = useMe();

  const [data, setData] = useState<ProfileResponse | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  const avatarInput = useRef<HTMLInputElement>(null);
  const certInput = useRef<HTMLInputElement>(null);
  const portfolioInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !me) router.replace("/login");
  }, [me, loading, router]);

  useEffect(() => {
    if (!me) return;
    fetch("/api/profile")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, [me]);

  if (loading || !me || !data) return <Spinner />;

  const { me: profile, trade } = data;
  const isTrade = me.role === "trade";

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(t(errorKey(d.error)));
        return false;
      }
      const refreshed = await fetch("/api/profile").then((r) => r.json());
      setData(refreshed);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function upload(kind: "avatar" | "certificate" | "portfolio", file: File) {
    setUploading(kind);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/profile/${kind}`, { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(t(errorKey(json.error)));
        return;
      }
      const refreshed = await fetch("/api/profile").then((r) => r.json());
      setData(refreshed);
    } finally {
      setUploading(null);
    }
  }

  async function removePortfolio(id: number) {
    await fetch(`/api/profile/portfolio?id=${id}`, { method: "DELETE" });
    const refreshed = await fetch("/api/profile").then((r) => r.json());
    setData(refreshed);
  }

  async function removeCertificate() {
    await fetch("/api/profile/certificate", { method: "DELETE" });
    const refreshed = await fetch("/api/profile").then((r) => r.json());
    setData(refreshed);
  }

  const toggleIn = <T extends string>(arr: T[], v: T): T[] =>
    arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];

  return (
    <AppShell title={t("profile.title")}>
      {/* ---- Status banner ---- */}
      {saved && (
        <p className="mb-4 rounded-2xl bg-brand-50 px-4 py-3 font-semibold text-brand-800">✓ {t("common.saved")}</p>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded-2xl bg-danger/10 px-4 py-3 font-semibold text-danger">
          {error}
        </p>
      )}

      {/* ---- 1. Personal information ---- */}
      <section className="card mb-4 p-5">
        <h2 className="section-title">1️⃣ {t("profile.personal")}</h2>

        <div className="mb-5 flex items-center gap-4">
          <Avatar
            url={profile.avatar_media ? `/api/media/${profile.avatar_media}` : null}
            name={`${profile.first_name} ${profile.last_name}`}
            size={88}
          />
          <div>
            <p className="label mb-2">{t("profile.avatar")}</p>
            <button
              type="button"
              className="btn-secondary !min-h-12 !py-2"
              onClick={() => avatarInput.current?.click()}
              disabled={uploading !== null}
            >
              <span aria-hidden="true">📷</span>
              <span>{uploading === "avatar" ? t("common.uploading") : t("common.choosePhoto")}</span>
            </button>
            <input
              ref={avatarInput}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload("avatar", f);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="fn">{t("auth.firstName")}</label>
            <input id="fn" className="field" defaultValue={profile.first_name}
              onBlur={(e) => patch({ firstName: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="ln">{t("auth.lastName")}</label>
            <input id="ln" className="field" defaultValue={profile.last_name}
              onBlur={(e) => patch({ lastName: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="phone">{t("profile.phone")}</label>
            <input id="phone" type="tel" inputMode="tel" className="field" defaultValue={profile.phone}
              onBlur={(e) => patch({ phone: e.target.value })} />
          </div>
          <div>
            <label className="label" htmlFor="city">{t("profile.city")}</label>
            <input id="city" className="field" defaultValue={profile.city}
              onBlur={(e) => patch({ city: e.target.value })} />
          </div>
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="address">{t("profile.address")}</label>
          <input id="address" className="field" defaultValue={profile.address}
            onBlur={(e) => patch({ address: e.target.value })} />
        </div>

        <div className="mt-4">
          <label className="label" htmlFor="bio">{t("profile.bio")}</label>
          <textarea id="bio" rows={3} className="field" defaultValue={profile.bio} placeholder={t("profile.bioHint")}
            onBlur={(e) => patch({ bio: e.target.value })} />
        </div>

        <p className="hint mt-3">@{profile.username} — {t("auth.usernameHint")}</p>
      </section>

      {isTrade && trade && (
        <>
          {/* ---- 2. Trades, experience, certificate ---- */}
          <section className="card mb-4 p-5">
            <h2 className="section-title">2️⃣ {t("profile.pro")}</h2>

            <p className="label">{t("profile.trades")}</p>
            <ChipGroup
              options={TRADES.map((tr) => ({ id: tr.id as TradeId, label: lang === "ar" ? tr.ar : tr.fr, icon: tr.icon }))}
              selected={trade.trades}
              min={1}
              onToggle={(id) => patch({ trades: toggleIn(trade.trades, id) })}
            />

            <div className="mt-5">
              <label className="label" htmlFor="exp">{t("profile.experience")}</label>
              <input
                id="exp"
                type="number"
                min={0}
                max={60}
                className="field"
                defaultValue={trade.years_experience}
                onBlur={(e) => patch({ yearsExperience: Number(e.target.value) || 0 })}
              />
            </div>

            <div className="mt-5">
              <p className="label">{t("profile.certificate")}</p>
              <p className="hint mb-2">{t("profile.certificateHint")}</p>
              {trade.certificate_media ? (
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={`/api/media/${trade.certificate_media}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-brand-700 underline"
                  >
                    📜 {t("pub.certified")}
                  </a>
                  <button type="button" className="btn-danger !min-h-12 !py-2" onClick={removeCertificate}>
                    {t("common.remove")}
                  </button>
                </div>
              ) : (
                <button type="button" className="btn-secondary" onClick={() => certInput.current?.click()} disabled={uploading !== null}>
                  <span aria-hidden="true">📄</span>
                  <span>{uploading === "certificate" ? t("common.uploading") : t("common.choosePhoto")}</span>
                </button>
              )}
              <input
                ref={certInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload("certificate", f);
                  e.target.value = "";
                }}
              />
            </div>
          </section>

          {/* ---- 3. Portfolio ---- */}
          <section className="card mb-4 p-5">
            <h2 className="section-title">3️⃣ {t("profile.portfolio")}</h2>
            <p className="hint mb-3">{t("profile.portfolioHint")}</p>

            {trade.portfolio.length > 0 && (
              <ul className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {trade.portfolio.map((p) => (
                  <li key={p.id} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt={p.caption}
                      className="aspect-square w-full rounded-2xl border border-black/5 object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePortfolio(p.id)}
                      className="absolute top-2 end-2 rounded-full bg-white/95 px-3 py-1 text-sm font-bold text-danger shadow"
                      aria-label={t("common.delete")}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => portfolioInput.current?.click()}
              disabled={uploading !== null}
            >
              <span aria-hidden="true">➕</span>
              <span>{uploading === "portfolio" ? t("common.uploading") : t("common.add")}</span>
            </button>
            {/* capture="environment" opens the camera directly on phones */}
            <input
              ref={portfolioInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void upload("portfolio", f);
                e.target.value = "";
              }}
            />
          </section>

          {/* ---- 4. Equipment ---- */}
          <section className="card mb-4 p-5">
            <h2 className="section-title">4️⃣ {t("profile.equipment")}</h2>
            <p className="hint mb-3">{t("profile.equipmentHint")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {EQUIPMENT.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  aria-pressed={trade.equipment === e.id}
                  onClick={() => patch({ equipment: e.id })}
                  className={`card flex items-start gap-3 p-4 text-start ${
                    trade.equipment === e.id ? "border-brand-700 bg-brand-50" : ""
                  }`}
                >
                  <span className="text-3xl" aria-hidden="true">{e.icon}</span>
                  <span>
                    <span className="block text-lg font-bold text-ink-900">{lang === "ar" ? e.ar : e.fr}</span>
                    <span className="block text-sm text-ink-500">{lang === "ar" ? e.hintAr : e.hintFr}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* ---- 5. Privacy ---- */}
          <section className="card mb-4 p-5">
            <h2 className="section-title">5️⃣ {t("profile.privacy")}</h2>
            <p className="mb-4 rounded-2xl bg-black/5 p-3 text-base text-ink-700">{t("profile.privacyIntro")}</p>

            <ul className="divide-y divide-black/5">
              <li className="py-3">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-6 w-6 shrink-0 accent-[color:var(--color-brand-700)]"
                    style={{ minHeight: 24 }}
                    checked={trade.show_real_name}
                    onChange={(e) => patch({ showRealName: e.target.checked })}
                  />
                  <span>
                    <span className="block font-semibold text-ink-900">{t("profile.hideRealName")}</span>
                    <span className="block text-sm text-ink-500">{t("profile.hideRealNameHint")}</span>
                  </span>
                </label>
              </li>

              <li className="py-3">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-6 w-6 shrink-0 accent-[color:var(--color-brand-700)]"
                    style={{ minHeight: 24 }}
                    checked={trade.show_phone}
                    onChange={(e) => patch({ showPhone: e.target.checked })}
                  />
                  <span>
                    <span className="block font-semibold text-ink-900">{t("profile.hidePhone")}</span>
                  </span>
                </label>
              </li>

              <li className="py-3">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-6 w-6 shrink-0 accent-[color:var(--color-brand-700)]"
                    style={{ minHeight: 24 }}
                    checked={trade.is_private}
                    onChange={(e) => patch({ isPrivate: e.target.checked })}
                  />
                  <span>
                    <span className="block font-semibold text-ink-900">{t("profile.privateProfile")}</span>
                    <span className="block text-sm text-ink-500">{t("profile.privateProfileHint")}</span>
                  </span>
                </label>
              </li>
            </ul>

            <div className="mt-4">
              <p className="label">{t("profile.regions")}</p>
              <p className="hint mb-2">{t("profile.regionsHint")}</p>
              <ChipGroup
                options={REGIONS.map((r) => ({ id: r.id, label: lang === "ar" ? r.ar : r.fr }))}
                selected={trade.regions}
                onToggle={(id) => patch({ regions: toggleIn(trade.regions, id) })}
              />
            </div>
          </section>

          {/* ---- Always public summary ---- */}
          <section className="card mb-4 p-5">
            <h2 className="section-title">🔓 {t("profile.alwaysPublic")}</h2>
            <ul className="space-y-3 text-base">
              <li className="flex items-center justify-between gap-3">
                <span className="text-ink-500">{t("auth.username")}</span>
                <span className="font-bold text-ink-900">@{profile.username}</span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-ink-500">{t("profile.rating")}</span>
                <span className="flex items-center gap-2">
                  <Stars value={trade.ratingAvg} size={18} />
                  <span className="font-bold text-ink-900">
                    {trade.ratingAvg == null ? "—" : trade.ratingAvg.toFixed(1)}
                  </span>
                </span>
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-ink-500">{t("profile.equipment")}</span>
                <EquipmentBadge level={trade.equipment} lang={lang} />
              </li>
              <li className="flex items-center justify-between gap-3">
                <span className="text-ink-500">{t("profile.experience")}</span>
                <span className="font-bold text-ink-900">{trade.years_experience} {t("common.years")}</span>
              </li>
            </ul>
          </section>

          <Link href={`/pro/${profile.username}`} className="btn-secondary mb-4 w-full">
            <span aria-hidden="true">👁️</span>
            <span>{t("profile.viewPublic")}</span>
          </Link>
        </>
      )}

      {!isTrade && (
        <section className="card mb-4 p-5 text-ink-500">{t("profile.notTrade")}</section>
      )}

      <button type="button" onClick={logout} className="btn-ghost w-full">
        {t("nav.logout")}
      </button>

      {saving && <p className="mt-3 text-center text-sm text-ink-500">{t("common.loading")}</p>}
    </AppShell>
  );
}
