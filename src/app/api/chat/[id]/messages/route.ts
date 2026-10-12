import { NextRequest } from "next/server";
import { ok, fail, handleError, requireUser, readForm, readJson, str } from "@/lib/api";
import { isParticipant, messagesOf, postMessage } from "@/lib/model";
import { saveUpload } from "@/lib/media";

/**
 * GET  — poll messages after `since` (keeps the chat dependency-free: no
 *        websockets required, which matters on free hosting tiers).
 * POST — accepts either JSON {body} or multipart form-data with a `file`.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const conversationId = Number(id);

    if (!isParticipant(conversationId, user.id)) return fail("FORBIDDEN", 403);

    const since = Number(new URL(req.url).searchParams.get("since") ?? 0);
    return ok({ messages: messagesOf(conversationId, Number.isFinite(since) ? since : 0) });
  } catch (e) {
    return handleError(e);
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const conversationId = Number(id);

    if (!isParticipant(conversationId, user.id)) return fail("FORBIDDEN", 403);

    const contentType = req.headers.get("content-type") ?? "";

    let body = "";
    let mediaId: number | null = null;

    if (contentType.includes("multipart/form-data")) {
      const form = await readForm(req);
      body = (form.get("body") ?? "").toString().slice(0, 2000);
      const file = form.get("file");
      if (file instanceof File && file.size > 0) {
        mediaId = await saveUpload("chat", user.id, file);
      }
    } else {
      const json = await readJson(req);
      body = str(json.body).slice(0, 2000);
    }

    if (!body && mediaId === null) return fail("EMPTY_MESSAGE");

    const messageId = postMessage(conversationId, user.id, body, mediaId);
    return ok({ id: messageId, messages: messagesOf(conversationId) });
  } catch (e) {
    return handleError(e);
  }
}
