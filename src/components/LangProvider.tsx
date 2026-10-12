"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LANG, LANGS, type Lang } from "@/lib/config";
import { translate } from "@/lib/i18n";

type Ctx = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  dir: "ltr" | "rtl";
};

const LangContext = createContext<Ctx | null>(null);

export function LangProvider({ initial, children }: { initial: Lang; children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initial);

  const apply = useCallback((l: Lang) => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = l;
    document.documentElement.dir = l === "ar" ? "rtl" : "ltr";
  }, []);

  useEffect(() => {
    apply(lang);
  }, [lang, apply]);

  const setLang = useCallback(
    (l: Lang) => {
      if (!LANGS.includes(l)) return;
      setLangState(l);
      apply(l);
      // Persist so a reload keeps the same language/direction (SSR-safe).
      void fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang: l }),
      }).catch(() => {});
    },
    [apply]
  );

  const t = useCallback((key: string, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);

  const value = useMemo<Ctx>(() => ({ lang, setLang, t, dir: lang === "ar" ? "rtl" : "ltr" }), [lang, setLang, t]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang(): Ctx {
  const ctx = useContext(LangContext);
  if (ctx) return ctx;
  // Fallback for server rendering of client components.
  return {
    lang: DEFAULT_LANG,
    setLang: () => {},
    t: (k, v) => translate(DEFAULT_LANG, k, v),
    dir: "ltr",
  };
}
