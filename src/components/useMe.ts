"use client";

import { useCallback, useEffect, useState } from "react";

export type Me = {
  id: number;
  role: "trade" | "customer";
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar_media: number | null;
  lang: string;
  is_18_plus: number;
};

export function useMe() {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const json = await res.json();
      setMe(json?.user ?? null);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { me, loading, refresh };
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/";
}
