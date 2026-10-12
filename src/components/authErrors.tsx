"use client";

/** Maps API error codes to translation keys shown under a form. */
const MAP: Record<string, string> = {
  BAD_EMAIL: "auth.badEmail",
  SHORT_PASSWORD: "auth.shortPassword",
  EMAIL_TAKEN: "auth.emailTaken",
  BAD_CREDENTIALS: "auth.badCredentials",
  MISSING_FIELDS: "auth.missingFields",
  AGE_REQUIRED: "auth.ageRequired",
  BAD_ROLE: "common.error",
  SERVER_ERROR: "common.error",
  DEMO_CONFLICT: "common.error",
  NO_FILE: "common.error",
  BAD_TYPE: "err.badType",
  TOO_BIG: "err.tooBig",
  PORTFOLIO_FULL: "common.error",
  NEEDS_TRADE: "common.error",
  UNAUTHORIZED: "err.unauthorized",
  FORBIDDEN: "err.forbidden",
  TRADE_ONLY: "err.notTrade",
  SELF_REVIEW: "pub.ownReviewForbidden",
  NOT_FOUND: "err.notFound",
};

export function errorKey(code: string): string {
  return MAP[code] ?? "common.error";
}
