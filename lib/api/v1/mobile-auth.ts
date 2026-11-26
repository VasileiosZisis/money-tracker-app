import "server-only";

import type { z } from "zod";

import { isMobileChallengeId, isMobileToken } from "@/lib/auth/mobile/credentials";
import { isMobileAuthApiEnabled } from "@/lib/auth/mobile/enablement";
import { admitMobileRateLimit, type MobileSourceRateLimitPolicy } from "@/lib/auth/mobile/rate-limit";
import { identifyMobileRequestSource } from "@/lib/auth/mobile/request-source";
import {
  exchangeMobileGoogleProof,
  issueMobileAuthChallenge,
  logoutMobileSession,
  rotateMobileRefresh,
} from "@/lib/auth/mobile/session-service";
import {
  mobileChallengeRequest,
  mobileExchangeRequest,
  mobileLogoutRequest,
  mobileRefreshRequest,
} from "@/lib/validators/mobile-auth";

import { apiData, apiError, apiNoContent, createApiRequestId, mobileMethodNotAllowed } from "./http";
import { parseApiJsonObject } from "./json-request";
import { mobileAuthFailure } from "./mobile-auth-errors";

function mobileAuthPost<Shape extends z.ZodRawShape>(
  schema: z.ZodObject<Shape, "strict">,
  handler: (request: Request, requestId: string, input: z.output<z.ZodObject<Shape, "strict">>) => Promise<Response>,
) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return mobileMethodNotAllowed();

    const requestId = createApiRequestId();
    if (!isMobileAuthApiEnabled()) return apiError(requestId, "TEMPORARILY_UNAVAILABLE");

    try {
      if (new URL(request.url).search) return apiError(requestId, "INVALID_REQUEST");
      const body = await parseApiJsonObject(request);
      if (!body.ok) return apiError(requestId, body.code);

      // Check own schema properties before Zod so prototype member names are unknown too.
      if (Object.keys(body.value).some((key) => !Object.hasOwn(schema.shape, key))) {
        return apiError(requestId, "INVALID_REQUEST");
      }
      const input = schema.safeParse(body.value);
      if (!input.success) return apiError(requestId, "INVALID_REQUEST");
      return await handler(request, requestId, input.data);
    } catch {
      return apiError(requestId, "INTERNAL_ERROR");
    }
  };
}

async function admitSource(request: Request, requestId: string, policy: MobileSourceRateLimitPolicy) {
  const source = identifyMobileRequestSource(request.headers);
  if (source.status !== "identified") return mobileAuthFailure(requestId, source);

  const admission = await admitMobileRateLimit({ policy, source: source.source });
  return admission.status === "allowed" ? null : mobileAuthFailure(requestId, admission);
}

function tokenResponse(requestId: string, tokens: {
  accessToken: string;
  accessExpiresAt: Date;
  refreshToken: string;
  refreshExpiresAt: Date;
}) {
  return apiData(requestId, {
    accessToken: tokens.accessToken,
    accessTokenExpiresAt: tokens.accessExpiresAt.toISOString(),
    refreshToken: tokens.refreshToken,
    refreshTokenExpiresAt: tokens.refreshExpiresAt.toISOString(),
  });
}

export const mobileChallengePost = mobileAuthPost(mobileChallengeRequest, async (request, requestId) => {
  const denied = await admitSource(request, requestId, "challenge_source");
  if (denied) return denied;

  const result = await issueMobileAuthChallenge();
  if (result.status !== "issued") return mobileAuthFailure(requestId, result);
  return apiData(requestId, {
    challengeId: result.challengeId,
    nonce: result.nonce,
    expiresAt: result.expiresAt.toISOString(),
  });
});

export const mobileExchangePost = mobileAuthPost(mobileExchangeRequest, async (request, requestId, input) => {
  if (!isMobileChallengeId(input.challengeId)) return mobileAuthFailure(requestId, { status: "invalid_proof" });

  const denied = await admitSource(request, requestId, "exchange_source");
  if (denied) return denied;

  const challengeAdmission = await admitMobileRateLimit({ policy: "exchange_challenge", challengeId: input.challengeId });
  if (challengeAdmission.status !== "allowed") {
    return mobileAuthFailure(requestId, challengeAdmission, { challengeScope: true });
  }

  const result = await exchangeMobileGoogleProof(input);
  return result.status === "authenticated"
    ? tokenResponse(requestId, result.tokens) : mobileAuthFailure(requestId, result);
});

export const mobileRefreshPost = mobileAuthPost(mobileRefreshRequest, async (request, requestId, input) => {
  if (!isMobileToken("refresh", input.refreshToken)) {
    return mobileAuthFailure(requestId, { status: "invalid_credential" });
  }

  const denied = await admitSource(request, requestId, "refresh_source");
  if (denied) return denied;

  const result = await rotateMobileRefresh(input.refreshToken);
  return result.status === "rotated"
    ? tokenResponse(requestId, result.tokens) : mobileAuthFailure(requestId, result);
});

export const mobileLogoutPost = mobileAuthPost(mobileLogoutRequest, async (request, requestId, input) => {
  const denied = await admitSource(request, requestId, "logout_source");
  if (denied) return denied;

  const result = await logoutMobileSession(input.refreshToken);
  return result.status === "logged_out" ? apiNoContent(requestId) : mobileAuthFailure(requestId, result);
});
