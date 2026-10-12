import { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { ok, handleError, str } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { run } from "@/lib/db";
import { LANGS, type Lang } from "@/lib/config";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return ok({ user });
  } catch (e) {
    return handleError(e);
  }
}

/** Persist the UI language so SSR picks the right direction on reload. */
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const lang = str(body.lang);
    if (!LANGS.includes(lang as Lang)) return ok({ ok: false });

    const jar = await cookies();
    jar.set("rabt_lang", lang, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });

    const user = await getCurrentUser();
    if (user) run("UPDATE users SET lang = :l WHERE id = :id", { l: lang, id: user.id });

    return ok({ ok: true, lang });
  } catch (e) {
    return handleError(e);
  }
}
