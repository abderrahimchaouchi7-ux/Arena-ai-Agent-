import { NextRequest } from "next/server";
import { ok, fail, handleError, requireTrade, readForm } from "@/lib/api";
import { saveUpload } from "@/lib/media";
import { run } from "@/lib/db";
import { ensureTradeProfile } from "@/lib/model";

export async function POST(req: NextRequest) {
  try {
    const user = await requireTrade();
    ensureTradeProfile(user.id);

    const form = await readForm(req);
    const file = form.get("file");
    if (!(file instanceof File)) return fail("NO_FILE");

    const mediaId = await saveUpload("certificate", user.id, file);
    run("UPDATE trade_profiles SET certificate_media = :m WHERE user_id = :id", { m: mediaId, id: user.id });

    return ok({ mediaId, url: `/api/media/${mediaId}` });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE() {
  try {
    const user = await requireTrade();
    run("UPDATE trade_profiles SET certificate_media = NULL WHERE user_id = :id", { id: user.id });
    return ok({ ok: true });
  } catch (e) {
    return handleError(e);
  }
}
