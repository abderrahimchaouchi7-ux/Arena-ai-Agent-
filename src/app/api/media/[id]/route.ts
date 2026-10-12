import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { canAccessMedia, getMedia, mediaExists, readMedia } from "@/lib/media";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const mediaId = Number(id);

  const media = Number.isFinite(mediaId) ? getMedia(mediaId) : undefined;
  if (!media) return new Response("Not found", { status: 404 });

  const viewer = await getCurrentUser();
  if (!canAccessMedia(media, viewer?.id ?? null)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!mediaExists(media)) return new Response("Not found", { status: 404 });

  const data = readMedia(media);
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": media.mime,
      "Cache-Control": "private, max-age=3600",
      "Content-Length": String(data.length),
    },
  });
}
