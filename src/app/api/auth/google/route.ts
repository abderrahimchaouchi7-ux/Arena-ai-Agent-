import { NextRequest, NextResponse } from "next/server";
import { googleAuthUrl, googleConfigured } from "@/lib/auth";
import { isValidRole } from "@/lib/config";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const role = url.searchParams.get("role") ?? "customer";
  const next = url.searchParams.get("next") ?? "/home";

  if (!googleConfigured()) {
    // No API key configured — send the visitor to the documented demo sign-in.
    return NextResponse.redirect(new URL(`/login?demo=1&role=${role}`, url.origin));
  }

  const redirectUri = new URL("/api/auth/google/callback", url.origin).toString();
  const state = Buffer.from(JSON.stringify({ role: isValidRole(role) ? role : "customer", next })).toString(
    "base64url"
  );

  const res = NextResponse.redirect(googleAuthUrl(redirectUri, state));
  res.cookies.set("rabt_oauth_state", state, { path: "/", httpOnly: true, maxAge: 600 });
  return res;
}
