import { NextRequest } from "next/server";
import { ok, fail, handleError, readJson, str } from "@/lib/api";
import { createSession, createUser, makeUsername } from "@/lib/auth";
import { get } from "@/lib/db";
import { isValidRole, minAgeDate, type Role } from "@/lib/config";

export async function POST(req: NextRequest) {
  try {
    const body = await readJson(req);

    const role = str(body.role) as Role;
    const email = str(body.email).toLowerCase();
    const password = str(body.password);
    const firstName = str(body.firstName);
    const lastName = str(body.lastName);
    const birthdate = str(body.birthdate) || null;
    const is18Plus = Boolean(body.is18Plus);
    const lang = str(body.lang) === "ar" ? "ar" : "fr";

    if (!isValidRole(role)) return fail("BAD_ROLE");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("BAD_EMAIL");
    if (password.length < 6) return fail("SHORT_PASSWORD");
    // The 18+ gate is mandatory for everyone.
    if (!is18Plus) return fail("AGE_REQUIRED");
    if (birthdate && birthdate > minAgeDate()) return fail("AGE_REQUIRED");

    if (get("SELECT 1 FROM users WHERE lower(email) = lower(:e)", { e: email })) {
      return fail("EMAIL_TAKEN", 409);
    }

    const username = makeUsername(firstName, lastName, email);
    const userId = createUser({
      role,
      email,
      password,
      username,
      firstName,
      lastName,
      birthdate,
      is18Plus,
      lang,
    });

    await createSession(userId);
    return ok({ id: userId, username, role });
  } catch (e) {
    return handleError(e);
  }
}
