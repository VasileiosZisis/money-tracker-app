import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { register } from "node:module";
import test from "node:test";

// Only the plain Node test worker substitutes Next.js's server-only marker.
const resolver = `
export function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return { url: "data:text/javascript,export%20%7B%7D", shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(resolver)}`);

const {
  createMobileChallengeId,
  createMobileNonce,
  createMobileToken,
  digestMobileNonce,
  digestMobileToken,
  isMobileChallengeId,
} = await import("./credentials");
const {
  getMobileChallengeExpiry,
  getMobileCredentialExpiries,
  getMobileSessionDeadline,
  isMobileExpiryReached,
} = await import("./expiry");

const fixtureBytes = Buffer.alloc(32);
const encoded = fixtureBytes.toString("base64url");
const nonce = fixtureBytes.toString("hex");

test("each credential encodes 32 random bytes in its distinct canonical format", () => {
  const access = createMobileToken("access");
  const refresh = createMobileToken("refresh");
  const challengeId = createMobileChallengeId();
  const generatedNonce = createMobileNonce();

  assert.match(access, /^ma1\.[A-Za-z0-9_-]{43}$/);
  assert.match(refresh, /^mr1\.[A-Za-z0-9_-]{43}$/);
  assert.match(challengeId, /^mc1\.[A-Za-z0-9_-]{43}$/);
  for (const value of [access, refresh, challengeId]) {
    assert.equal(Buffer.from(value.slice(4), "base64url").length, 32);
  }
  assert.match(generatedNonce, /^[a-f0-9]{64}$/);
  assert.equal(Buffer.from(generatedNonce, "hex").length, 32);

  assert.equal(digestMobileToken("access", access)?.length, 32);
  assert.equal(digestMobileToken("refresh", refresh)?.length, 32);
  assert.equal(digestMobileNonce(generatedNonce)?.length, 32);
  assert.ok(isMobileChallengeId(challengeId));
});

test("digests are stable and purpose separated even for identical decoded bytes", () => {
  const access = digestMobileToken("access", `ma1.${encoded}`);
  const refresh = digestMobileToken("refresh", `mr1.${encoded}`);
  const nonceDigest = digestMobileNonce(nonce);
  for (const [purpose, actual] of [["access", access], ["refresh", refresh], ["nonce", nonceDigest]]) {
    const expected = createHash("sha256")
      .update(`cashcontour:mobile:v1:${purpose}\0`)
      .update(fixtureBytes)
      .digest();
    assert.deepEqual(actual, expected);
  }
  assert.deepEqual(digestMobileToken("access", `ma1.${encoded}`), access);
  assert.deepEqual(digestMobileToken("refresh", `mr1.${encoded}`), refresh);
  assert.deepEqual(digestMobileNonce(nonce), nonceDigest);
  assert.notDeepEqual(access, refresh);
  assert.notDeepEqual(access, nonceDigest);
  assert.notDeepEqual(refresh, nonceDigest);
});

test("wrong-purpose values are rejected despite identical payloads", () => {
  const access = `ma1.${encoded}`;
  const refresh = `mr1.${encoded}`;
  const challengeId = `mc1.${encoded}`;

  assert.equal(digestMobileToken("refresh", access), null);
  assert.equal(digestMobileToken("access", refresh), null);
  assert.equal(digestMobileToken("access", challengeId), null);
  assert.equal(digestMobileToken("refresh", nonce), null);
  assert.equal(digestMobileNonce(access), null);
  assert.equal(isMobileChallengeId(access), false);
});

test("malformed and noncanonical opaque values are rejected", () => {
  const alias = `${encoded.slice(0, -1)}B`;
  assert.deepEqual(Buffer.from(alias, "base64url"), fixtureBytes);
  for (const payload of [encoded.slice(1), `${encoded}=`, `${encoded}\n`, `+${encoded.slice(1)}`, `${encoded.slice(1)}\n`, alias]) {
    assert.equal(digestMobileToken("access", `ma1.${payload}`), null);
    assert.equal(digestMobileToken("refresh", `mr1.${payload}`), null);
    assert.equal(isMobileChallengeId(`mc1.${payload}`), false);
  }
  assert.equal(digestMobileToken("access", `MA1.${encoded}`), null);
  assert.equal(digestMobileToken("access", null), null);
  assert.equal(digestMobileToken("refresh", { token: `mr1.${encoded}` }), null);
  assert.equal(isMobileChallengeId(42), false);
});

test("nonce digests require canonical lowercase hex with no whitespace", () => {
  const lowercase = "ab".repeat(32);
  assert.equal(digestMobileNonce(lowercase)?.length, 32);
  for (const value of [lowercase.toUpperCase(), lowercase.slice(1), `${lowercase.slice(1)}\n`, `zz${lowercase.slice(2)}`, undefined]) {
    assert.equal(digestMobileNonce(value), null);
  }
});

const issuedAt = new Date("2026-10-25T02:58:00.123+03:00");

function assertExpiryBoundary(expiresAt: Date, expectedIso: string) {
  assert.equal(expiresAt.toISOString(), expectedIso);
  assert.equal(isMobileExpiryReached(expiresAt, new Date(expiresAt.getTime() - 1)), false);
  assert.equal(isMobileExpiryReached(expiresAt, expiresAt), true);
  assert.equal(isMobileExpiryReached(expiresAt, new Date(expiresAt.getTime() + 1)), true);
}

test("challenge expires at exactly five elapsed minutes", () => {
  assertExpiryBoundary(getMobileChallengeExpiry(issuedAt), "2026-10-25T00:03:00.123Z");
});

test("initial access and refresh expire at their UTC elapsed-time boundaries", () => {
  const deadline = getMobileSessionDeadline(issuedAt);
  assertExpiryBoundary(deadline, "2026-11-23T23:58:00.123Z");
  const expiries = getMobileCredentialExpiries(issuedAt, deadline);
  assert.ok(expiries);
  assertExpiryBoundary(expiries.accessExpiresAt, "2026-10-25T00:08:00.123Z");
  assertExpiryBoundary(expiries.refreshExpiresAt, "2026-11-07T23:58:00.123Z");
});

test("successive renewals extend inactivity only up to the original deadline", () => {
  const deadline = getMobileSessionDeadline(issuedAt);
  const firstRenewal = getMobileCredentialExpiries(new Date("2026-11-05T00:00:00Z"), deadline);
  assert.ok(firstRenewal);
  assert.equal(firstRenewal.refreshExpiresAt.toISOString(), "2026-11-19T00:00:00.000Z");

  const secondRenewal = getMobileCredentialExpiries(new Date("2026-11-18T00:00:00Z"), deadline);
  assert.ok(secondRenewal);
  assert.equal(secondRenewal.accessExpiresAt.toISOString(), "2026-11-18T00:10:00.000Z");
  assert.deepEqual(secondRenewal.refreshExpiresAt, deadline);

  const lastRenewal = getMobileCredentialExpiries(new Date(deadline.getTime() - 1), deadline);
  assert.deepEqual(lastRenewal, { accessExpiresAt: deadline, refreshExpiresAt: deadline });
  assert.equal(getMobileCredentialExpiries(deadline, deadline), null);
  assert.equal(getMobileCredentialExpiries(new Date(deadline.getTime() + 1), deadline), null);
});

test("invalid instants cannot authorize renewal", () => {
  const invalid = new Date(NaN);
  assert.equal(isMobileExpiryReached(issuedAt, invalid), true);
  assert.equal(isMobileExpiryReached(invalid, issuedAt), true);
  assert.equal(getMobileCredentialExpiries(issuedAt, invalid), null);
  assert.equal(getMobileCredentialExpiries(invalid, issuedAt), null);
});
