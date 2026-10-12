import { NextRequest } from "next/server";
import { ok, fail, handleError } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth";
import { get } from "@/lib/db";
import { getTeam, teamMembers, isTeamOwner } from "@/lib/model";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const teamId = Number(id);
    const team = getTeam(teamId);
    if (!team) return fail("NOT_FOUND", 404);

    const viewer = await getCurrentUser();
    const members = teamMembers(teamId);
    const conv = get<{ id: number }>("SELECT id FROM conversations WHERE team_id = :t", { t: teamId });

    return ok({
      team,
      members,
      conversationId: conv?.id ?? null,
      isOwner: viewer ? isTeamOwner(teamId, viewer.id) : false,
      canChat: viewer ? isTeamOwner(teamId, viewer.id) || members.some((m) => m.user_id === viewer.id) : false,
    });
  } catch (e) {
    return handleError(e);
  }
}
