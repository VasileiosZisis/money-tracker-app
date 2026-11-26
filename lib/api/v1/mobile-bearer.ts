import "server-only";

import { isMobileToken } from "@/lib/auth/mobile/credentials";
import { isMobileAuthApiEnabled } from "@/lib/auth/mobile/enablement";
import { authenticateMobileAccess } from "@/lib/auth/mobile/session-service";

import { apiError, createApiRequestId } from "./http";
import { mobileAuthFailure } from "./mobile-auth-errors";

type MobileBearerResult =
  | { status: "authenticated"; requestId: string; identity: { userId: string; sessionId: string } }
  | { status: "rejected"; response: Response };

export async function requireMobileBearer(request: Pick<Request, "headers">): Promise<MobileBearerResult> {
  const requestId = createApiRequestId();
  if (!isMobileAuthApiEnabled()) {
    return { status: "rejected", response: apiError(requestId, "TEMPORARILY_UNAVAILABLE") };
  }

  try {
    const header = request.headers.get("authorization");
    const token = header && /^Bearer +([^ ,\t]+)$/i.exec(header)?.[1];
    if (!isMobileToken("access", token)) {
      return {
        status: "rejected",
        response: mobileAuthFailure(requestId, { status: "invalid_credential" }, { bearerChallenge: true }),
      };
    }

    const result = await authenticateMobileAccess(token);
    if (result.status !== "authenticated") {
      return { status: "rejected", response: mobileAuthFailure(requestId, result, { bearerChallenge: true }) };
    }
    return { status: "authenticated", requestId, identity: { userId: result.userId, sessionId: result.sessionId } };
  } catch {
    return { status: "rejected", response: apiError(requestId, "INTERNAL_ERROR") };
  }
}
