import crypto from "node:crypto";
import { cookies } from "next/headers";
import { db, get, run } from "./db";
import type { Role } from "./config";

export const SESSION_COOKIE = "rabt_session";
const SESSION_DAYS = 30;

/* ------------------------------------------------------------------ */
/* Passwords — scrypt from node:crypto (no bcrypt dependency)          */
/* ------------------------------------------------------------------ */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const dk = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${dk}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;
  const [scheme, salt, dk] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !dk) return false;
  const test = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(dk, "hex");
  if (test.length !== expected.length) return false;
  return crypto.timingSafeEqual(test, expected);
}

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

export async function createSession(userId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  run("INSERT INTO sessions (token, user_id, expires_at) VALUES (:t, :u, :e)", {
    t: token,
    u: userId,
    e: expires.toISOString(),
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
  return token;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) run("DELETE FROM sessions WHERE token = :t", { t: token });
  jar.delete(SESSION_COOKIE);
}

export type SessionUser = {
  id: number;
  role: Role;
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  avatar_media: number | null;
  lang: string;
  is_18_plus: number;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = get<SessionUser>(
    `SELECT u.id, u.role, u.email, u.username, u.first_name, u.last_name,
            u.avatar_media, u.lang, u.is_18_plus
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token = :t AND s.expires_at > datetime('now')`,
    { t: token }
  );
  return row ?? null;
}

/* ------------------------------------------------------------------ */
/* Usernames                                                           */
/* ------------------------------------------------------------------ */

function slug(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "")
    .slice(0, 24);
}

export function makeUsername(first: string, last: string, email: string): string {
  const base = slug([first, last].filter(Boolean).join(".")) || slug(email.split("@")[0]) || "artisan";
  let candidate = base;
  let n = 1;
  while (get("SELECT 1 FROM users WHERE username = :u", { u: candidate })) {
    n += 1;
    candidate = `${base}${n}`;
  }
  return candidate;
}

/* ------------------------------------------------------------------ */
/* Google Sign-In                                                      */
/* ------------------------------------------------------------------ */

export const googleConfigured = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export function googleAuthUrl(redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export type GoogleProfile = {
  sub: string;
  email: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
};

/** Exchange the OAuth code for an ID token and decode it. */
export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<GoogleProfile | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) return null;

  const json = (await res.json()) as { id_token?: string };
  if (!json.id_token) return null;

  // The id_token comes straight back from Google's token endpoint over TLS,
  // so decoding the payload (base64url JSON) is sufficient here.
  const [, payload] = json.id_token.split(".");
  const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  return decoded as GoogleProfile;
}

/* ------------------------------------------------------------------ */
/* Account lookup / provisioning                                       */
/* ------------------------------------------------------------------ */

export function findUserByGoogle(sub: string, email: string) {
  return get<{ id: number }>(
    "SELECT id FROM users WHERE google_id = :g OR (lower(email) = lower(:e) AND :e <> '')",
    { g: sub, e: email }
  );
}

export function linkGoogle(userId: number, sub: string) {
  run("UPDATE users SET google_id = :g WHERE id = :id AND (google_id IS NULL OR google_id = :g)", {
    g: sub,
    id: userId,
  });
}

export function createUser(args: {
  role: Role;
  email: string;
  password?: string;
  googleId?: string;
  username: string;
  firstName?: string;
  lastName?: string;
  birthdate?: string | null;
  is18Plus?: boolean;
  lang?: string;
}): number {
  const info = run(
    `INSERT INTO users (role, email, password_hash, google_id, username,
                        first_name, last_name, birthdate, is_18_plus, lang)
     VALUES (:role, :email, :pw, :gid, :username, :fn, :ln, :bd, :adult, :lang)`,
    {
      role: args.role,
      email: args.email.toLowerCase().trim(),
      pw: args.password ? hashPassword(args.password) : null,
      gid: args.googleId ?? null,
      username: args.username,
      fn: args.firstName ?? "",
      ln: args.lastName ?? "",
      bd: args.birthdate ?? null,
      adult: args.is18Plus ? 1 : 0,
      lang: args.lang ?? "fr",
    }
  );

  const id = Number(info.lastInsertRowid);
  if (args.role === "trade") {
    run("INSERT INTO trade_profiles (user_id) VALUES (:id)", { id });
  }
  return id;
}

/* ------------------------------------------------------------------ */
/* Language cookie                                                     */
/* ------------------------------------------------------------------ */

export const LANG_COOKIE = "rabt_lang";

export async function readLangCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(LANG_COOKIE)?.value ?? null;
}
