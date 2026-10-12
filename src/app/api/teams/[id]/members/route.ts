import { NextRequest } from "next/server";
import { ok, fail, handleError, requireUser, readJson, int } from "@/lib/api";
import { get } from "@/lib/db";
import { addTeamMember, isTeamMember, isTeamOwner, removeTeamMember, teamMembers } from "@/lib/model";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const teamId = Number(id);
    const body = await readJson(req);
    const targetId = int(body.userId, 0);

    if (!targetId) return fail("BAD_USER");

    // Only the owner may add people, but anyone may join an open team.
    if (targetId !== user.id && !isTeamOwner(teamId, user.id)) return fail("FORBIDDEN", 403);

    const target = get<{ role: string }>("SELECT role FROM users WHERE id = :id", { id: targetId });
    if (!target) return fail("NOT_FOUND", 404);
    if (target.role !== "trade") return fail("TRADE_ONLY", 403);

    addTeamMember(teamId, targetId);
    return ok({ members: teamMembers(teamId) });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const teamId = Number(id);
    const targetId = Number(new URL(req.url).searchParams.get("userId"));

    if (!targetId) return fail("BAD_USER");
    if (targetId !== user.id && !isTeamOwner(teamId, user.id)) return fail("FORBIDDEN", 403);
    if (isTeamMember(teamId, targetId) && targetId === user.id && isTeamOwner(teamId, user.id)) {
      return fail("OWNER_CANNOT_LEAVE", 403);
    }

    removeTeamMember(teamId, targetId);
    return ok({ members: teamMembers(teamId) });
  } catch (e) {
    return handleError(e);
  }
}
