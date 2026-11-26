import "server-only";

import { z } from "zod";

import { isMobileToken } from "@/lib/auth/mobile/credentials";
import { maxMobileGoogleIdTokenLength } from "@/lib/auth/mobile/google-verification";

export const mobileChallengeRequest = z.object({}).strict();

export const mobileExchangeRequest = z.object({
  challengeId: z.string(),
  idToken: z.string().min(1).max(maxMobileGoogleIdTokenLength),
}).strict();

// A present string with the wrong credential format is an auth rejection for refresh.
export const mobileRefreshRequest = z.object({ refreshToken: z.string() }).strict();

export const mobileLogoutRequest = z.object({
  refreshToken: z.string().refine((token) => isMobileToken("refresh", token)),
}).strict();
