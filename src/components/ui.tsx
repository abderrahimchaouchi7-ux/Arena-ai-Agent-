"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLang } from "./LangProvider";
import { EQUIPMENT, TRADES, type EquipmentLevel, type Lang, type TradeId } from "@/lib/config";

/* ------------------------------------------------------------------ */
/* Stars                                                               */
/* ------------------------------------------------------------------ */

export function Stars({ value, size = 22 }: { value: number | null; size?: number }) {
  const rounded = value == null ? 0 : Math.round(value);
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${value?.toFixed(1) ?? "0"} / 5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 2.6l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.45 6.2 20.5l1.1-6.45-4.7-4.6 6.5-.95z"
            fill={i <= rounded ? "var(--color-star)" : "#d8dedc"}
          />
        </svg>
      ))}
    </span>
  );
}

export function RatingLine({ avg, count }: { avg: number | null; count: number }) {
  const { t, lang } = useLang();
  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <Stars value={avg} />
      <span className="font-bold text-ink-900">{avg == null ? "—" : avg.toFixed(1)}</span>
      <span className="text-sm text-ink-500">{t("pub.reviewCount", { count })}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Avatar                                                              */
/* ------------------------------------------------------------------ */

export function Avatar({
  url,
  name,
  size = 56,
  className = "",
}: {
  url?: string | null;
  name?: string;
  size?: number;
  className?: string;
}) {
  const initials = (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        className={`rounded-full object-cover bg-brand-50 shrink-0 ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <div
      className={`rounded-full bg-brand-100 text-brand-800 font-bold flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden="true"
    >
      {initials || "?"}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Trade & equipment badges                                            */
/* ------------------------------------------------------------------ */

export function TradeBadge({ trade, lang, compact = false }: { trade: TradeId; lang: Lang; compact?: boolean }) {
  const meta = TRADES.find((t) => t.id === trade);
  if (!meta) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-3 py-1 text-sm font-semibold text-ink-700">
      <span aria-hidden="true">{meta.icon}</span>
      {!compact && <span>{lang === "ar" ? meta.ar : meta.fr}</span>}
    </span>
  );
}

export function EquipmentBadge({ level, lang }: { level: EquipmentLevel; lang: Lang }) {
  const meta = EQUIPMENT.find((e) => e.id === level);
  if (!meta) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-800">
      <span aria-hidden="true">{meta.icon}</span>
      <span>{lang === "ar" ? meta.ar : meta.fr}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Multi-select chip groups                                            */
/* ------------------------------------------------------------------ */

export function ChipGroup<T extends string>({
  options,
  selected,
  onToggle,
  min = 0,
}: {
  options: { id: T; label: string; icon?: string }[];
  selected: T[];
  onToggle: (id: T) => void;
  min?: number;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={on}
            onClick={() => {
              if (on && selected.length <= min) return;
              onToggle(o.id);
            }}
            className={on ? "chip-on" : "chip-off"}
          >
            {o.icon && <span aria-hidden="true">{o.icon}</span>}
            <span>{o.label}</span>
            {on && <span aria-hidden="true">✓</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Language switch                                                     */
/* ------------------------------------------------------------------ */

export function LangSwitch({ compact = false }: { compact?: boolean }) {
  const { lang, setLang, t } = useLang();
  return (
    <div className="inline-flex rounded-2xl border-2 border-black/10 bg-white p-1" role="group" aria-label={t("common.language")}>
      {(["fr", "ar"] as Lang[]).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          aria-pressed={lang === l}
          className={`rounded-xl px-3 py-2 text-sm font-bold min-h-0 ${
            lang === l ? "bg-brand-700 text-white" : "text-ink-700"
          }`}
        >
          {compact ? l.toUpperCase() : l === "fr" ? "Français" : "العربية"}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Bottom navigation                                                   */
/* ------------------------------------------------------------------ */

const NAV = [
  { href: "/home", key: "nav.home", icon: "🏠" },
  { href: "/search", key: "nav.search", icon: "🔎" },
  { href: "/teams", key: "nav.teams", icon: "👷" },
  { href: "/chat", key: "nav.chat", icon: "💬" },
  { href: "/me", key: "nav.profile", icon: "👤" },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useLang();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-black/10 bg-white/95 backdrop-blur">
      <ul className="mx-auto flex max-w-3xl">
        {NAV.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-[64px] flex-col items-center justify-center gap-0.5 py-2 text-xs font-semibold ${
                  active ? "text-brand-700" : "text-ink-500"
                }`}
              >
                <span className="text-2xl leading-none" aria-hidden="true">
                  {item.icon}
                </span>
                <span>{t(item.key)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
      <div style={{ height: "env(safe-area-inset-bottom)" }} />
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/* App shell                                                           */
/* ------------------------------------------------------------------ */

export function AppShell({ title, children, showBack = false }: { title: string; children: React.ReactNode; showBack?: boolean }) {
  const router = useRouter();
  const { t, dir } = useLang();

  return (
    <div className="mx-auto min-h-dvh max-w-3xl bg-[#f6f8f7] pb-nav">
      <header className="sticky top-0 z-30 border-b border-black/5 bg-white/95 backdrop-blur pt-safe">
        <div className="flex items-center gap-3 px-4 py-3">
          {showBack && (
            <button type="button" onClick={() => router.back()} className="btn-ghost !min-h-11 !px-3 !py-2" aria-label={t("common.back")}>
              <span aria-hidden="true">{dir === "rtl" ? "→" : "←"}</span>
            </button>
          )}
          <h1 className="flex-1 truncate text-xl font-bold text-ink-900">{title}</h1>
          <LangSwitch compact />
        </div>
      </header>
      <main className="px-4 py-4">{children}</main>
      <BottomNav />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Misc                                                                */
/* ------------------------------------------------------------------ */

export function Spinner({ label }: { label?: string }) {
  const { t } = useLang();
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-ink-500">
      <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-ink-300 border-t-brand-700" />
      <span>{label ?? t("common.loading")}</span>
    </div>
  );
}

export function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl bg-white py-10 text-center text-ink-500">
      <span className="text-4xl" aria-hidden="true">
        {icon}
      </span>
      <p className="px-6">{text}</p>
    </div>
  );
}
