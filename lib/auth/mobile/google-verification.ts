import "server-only";

import { timingSafeEqual } from "node:crypto";
import { OAuth2Client } from "google-auth-library";

import { digestMobileNonce } from "./credentials";
import { readMobileGoogleConfig } from "./google-config";

const googleIssuers = ["accounts.google.com", "https://accounts.google.com"];
export const maxMobileGoogleIdTokenLength = 16 * 1024;
const maxFutureExpirySeconds = 24 * 60 * 60;
const allowedIssuedAtSkewSeconds = 5 * 60;
const digestByteLength = 32;
// Preserve any BOM so JSON.parse rejects it just as it does in the Node Google verifier.
const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const proofBrand: unique symbol = Symbol("VerifiedMobileGoogleProof");

export type VerifiedMobileGoogleProof = Readonly<{
  [proofBrand]: true;
  subject: string;
  expiresAtMs: number;
  nonceDigest: Uint8Array;
}>;

export type MobileGoogleVerification =
  | { status: "verified"; proof: VerifiedMobileGoogleProof }
  | { status: "invalid_proof" | "invalid_nonce" | "configuration_error" | "provider_unavailable" | "verification_error" };

const verifiedProofs = new WeakSet<VerifiedMobileGoogleProof>();
let googleClient: OAuth2Client | undefined;

function getGoogleClient(): OAuth2Client {
  return googleClient ??= new OAuth2Client({
    useAuthRequestParameters: false,
    transporterOptions: {
      timeout: 5_000,
      retryConfig: { retry: 0 },
      fetchImplementation: (url, init) => fetch(url, { ...init, cache: "no-store", redirect: "error" }),
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function readJsonSegment(bytes: Buffer): Record<string, unknown> | null {
  try {
    const json: unknown = JSON.parse(utf8.decode(bytes));
    return isRecord(json) ? json : null;
  } catch {
    return null;
  }
}

function decodeSegment(segment: string): Buffer | null {
  if (!segment || /[^A-Za-z0-9_-]/.test(segment)) return null;
  const bytes = Buffer.from(segment, "base64url");
  return bytes.toString("base64url") === segment ? bytes : null;
}

function readCompactToken(token: string) {
  const segments = token.split(".");
  if (segments.length !== 3) return null;

  const headerBytes = decodeSegment(segments[0]);
  const payloadBytes = decodeSegment(segments[1]);
  if (!headerBytes || !payloadBytes || !decodeSegment(segments[2])) return null;

  const header = readJsonSegment(headerBytes);
  if (
    !header || header.alg !== "RS256" || header.crit !== undefined || header.b64 !== undefined ||
    typeof header.kid !== "string" || !header.kid || header.kid.length > 128 || /[^A-Za-z0-9_-]/.test(header.kid)
  ) {
    return null;
  }

  const payload = readJsonSegment(payloadBytes);
  return payload ? { kid: header.kid, payload } : null;
}

function isEpochSecond(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function readIdentityClaims(
  payload: unknown,
  audience: string,
  allowedPresenters: ReadonlySet<string>,
  nowMs: number,
) {
  if (!isRecord(payload)) return null;

  const { iss, aud, sub, exp, iat, nbf, azp } = payload;
  const nowSeconds = nowMs / 1000;
  if (
    typeof iss !== "string" || !googleIssuers.includes(iss) ||
    aud !== audience ||
    typeof sub !== "string" || !sub || sub.length > 255 || /[^!-~]/.test(sub) ||
    !isEpochSecond(exp) || exp <= nowSeconds || exp >= nowSeconds + maxFutureExpirySeconds ||
    !isEpochSecond(iat) || iat >= exp || iat > nowSeconds + allowedIssuedAtSkewSeconds ||
    (nbf !== undefined && (!isEpochSecond(nbf) || nbf > nowSeconds)) ||
    (azp !== undefined && (typeof azp !== "string" || !allowedPresenters.has(azp)))
  ) {
    return null;
  }

  return { subject: sub, expiresAtMs: exp * 1000, nonce: payload.nonce };
}

export function isVerifiedMobileGoogleProof(value: VerifiedMobileGoogleProof): boolean {
  return verifiedProofs.has(value);
}

export async function verifyMobileGoogleProof(
  idToken: unknown,
  expectedNonceDigest: Uint8Array,
): Promise<MobileGoogleVerification> {
  const configuration = readMobileGoogleConfig();
  if (configuration.status !== "configured") return configuration;
  const { audience, allowedPresenters } = configuration.config;

  if (!(expectedNonceDigest instanceof Uint8Array) || expectedNonceDigest.byteLength !== digestByteLength) {
    return { status: "verification_error" };
  }
  const expectedDigest = Buffer.from(expectedNonceDigest);

  if (typeof idToken !== "string" || idToken.length > maxMobileGoogleIdTokenLength) return { status: "invalid_proof" };
  const token = readCompactToken(idToken);
  // The unsigned payload can only cause early rejection. Authority comes from the library's verified ticket.
  if (!token || !readIdentityClaims(token.payload, audience, allowedPresenters, Date.now())) {
    return { status: "invalid_proof" };
  }

  let client;
  try {
    client = getGoogleClient();
  } catch {
    return { status: "verification_error" };
  }

  let certs;
  try {
    const response = await client.getFederatedSignonCertsAsync();
    if (!isRecord(response.certs) || Object.keys(response.certs).length === 0) {
      return { status: "provider_unavailable" };
    }
    certs = response.certs;
  } catch {
    return { status: "provider_unavailable" };
  }

  if (!Object.hasOwn(certs, token.kid)) return { status: "invalid_proof" };
  if (typeof certs[token.kid] !== "string" || !certs[token.kid]) return { status: "provider_unavailable" };

  try {
    const ticket = await client.verifySignedJwtWithCertsAsync(idToken, certs, audience, googleIssuers);
    const claims = readIdentityClaims(ticket.getPayload(), audience, allowedPresenters, Date.now());
    if (!claims) return { status: "invalid_proof" };

    const nonceDigest = digestMobileNonce(claims.nonce);
    if (nonceDigest === null || !timingSafeEqual(nonceDigest, expectedDigest)) {
      return { status: "invalid_nonce" };
    }

    const proof = Object.freeze<VerifiedMobileGoogleProof>({
      [proofBrand]: true,
      subject: claims.subject,
      expiresAtMs: claims.expiresAtMs,
      get nonceDigest() {
        return Buffer.from(nonceDigest);
      },
    });
    verifiedProofs.add(proof);
    return { status: "verified", proof };
  } catch (error) {
    // v11.3.4 throws plain Error for a false signature check. Match only its exact error for this input.
    if (error instanceof Error && error.constructor === Error && error.message === `Invalid token signature: ${idToken}`) {
      return { status: "invalid_proof" };
    }
    return { status: "verification_error" };
  }
}
