import { NextRequest } from "next/server";
import { ok, fail, handleError, requireUser, readJson, str, int } from "@/lib/api";
import { get } from "@/lib/db";
import { addReview, getTradeByUsername, reviewsOf } from "@/lib/model";

export async function POST(req: NextRequest, ctx: { params: Promise<{ username: string }> }) {
  try {
    const author = await requireUser();
    const { username } = await ctx.params;
    const body = await readJson(req);

    const rating = Math.max(1, Math.min(5, int(body.rating, 0)));
    const comment = str(body.comment).slice(0, 500);

    const target = get<{ id: number }>("SELECT id FROM users WHERE lower(username) = lower(:u)", {
      u: decodeURIComponent(username),
    });
    if (!target) return fail("NOT_FOUND", 404);
    if (target.id === author.id) return fail("SELF_REVIEW", 403);

    addReview(target.id, author.id, rating, comment);

    const profile = getTradeByUsername(decodeURIComponent(username), author.id);
    return ok({ profile, reviews: reviewsOf(target.id) });
  } catch (e) {
    return handleError(e);
  }
}
