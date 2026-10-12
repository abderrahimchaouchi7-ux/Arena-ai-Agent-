import { NextRequest } from "next/server";
import { ok, fail, handleError, str } from "@/lib/api";
import { createSession, createUser, makeUsername } from "@/lib/auth";
import { get } from "@/lib/db";
import { isValidRole, type Role } from "@/lib/config";

/**
 * Demo Google Sign-In.
 *
 * Used only when GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are absent, so the
 * flow can be evaluated without API keys. It provisions a throw-away account
 * exactly like the real callback does and is clearly labelled in the UI.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const roleRaw = str(body.role);
    const role: Role = isValidRole(roleRaw) ? roleRaw : "customer";

    const n = Math.floor(Math.random() * 9000 + 1000);
    const email = `demo.google.${n}@rabt.test`;
    const firstName = role === "trade" ? "Youssef" : "Salma";
    const lastName = "Demo";
    const username = makeUsername(firstName, lastName, `${n}`);

    const exists = get("SELECT 1 FROM users WHERE lower(email) = lower(:e)", { e: email });
    if (exists) return fail("DEMO_CONFLICT", 409);

    const userId = createUser({
      role,
      email,
      username,
      firstName,
      lastName,
      is18Plus: true,
      googleId: `demo-${n}`,
    });

    await createSession(userId);
    return ok({ id: userId, username, role, demo: true });
  } catch (e) {
    return handleError(e);
  }
}
