import "server-only";

import { randomUUID } from "node:crypto";

const errors = {
  INVALID_REQUEST: { status: 400, message: "The request is invalid." },
  UNAUTHENTICATED: { status: 401, message: "Authentication is required." },
  GOOGLE_AUTH_FAILED: { status: 401, message: "Google authentication could not be completed." },
  WEB_ACCOUNT_REQUIRED: { status: 403, message: "Sign in on the web before using the mobile app." },
  METHOD_NOT_ALLOWED: { status: 405, message: "The request method is unsupported." },
  REQUEST_TOO_LARGE: { status: 413, message: "The request body is too large." },
  UNSUPPORTED_MEDIA_TYPE: { status: 415, message: "The request representation is unsupported." },
  RATE_LIMITED: { status: 429, message: "Too many requests." },
  INTERNAL_ERROR: { status: 500, message: "The request could not be completed." },
  TEMPORARILY_UNAVAILABLE: { status: 503, message: "The service is temporarily unavailable." },
} as const;

export type ApiErrorCode = keyof typeof errors;

export function createApiRequestId(): string {
  return randomUUID();
}

function responseHeaders(requestId: string): Headers {
  return new Headers({ "Cache-Control": "private, no-store", "X-Request-Id": requestId });
}

export function apiData(requestId: string, data: unknown, status = 200): Response {
  return Response.json({ data }, { status, headers: responseHeaders(requestId) });
}

export function apiNoContent(requestId: string): Response {
  return new Response(null, { status: 204, headers: responseHeaders(requestId) });
}

export function apiError(requestId: string, code: ApiErrorCode, options?: {
  retryAfterSeconds?: number;
  bearerChallenge?: boolean;
  allowPost?: boolean;
}): Response {
  const { status, message } = errors[code];
  const headers = responseHeaders(requestId);
  const delay = options?.retryAfterSeconds;
  if (delay !== undefined && Number.isSafeInteger(delay) && delay > 0) headers.set("Retry-After", String(delay));
  if (options?.bearerChallenge && status === 401) headers.set("WWW-Authenticate", "Bearer");
  if (options?.allowPost) headers.set("Allow", "POST");
  return Response.json({ error: { code, message, requestId } }, { status, headers });
}

export function mobileMethodNotAllowed(): Response {
  return apiError(createApiRequestId(), "METHOD_NOT_ALLOWED", { allowPost: true });
}
