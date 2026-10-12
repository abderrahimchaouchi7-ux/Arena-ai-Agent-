import { ok } from "@/lib/api";
import { googleConfigured } from "@/lib/auth";

/** Public, non-secret client configuration. */
export async function GET() {
  return ok({ googleEnabled: googleConfigured() });
}
