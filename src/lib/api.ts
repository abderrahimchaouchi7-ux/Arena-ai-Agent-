import { NextResponse } from "next/server";
import { getCurrentUser, type SessionUser } from "./auth";
import { UploadError } from "./media";

export function ok(data: any, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(code: string, status = 400, extra: Record<string, any> = {}) {
  return NextResponse.json({ error: code, ...extra }, { status });
}

export class ApiError extends Error {
  status: number;
  constructor(code: string, status = 400) {
    super(code);
    this.status = status;
  }
}

/** Standardised error envelope so the client can map `error` to a translation. */
export function handleError(e: unknown) {
  if (e instanceof ApiError) return fail(e.message, e.status);
  if (e instanceof UploadError) return fail(e.code, 400);
  console.error("[api]", e);
  return fail("SERVER_ERROR", 500);
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError("UNAUTHORIZED", 401);
  return user;
}

export async function requireTrade(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role !== "trade") throw new ApiError("TRADE_ONLY", 403);
  return user;
}

export async function readJson<T = any>(req: Request): Promise<T> {
  try {
    return await req.json();
  } catch {
    throw new ApiError("BAD_JSON", 400);
  }
}

export async function readForm(req: Request): Promise<FormData> {
  try {
    return await req.formData();
  } catch {
    throw new ApiError("BAD_FORM", 400);
  }
}

export function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

export function int(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10);
  return Number.isFinite(n) ? n : fallback;
}
