import { NextRequest } from "next/server";
import { ok, fail, handleError, readJson, str } from "@/lib/api";
import { createSession, verifyPassword } from "@/lib/auth";
import { get } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);
    const email = str(body.email).toLowerCase();
    const password = str(body.password);

    const user = get<{ id: number; password_hash: string | null; username: string; role: string }>(
      "SELECT id, password_hash, username, role FROM users WHERE lower(email) = lower(:e)",
      { e: email }
    );

    if (!user || !verifyPassword(password, user.password_hash)) {
      return fail("BAD_CREDENTIALS", 401);
    }

    await createSession(user.id);
    return ok({ id: user.id, username: user.username, role: user.role });
  } catch (e) {
    return handleError(e);
  }
}
