import { NextRequest } from "next/server";
import { ok, fail, handleError, requireUser, readJson, int } from "@/lib/api";
import { get } from "@/lib/db";
import { createDirectConversation, listConversations } from "@/lib/model";

export async function GET() {
  try {
    const user = await requireUser();
    return ok({ conversations: listConversations(user.id) });
  } catch (e) {
    return handleError(e);
  }
}

/** Start (or reuse) a 1-to-1 conversation with another user. */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const body = await readJson(req);

    if (body.username) {
      const target = get<{ id: number }>("SELECT id FROM users WHERE lower(username) = lower(:u)", {
        u: String(body.username),
      });
      if (!target) return fail("NOT_FOUND", 404);
      return ok({ id: createDirectConversation(user.id, target.id) });
    }

    const targetId = int(body.userId, 0);
    if (!targetId) return fail("BAD_USER");
    if (!get("SELECT 1 FROM users WHERE id = :id", { id: targetId })) return fail("NOT_FOUND", 404);

    return ok({ id: createDirectConversation(user.id, targetId) });
  } catch (e) {
    return handleError(e);
  }
}
