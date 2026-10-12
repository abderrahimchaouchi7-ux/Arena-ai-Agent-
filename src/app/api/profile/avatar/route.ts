import { NextRequest } from "next/server";
import { ok, fail, handleError, requireUser, readForm } from "@/lib/api";
import { saveUpload } from "@/lib/media";
import { run } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const form = await readForm(req);
    const file = form.get("file");
    if (!(file instanceof File)) return fail("NO_FILE");

    const mediaId = await saveUpload("avatar", user.id, file);
    run("UPDATE users SET avatar_media = :m WHERE id = :id", { m: mediaId, id: user.id });

    return ok({ mediaId, url: `/api/media/${mediaId}` });
  } catch (e) {
    return handleError(e);
  }
}
