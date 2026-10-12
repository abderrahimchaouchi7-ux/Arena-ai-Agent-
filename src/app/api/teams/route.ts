import { NextRequest } from "next/server";
import { ok, fail, handleError, requireUser, readJson, str } from "@/lib/api";
import { createTeam, listOpenTeams, listTeams } from "@/lib/model";
import { isValidTrade } from "@/lib/config";

export async function GET() {
  try {
    const user = await requireUser();
    return ok({
      mine: listTeams(user.id),
      open: user.role === "trade" ? listOpenTeams(user.id) : [],
    });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await readJson(req);

    const name = str(body.name);
    const trade = str(body.trade);
    if (name.length < 2) return fail("BAD_NAME");
    if (!isValidTrade(trade)) return fail("BAD_TRADE");

    const teamId = createTeam({
      name: name.slice(0, 60),
      trade,
      ownerId: user.id,
      description: str(body.description).slice(0, 400),
      region: str(body.region).slice(0, 40),
    });

    return ok({ id: teamId });
  } catch (e) {
    return handleError(e);
  }
}
