import "server-only";

import type { MobileRateLimitResult } from "@/lib/auth/mobile/rate-limit";

import { apiError, type ApiErrorCode } from "./http";

const failureCodes = {
  invalid_proof: "GOOGLE_AUTH_FAILED",
  invalid_nonce: "GOOGLE_AUTH_FAILED",
  account_not_linked: "WEB_ACCOUNT_REQUIRED",
  invalid_credential: "UNAUTHENTICATED",
  credential_reused: "UNAUTHENTICATED",
  malformed_credential: "INVALID_REQUEST",
  configuration_error: "INTERNAL_ERROR",
  verification_error: "INTERNAL_ERROR",
  source_unavailable: "TEMPORARILY_UNAVAILABLE",
  provider_unavailable: "TEMPORARILY_UNAVAILABLE",
  database_unavailable: "TEMPORARILY_UNAVAILABLE",
  capacity_unavailable: "TEMPORARILY_UNAVAILABLE",
  rate_limited: "RATE_LIMITED",
  scope_unavailable: "INTERNAL_ERROR",
} as const satisfies Record<string, ApiErrorCode>;

type RateFailure = Exclude<MobileRateLimitResult, { status: "allowed" }>;
type MobileAuthFailure = RateFailure | {
  status: Exclude<keyof typeof failureCodes, RateFailure["status"]>;
};

export function mobileAuthFailure(requestId: string, failure: MobileAuthFailure, options?: {
  challengeScope?: boolean;
  bearerChallenge?: boolean;
}): Response {
  const code = failure.status === "scope_unavailable" && options?.challengeScope
    ? "GOOGLE_AUTH_FAILED" : failureCodes[failure.status];
  return apiError(requestId, code, {
    retryAfterSeconds: "retryAfterSeconds" in failure ? failure.retryAfterSeconds : undefined,
    bearerChallenge: options?.bearerChallenge,
  });
}
