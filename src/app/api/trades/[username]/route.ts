import { NextRequest } from "next/server";
import { ok, fail, handleError } from "@/lib/api";
import { get } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getTradeByUsername, reviewsOf } from "@/lib/model";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ username: string }> }) {
  try {
    const { username } = await ctx.params;
    const viewer = await getCurrentUser();

    const profile = getTradeByUsername(decodeURIComponent(username), viewer?.id ?? null);
    if (!profile) return fail("NOT_FOUND", 404);

    return ok({ profile, reviews: reviewsOf(profile.id) });
  } catch (e) {
    return handleError(e);
  }
}
