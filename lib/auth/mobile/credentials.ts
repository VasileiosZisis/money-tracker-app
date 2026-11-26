import "server-only";

import { createHash, randomBytes } from "node:crypto";

const randomByteLength = 32;
const base64urlLength = 43;
const challengePrefix = "mc1.";
const tokenPrefixes = { access: "ma1.", refresh: "mr1." } as const;

type MobileTokenPurpose = keyof typeof tokenPrefixes;

function createOpaqueValue(prefix: string): string {
  return prefix + randomBytes(randomByteLength).toString("base64url");
}

function decodeOpaqueValue(prefix: string, value: unknown): Buffer | null {
  if (
    typeof value !== "string" ||
    value.length !== prefix.length + base64urlLength ||
    !value.startsWith(prefix)
  ) {
    return null;
  }

  const encoded = value.slice(prefix.length);
  if (/[^A-Za-z0-9_-]/.test(encoded)) return null;

  const bytes = Buffer.from(encoded, "base64url");
  // Node's decoder accepts aliases for the unused bits in the final character.
  return bytes.length === randomByteLength && bytes.toString("base64url") === encoded
    ? bytes
    : null;
}

function digest(purpose: MobileTokenPurpose | "nonce", bytes: Buffer): Buffer<ArrayBuffer> {
  return createHash("sha256")
    .update(`cashcontour:mobile:v1:${purpose}\0`, "utf8")
    .update(bytes)
    .digest();
}

export function createMobileToken(purpose: MobileTokenPurpose): string {
  return createOpaqueValue(tokenPrefixes[purpose]);
}

export function digestMobileToken(purpose: MobileTokenPurpose, value: unknown): Buffer<ArrayBuffer> | null {
  const bytes = decodeOpaqueValue(tokenPrefixes[purpose], value);
  return bytes === null ? null : digest(purpose, bytes);
}

export function isMobileToken(purpose: MobileTokenPurpose, value: unknown): value is string {
  return decodeOpaqueValue(tokenPrefixes[purpose], value) !== null;
}

export function createMobileChallengeId(): string {
  return createOpaqueValue(challengePrefix);
}

export function isMobileChallengeId(value: unknown): value is string {
  return decodeOpaqueValue(challengePrefix, value) !== null;
}

export function createMobileNonce(): string {
  return randomBytes(randomByteLength).toString("hex");
}

export function digestMobileNonce(value: unknown): Buffer<ArrayBuffer> | null {
  if (typeof value !== "string" || value.length !== randomByteLength * 2 || /[^0-9a-f]/.test(value)) {
    return null;
  }

  return digest("nonce", Buffer.from(value, "hex"));
}
