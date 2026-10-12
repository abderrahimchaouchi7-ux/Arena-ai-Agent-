import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createSession,
  createUser,
  exchangeGoogleCode,
  findUserByGoogle,
  linkGoogle,
  makeUsername,
} from "@/lib/auth";
import { get } from "@/lib/db";
import { isValidRole, type Role } from "@/lib/config";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state") ?? "";
  const jar = await cookies();

  const savedState = jar.get("rabt_oauth_state")?.value;
  jar.delete("rabt_oauth_state");

  if (!code || !savedState || savedState !== stateParam) {
    return NextResponse.redirect(new URL("/login?error=oauth_state", url.origin));
  }

  let state: { role: Role; next: string };
  try {
    state = JSON.parse(Buffer.from(stateParam, "base64url").toString("utf8"));
  } catch {
    state = { role: "customer", next: "/home" };
  }

  const redirectUri = new URL("/api/auth/google/callback", url.origin).toString();
  const profile = await exchangeGoogleCode(code, redirectUri);
  if (!profile?.sub || !profile.email) {
    return NextResponse.redirect(new URL("/login?error=oauth_failed", url.origin));
  }

  const role: Role = isValidRole(state.role) ? state.role : "customer";

  let userId = findUserByGoogle(profile.sub, profile.email)?.id ?? null;

  if (!userId) {
    const firstName = profile.given_name ?? profile.name?.split(" ")[0] ?? "";
    const lastName = profile.family_name ?? profile.name?.split(" ").slice(1).join(" ") ?? "";
    const username = makeUsername(firstName, lastName, profile.email);

    // Google accounts carry a verified email; treat that as the 18+ signal
    // unless a stricter policy is configured. Recorded as `is_18_plus`.
    userId = createUser({
      role,
      email: profile.email,
      googleId: profile.sub,
      username,
      firstName,
      lastName,
      is18Plus: true,
    });
  } else {
    linkGoogle(userId, profile.sub);
  }

  // A brand-new Google account may still need to complete its profile.
  const complete = get<{ first_name: string; city: string }>(
    "SELECT first_name, city FROM users WHERE id = :id",
    { id: userId }
  );
  const needsOnboarding = !complete?.first_name || !complete?.city;

  await createSession(userId);

  const target = needsOnboarding && role === "trade" ? "/me" : state.next || "/home";
  return NextResponse.redirect(new URL(target, url.origin));
}
