import "server-only";

import { createHmac, createSecretKey, type KeyObject } from "node:crypto";

type MobileRateLimitScope = "source" | "challenge" | "session" | "account";

export function readMobileRateLimitSecret(
  env: Readonly<Record<string, string | undefined>> = process.env,
): KeyObject | null {
  const encoded = env.MOBILE_RATE_LIMIT_KEY_SECRET;
  if (encoded?.length !== 43 || /[^A-Za-z0-9_-]/.test(encoded)) return null;

  const bytes = Buffer.from(encoded, "base64url");
  if (bytes.length !== 32 || bytes.toString("base64url") !== encoded) return null;
  return createSecretKey(bytes);
}

export function deriveMobileRateLimitKey(
  secret: KeyObject,
  policy: string,
  scope: MobileRateLimitScope,
  identity: string,
): Buffer<ArrayBuffer> {
  return createHmac("sha256", secret)
    .update(`cashcontour:mobile:rate-limit:v1\0${scope}\0${policy}\0`, "utf8")
    .update(identity, "utf8")
    .digest();
}
