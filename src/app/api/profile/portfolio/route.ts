import { NextRequest } from "next/server";
import { ok, fail, handleError, requireTrade, readForm } from "@/lib/api";
import { saveUpload } from "@/lib/media";
import { get, run } from "@/lib/db";
import { ensureTradeProfile, portfolioOf } from "@/lib/model";

const MAX_PHOTOS = 12;

export async function POST(req: NextRequest) {
  try {
    const user = await requireTrade();
    ensureTradeProfile(user.id);

    const count = get<{ c: number }>("SELECT COUNT(*) AS c FROM portfolio WHERE user_id = :u", { u: user.id });
    if ((count?.c ?? 0) >= MAX_PHOTOS) return fail("PORTFOLIO_FULL", 409);

    const form = await readForm(req);
    const file = form.get("file");
    if (!(file instanceof File)) return fail("NO_FILE");

    const caption = (form.get("caption") ?? "").toString().slice(0, 140);
    const mediaId = await saveUpload("portfolio", user.id, file);
    run("INSERT INTO portfolio (user_id, media_id, caption) VALUES (:u, :m, :c)", {
      u: user.id,
      m: mediaId,
      c: caption,
    });

    return ok({ portfolio: portfolioOf(user.id) });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await requireTrade();
    const id = Number(new URL(req.url).searchParams.get("id"));
    if (!Number.isFinite(id)) return fail("BAD_ID");

    run("DELETE FROM portfolio WHERE id = :id AND user_id = :u", { id, u: user.id });
    return ok({ portfolio: portfolioOf(user.id) });
  } catch (e) {
    return handleError(e);
  }
}
