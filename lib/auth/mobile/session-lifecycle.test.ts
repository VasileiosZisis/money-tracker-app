import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { register } from "node:module";
import { beforeEach, mock, test } from "node:test";

import { digestKey, fake, initialTime, resetLifecycleTestDatabase } from "./lifecycle-test-db";

const overrides = new Map([
  ["server-only", "data:text/javascript,export%20%7B%7D"],
  ["@/lib/db", new URL("./lifecycle-test-db.ts", import.meta.url).href],
]);
const resolver = `
let overrides;
export function initialize(data) { overrides = data; }
export function resolve(specifier, context, nextResolve) {
  const url = overrides.get(specifier);
  return url ? { url, shortCircuit: true } : nextResolve(specifier, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(resolver)}`, { data: overrides });

const { createMobileChallengeId, createMobileToken, digestMobileNonce, digestMobileToken, isMobileChallengeId } = await import("./credentials");
const {
  authenticateMobileAccess, exchangeMobileGoogleProof, issueMobileAuthChallenge, logoutMobileSession,
  revokeMobileSessionById, rotateMobileRefresh,
} = await import("./session-service");
const { cleanupExpiredMobileAuthRecords } = await import("./cleanup-service");

const audience = "100000000001-fixture-mobile.apps.googleusercontent.com";
const presenter = "100000000002-fixture-android.apps.googleusercontent.com";
const googleSubject = "fictional-mobile-subject";
const userId = "fixture-user";
const nonce = "ab".repeat(32);
const kid = "lifecycle-fixture-key";
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
const minute = 60_000;
const day = 24 * 60 * minute;
const expiry = (offset: number) => new Date(initialTime + offset);
let failGoogleKeys = false;

mock.timers.enable({ apis: ["Date"], now: initialTime });
mock.method(globalThis, "fetch", async (url: RequestInfo | URL) => {
  assert.equal(url.toString(), "https://www.googleapis.com/oauth2/v1/certs");
  fake.trace.push("google.keys");
  assert.equal(fake.inTransaction, false, "Google must be called outside any transaction");
  return failGoogleKeys
    ? Response.json({}, { status: 503 })
    : Response.json({ [kid]: pem }, { headers: { "cache-control": "max-age=0" } });
});

beforeEach(() => {
  resetLifecycleTestDatabase();
  failGoogleKeys = false;
  process.env.MOBILE_GOOGLE_AUDIENCE = audience;
  process.env.MOBILE_GOOGLE_ALLOWED_PRESENTERS = presenter;
  process.env.MOBILE_RATE_LIMIT_KEY_SECRET = Buffer.alloc(32, 61).toString("base64url");
  fake.state.users.add(userId);
  fake.state.accounts.set(googleSubject, userId);
});

function nonceDigest(value = nonce) {
  return digestMobileNonce(value) ?? assert.fail("Invalid nonce fixture");
}

function tokenDigest(purpose: "access" | "refresh", token: string) {
  return digestMobileToken(purpose, token) ?? assert.fail("Invalid token fixture");
}

function signGoogleProof(claims: Record<string, unknown> = {}, validSignature = true) {
  const second = initialTime / 1000;
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ alg: "RS256", kid });
  const payload = encode({
    sub: googleSubject, nonce, iss: "https://accounts.google.com",
    iat: second - 1, exp: second + 60, aud: audience, azp: presenter, ...claims,
  });
  const signed = `${header}.${payload}`;
  const signature = sign("RSA-SHA256", Buffer.from(signed), keys.privateKey);
  if (!validSignature) signature[0] ^= 1;
  return `${signed}.${signature.toString("base64url")}`;
}

function seedChallenge({
  expiresAt = expiry(5 * minute), consumedAt = null,
}: { expiresAt?: Date; consumedAt?: Date | null } = {}) {
  const challengeId = createMobileChallengeId();
  fake.state.challenges.set(challengeId, {
    id: challengeId, nonceDigest: nonceDigest(), createdAt: expiry(-minute), expiresAt, consumedAt,
  });
  return challengeId;
}

function seedSession(id: string, {
  owner = userId,
  absoluteExpiresAt = expiry(30 * day),
  accessExpiresAt = expiry(10 * minute),
  refreshExpiresAt = expiry(14 * day),
  revokedAt = null,
}: { owner?: string; absoluteExpiresAt?: Date; accessExpiresAt?: Date; refreshExpiresAt?: Date; revokedAt?: Date | null } = {}) {
  const accessToken = createMobileToken("access");
  const refreshToken = createMobileToken("refresh");
  const digest = tokenDigest("refresh", refreshToken);
  fake.state.sessions.set(id, {
    id, userId: owner, createdAt: expiry(-day), accessTokenDigest: tokenDigest("access", accessToken),
    accessExpiresAt, absoluteExpiresAt, revokedAt,
  });
  fake.state.refresh.set(digestKey(digest), {
    tokenDigest: digest, sessionId: id, issuedAt: expiry(-day), expiresAt: refreshExpiresAt, consumedAt: null,
  });
  return { accessToken, refreshToken, refreshDigestKey: digestKey(digest) };
}

function assertNoExchangeWrites(challengeId: string) {
  assert.equal(fake.state.challenges.get(challengeId)?.consumedAt, null);
  assert.equal(fake.state.sessions.size, 0);
  assert.equal(fake.state.refresh.size, 0);
}

test("challenge issuance uses the database clock, persists only the digest and returns after commit", async () => {
  fake.now += 12_345;
  const result = await issueMobileAuthChallenge();
  assert.ok(result.status === "issued");
  assert.ok(isMobileChallengeId(result.challengeId));
  const stored = fake.state.challenges.get(result.challengeId);
  assert.deepEqual(stored, {
    id: result.challengeId, nonceDigest: nonceDigest(result.nonce), createdAt: new Date(fake.now),
    expiresAt: new Date(fake.now + 5 * minute), consumedAt: null,
  });
  assert.deepEqual(result.expiresAt, stored?.expiresAt);
  assert.deepEqual(fake.trace, ["tx.begin", "tx.settings", "tx.settings", "clock", "challenge.create", "tx.beforeCommit", "tx.commit", "tx.afterCommit"]);
});

test("challenge issuance with a failed write or an ambiguous commit returns no secret", async () => {
  fake.failAt = "challenge.create";
  assert.deepEqual(await issueMobileAuthChallenge(), { status: "database_unavailable" });
  assert.equal(fake.state.challenges.size, 0);

  fake.failAt = "tx.afterCommit";
  assert.deepEqual(await issueMobileAuthChallenge(), { status: "database_unavailable" });
  assert.equal(fake.state.challenges.size, 1);
});

test("missing, expired and consumed challenges cannot proceed to Google or a transaction", async () => {
  const unavailable = [createMobileChallengeId(), seedChallenge({ expiresAt: expiry(0) }), seedChallenge({ consumedAt: expiry(-1) })];
  for (const challengeId of unavailable) {
    assert.deepEqual(await exchangeMobileGoogleProof({ challengeId, idToken: signGoogleProof() }), { status: "invalid_proof" });
  }
  assert.deepEqual(await exchangeMobileGoogleProof({ challengeId: "bad", idToken: signGoogleProof() }), { status: "invalid_proof" });
  assert.deepEqual(await exchangeMobileGoogleProof({ challengeId: seedChallenge(), idToken: "x".repeat(16 * 1024 + 1) }), { status: "invalid_proof" });
  const read = ["tx.begin", "tx.settings", "tx.settings", "challenge.read", "tx.beforeCommit", "tx.commit", "tx.afterCommit"];
  assert.deepEqual(fake.trace, [...read, ...read, ...read]);
});

test("invalid Google signatures and nonces leave a live challenge available", async () => {
  const challengeId = seedChallenge();
  assert.deepEqual(await exchangeMobileGoogleProof({ challengeId, idToken: signGoogleProof({}, false) }), { status: "invalid_proof" });
  assert.deepEqual(await exchangeMobileGoogleProof({ challengeId, idToken: signGoogleProof({ nonce: "cd".repeat(32) }) }), { status: "invalid_nonce" });
  assertNoExchangeWrites(challengeId);
  assert.equal(fake.trace.includes("challenge.lock"), false);
});

test("Google configuration, certificate failures and database outages are distinct from invalid proofs", async () => {
  const challengeId = seedChallenge();
  const input = { challengeId, idToken: signGoogleProof() };
  delete process.env.MOBILE_GOOGLE_AUDIENCE;
  assert.deepEqual(await exchangeMobileGoogleProof(input), { status: "configuration_error" });
  process.env.MOBILE_GOOGLE_AUDIENCE = audience;
  failGoogleKeys = true;
  assert.deepEqual(await exchangeMobileGoogleProof(input), { status: "provider_unavailable" });
  fake.failAt = "challenge.read";
  assert.deepEqual(await exchangeMobileGoogleProof(input), { status: "database_unavailable" });
  assertNoExchangeWrites(challengeId);
});

test("linked exchange pins the exact account and creates only digests and one session after challenge consumption", async () => {
  const challengeId = seedChallenge();
  const result = await exchangeMobileGoogleProof({ challengeId, idToken: signGoogleProof() });
  assert.ok(result.status === "authenticated", `Unexpected result: ${result.status}`);
  assert.deepEqual(fake.trace, [
    "tx.begin", "tx.settings", "tx.settings", "challenge.read", "tx.beforeCommit", "tx.commit", "tx.afterCommit",
    "google.keys", "tx.begin", "tx.settings", "tx.settings", "challenge.lock", "account.read",
    "user.lock", "account.lock", "clock", "challenge.consume", "session.create", "refresh.create",
    "tx.beforeCommit", "tx.commit", "tx.afterCommit",
  ]);
  assert.deepEqual(fake.sql.find(({ step }) => step === "challenge.lock")?.values, [challengeId]);
  assert.deepEqual(fake.sql.find(({ step }) => step === "account.lock")?.values, [googleSubject, userId]);
  assert.deepEqual(fake.state.challenges.get(challengeId)?.consumedAt, expiry(0));
  const session = fake.state.sessions.get("session-1");
  assert.deepEqual(session, {
    id: "session-1", userId, createdAt: expiry(0), absoluteExpiresAt: expiry(30 * day),
    accessTokenDigest: tokenDigest("access", result.tokens.accessToken), accessExpiresAt: expiry(10 * minute), revokedAt: null,
  });
  const digest = tokenDigest("refresh", result.tokens.refreshToken);
  assert.deepEqual(fake.state.refresh.get(digestKey(digest)), {
    tokenDigest: digest, sessionId: "session-1", issuedAt: expiry(0), expiresAt: expiry(14 * day), consumedAt: null,
  });
  assert.equal(fake.state.sessions.size, 1);
  assert.deepEqual(await exchangeMobileGoogleProof({ challengeId, idToken: signGoogleProof() }), { status: "invalid_proof" });
});

test("verified but unknown Google subject consumes the challenge without creating an account or session", async () => {
  const challengeId = seedChallenge();
  const input = { challengeId, idToken: signGoogleProof({ sub: "unknown-fictional-subject" }) };
  assert.deepEqual(await exchangeMobileGoogleProof(input), { status: "account_not_linked" });
  assert.deepEqual(fake.state.challenges.get(challengeId)?.consumedAt, expiry(0));
  assert.deepEqual(Array.from(fake.state.users), [userId]);
  assert.deepEqual(Array.from(fake.state.accounts), [[googleSubject, userId]]);
  assert.equal(fake.state.sessions.size + fake.state.refresh.size, 0);
  assert.equal(fake.trace.includes("tx.commit"), true);
  assert.equal(fake.trace.includes("user.lock"), false);
  assert.deepEqual(await exchangeMobileGoogleProof(input), { status: "invalid_proof" });
});

test("proof and challenge expiry are rechecked with the wall clock after account locking", async () => {
  for (const [challengeExpiry, expected] of [[5 * minute, minute], [1, 1]]) {
    resetLifecycleTestDatabase();
    fake.state.users.add(userId);
    fake.state.accounts.set(googleSubject, userId);
    const challengeId = seedChallenge({ expiresAt: expiry(challengeExpiry) });
    fake.onStep = (step) => { if (step === "account.lock") fake.now += expected; };
    assert.deepEqual(await exchangeMobileGoogleProof({ challengeId, idToken: signGoogleProof() }), { status: "invalid_proof" });
    assertNoExchangeWrites(challengeId);
    assert.ok(fake.trace.indexOf("clock") > fake.trace.indexOf("account.lock"));
  }
});

test("exchange rejects a nonce mismatch or consumption in the authoritative locked row", async () => {
  const challengeId = seedChallenge();
  fake.onStep = (step, state) => {
    if (step === "challenge.lock") {
      const row = state.challenges.get(challengeId);
      if (row) row.nonceDigest = nonceDigest("fa".repeat(32));
    }
  };
  assert.deepEqual(await exchangeMobileGoogleProof({ challengeId, idToken: signGoogleProof() }), { status: "invalid_nonce" });
  assertNoExchangeWrites(challengeId);

  fake.trace.length = 0;
  fake.state.challenges.set(challengeId, {
    id: challengeId, nonceDigest: nonceDigest(), createdAt: expiry(-minute), expiresAt: expiry(minute), consumedAt: null,
  });
  fake.onStep = (step, state) => {
    if (step === "challenge.lock") {
      const row = state.challenges.get(challengeId);
      if (row) row.consumedAt = expiry(-1);
    }
  };
  assert.deepEqual(await exchangeMobileGoogleProof({ challengeId, idToken: signGoogleProof() }), { status: "invalid_proof" });
  assert.equal(fake.trace.includes("account.read"), false);
  assert.equal(fake.state.sessions.size, 0);
});

test("a deleted user or changed account mapping aborts a linked exchange", async () => {
  const challengeId = seedChallenge();
  fake.onStep = (step, state) => {
    if (step === "user.lock") state.users.delete(userId);
  };
  const input = { challengeId, idToken: signGoogleProof() };
  assert.deepEqual(await exchangeMobileGoogleProof(input), { status: "database_unavailable" });
  assertNoExchangeWrites(challengeId);
  assert.equal(fake.trace.includes("tx.rollback"), true);

  fake.trace.length = 0;
  fake.onStep = (step, state) => {
    if (step === "account.lock") state.accounts.set(googleSubject, "untrusted-replacement");
  };
  assert.deepEqual(await exchangeMobileGoogleProof(input), { status: "database_unavailable" });
  assertNoExchangeWrites(challengeId);
  assert.equal(fake.trace.includes("tx.rollback"), true);
});

test("a failed exchange write or unexpected consumption count rolls back and returns no credentials", async () => {
  const challengeId = seedChallenge();
  const input = { challengeId, idToken: signGoogleProof() };
  fake.failAt = "refresh.create";
  assert.deepEqual(await exchangeMobileGoogleProof(input), { status: "database_unavailable" });
  assertNoExchangeWrites(challengeId);
  assert.equal(fake.trace.includes("tx.rollback"), true);

  fake.trace.length = 0;
  fake.failAt = "";
  fake.zeroAt = "challenge.consume";
  assert.deepEqual(await exchangeMobileGoogleProof(input), { status: "database_unavailable" });
  assertNoExchangeWrites(challengeId);
  assert.equal(fake.trace.includes("session.create"), false);
});

test("access authentication is a fresh lookup returning only the trusted user and session IDs", async () => {
  const { accessToken, refreshToken } = seedSession("device");
  assert.deepEqual(await authenticateMobileAccess(accessToken), { status: "authenticated", userId, sessionId: "device" });
  assert.deepEqual(await authenticateMobileAccess(createMobileToken("access")), { status: "invalid_credential" });
  assert.deepEqual(await authenticateMobileAccess(refreshToken), { status: "invalid_credential" });
  assert.deepEqual(await authenticateMobileAccess(createMobileChallengeId()), { status: "invalid_credential" });
  assert.deepEqual(await authenticateMobileAccess("unrelated cookie"), { status: "invalid_credential" });
  const read = ["tx.begin", "tx.settings", "tx.settings", "access.read", "tx.beforeCommit", "tx.commit", "tx.afterCommit"];
  assert.deepEqual(fake.trace, [...read, ...read]);
  assert.deepEqual(fake.sql.find(({ step }) => step === "access.read")?.values, [tokenDigest("access", accessToken)]);
});

test("access fails at both expiry boundaries, after revocation, after deletion and on database failure", async () => {
  const access = seedSession("access-boundary", { accessExpiresAt: expiry(1) });
  const absolute = seedSession("absolute-boundary", { accessExpiresAt: expiry(1), absoluteExpiresAt: expiry(1) });
  const revoked = seedSession("revoked", { revokedAt: expiry(-1) });
  const deleted = seedSession("deleted");
  assert.equal((await authenticateMobileAccess(access.accessToken)).status, "authenticated");
  fake.now++;
  assert.deepEqual(await authenticateMobileAccess(access.accessToken), { status: "invalid_credential" });
  assert.deepEqual(await authenticateMobileAccess(absolute.accessToken), { status: "invalid_credential" });
  assert.deepEqual(await authenticateMobileAccess(revoked.accessToken), { status: "invalid_credential" });
  fake.state.sessions.delete("deleted");
  assert.deepEqual(await authenticateMobileAccess(deleted.accessToken), { status: "invalid_credential" });
  fake.state.users.delete(userId);
  assert.deepEqual(await authenticateMobileAccess(seedSession("orphan-fixture").accessToken), { status: "invalid_credential" });
  fake.failAt = "access.read";
  assert.deepEqual(await authenticateMobileAccess(access.accessToken), { status: "database_unavailable" });
});

test("refresh rotates the pair, caps both expiries and leaves the original absolute deadline fixed", async () => {
  const deadline = expiry(2 * minute);
  const old = seedSession("device", { absoluteExpiresAt: deadline, accessExpiresAt: deadline, refreshExpiresAt: deadline });
  const result = await rotateMobileRefresh(old.refreshToken);
  assert.ok(result.status === "rotated", `Unexpected result: ${result.status}`);
  assert.deepEqual(result.tokens.accessExpiresAt, deadline);
  assert.deepEqual(result.tokens.refreshExpiresAt, deadline);
  assert.deepEqual(fake.state.sessions.get("device")?.absoluteExpiresAt, deadline);
  assert.deepEqual(fake.state.refresh.get(old.refreshDigestKey)?.consumedAt, expiry(0));
  assert.deepEqual(fake.trace, [
    "tx.begin", "tx.settings", "tx.settings", "refresh.candidate", "session.lock", "refresh.reread", "clock",
    "rate.bucket.lock", "rate.capacity.lock", "rate.bucket.lock", "clock", "rate.bucket.create", "rate.capacity.update", "clock",
    "refresh.consume", "refresh.create", "session.rotate", "tx.beforeCommit", "tx.commit", "tx.afterCommit",
  ]);
  assert.deepEqual(await authenticateMobileAccess(old.accessToken), { status: "invalid_credential" });
  assert.deepEqual(await authenticateMobileAccess(result.tokens.accessToken), { status: "authenticated", userId, sessionId: "device" });
});

test("unknown, malformed, absolutely expired and inactive current refresh credentials fail without revocation", async () => {
  const inactivity = seedSession("inactive", { refreshExpiresAt: expiry(0) });
  const absolute = seedSession("absolute", { absoluteExpiresAt: expiry(0), accessExpiresAt: expiry(0), refreshExpiresAt: expiry(0) });
  for (const token of [inactivity.refreshToken, absolute.refreshToken, createMobileToken("refresh"), inactivity.accessToken]) {
    assert.deepEqual(await rotateMobileRefresh(token), { status: "invalid_credential" });
  }
  assert.equal(fake.trace.includes("session.revoke"), false);
});

test("a post-lock reread detects reuse even beyond the consumed credential's own expiry and commits revocation", async () => {
  const old = seedSession("device", { refreshExpiresAt: expiry(-1) });
  const other = seedSession("other-device");
  fake.onStep = (step, state) => {
    if (step === "session.lock") {
      const row = state.refresh.get(old.refreshDigestKey);
      if (row) row.consumedAt = expiry(-2);
    }
  };
  assert.deepEqual(await rotateMobileRefresh(old.refreshToken), { status: "credential_reused" });
  assert.deepEqual(fake.state.sessions.get("device")?.revokedAt, expiry(0));
  assert.ok(fake.trace.indexOf("session.revoke") < fake.trace.indexOf("tx.commit"));
  assert.deepEqual(await authenticateMobileAccess(old.accessToken), { status: "invalid_credential" });
  assert.equal((await authenticateMobileAccess(other.accessToken)).status, "authenticated");
});

test("refresh rolls back partial writes and an ambiguous commit reveals no successor credentials", async () => {
  const old = seedSession("device");
  fake.zeroAt = "session.rotate";
  assert.deepEqual(await rotateMobileRefresh(old.refreshToken), { status: "database_unavailable" });
  assert.equal(fake.state.refresh.size, 1);
  assert.equal(fake.state.refresh.get(old.refreshDigestKey)?.consumedAt, null);
  assert.equal((await authenticateMobileAccess(old.accessToken)).status, "authenticated");

  fake.zeroAt = "";
  fake.failAt = "tx.afterCommit";
  assert.deepEqual(await rotateMobileRefresh(old.refreshToken), { status: "database_unavailable" });
  assert.deepEqual(fake.state.refresh.get(old.refreshDigestKey)?.consumedAt, expiry(0));
  assert.equal(fake.state.refresh.size, 2);
  fake.failAt = "";
  assert.deepEqual(await rotateMobileRefresh(old.refreshToken), { status: "credential_reused" });
  assert.deepEqual(fake.state.sessions.get("device")?.revokedAt, expiry(0));
});

test("replaying the predecessor after a lost successful response rejects the successor pair", async () => {
  const old = seedSession("device");
  const result = await rotateMobileRefresh(old.refreshToken);
  assert.ok(result.status === "rotated");
  assert.deepEqual(await rotateMobileRefresh(old.refreshToken), { status: "credential_reused" });
  assert.deepEqual(await authenticateMobileAccess(result.tokens.accessToken), { status: "invalid_credential" });
  assert.deepEqual(await rotateMobileRefresh(result.tokens.refreshToken), { status: "invalid_credential" });
});

test("logout accepts current or rotated refresh tokens even after their own expiry and preserves other devices", async () => {
  const current = seedSession("current", { refreshExpiresAt: expiry(0) });
  const previous = seedSession("rotated", { refreshExpiresAt: expiry(1) });
  const independent = seedSession("independent");
  const rotated = await rotateMobileRefresh(previous.refreshToken);
  assert.ok(rotated.status === "rotated");
  fake.now++;

  assert.deepEqual(await logoutMobileSession(current.refreshToken), { status: "logged_out" });
  assert.deepEqual(await logoutMobileSession(previous.refreshToken), { status: "logged_out" });
  assert.deepEqual(await logoutMobileSession(previous.refreshToken), { status: "logged_out" });
  assert.deepEqual(await logoutMobileSession(createMobileToken("refresh")), { status: "logged_out" });
  assert.deepEqual(await logoutMobileSession(previous.accessToken), { status: "malformed_credential" });
  assert.deepEqual(await authenticateMobileAccess(rotated.tokens.accessToken), { status: "invalid_credential" });
  assert.equal((await authenticateMobileAccess(independent.accessToken)).status, "authenticated");
  assert.equal(fake.state.refresh.size, 4);
  assert.equal(fake.trace.filter((step) => step === "session.revoke").length, 2);
});

test("logout reports database failures and treats absolute expiry as idempotent without writing", async () => {
  const live = seedSession("live");
  const expired = seedSession("expired", { absoluteExpiresAt: expiry(0), accessExpiresAt: expiry(0), refreshExpiresAt: expiry(0) });
  fake.failAt = "session.revoke";
  assert.deepEqual(await logoutMobileSession(live.refreshToken), { status: "database_unavailable" });
  assert.equal(fake.state.sessions.get("live")?.revokedAt, null);
  assert.deepEqual(await logoutMobileSession(expired.refreshToken), { status: "logged_out" });
  assert.equal(fake.state.sessions.get("expired")?.revokedAt, null);
});

test("a committed logout or administrative revocation blocks an otherwise live refresh", async () => {
  const device = seedSession("logged-out-first");
  const managed = seedSession("revoked-first");

  assert.deepEqual(await logoutMobileSession(device.refreshToken), { status: "logged_out" });
  assert.deepEqual(await revokeMobileSessionById("revoked-first"), { status: "revoked" });
  assert.deepEqual(await rotateMobileRefresh(device.refreshToken), { status: "invalid_credential" });
  assert.deepEqual(await rotateMobileRefresh(managed.refreshToken), { status: "invalid_credential" });
  assert.equal(fake.trace.includes("refresh.consume"), false);
  assert.equal(fake.state.refresh.size, 2);
});

test("trusted revocation shares the session lock, binds the ID as a parameter and is idempotent", async () => {
  const id = "session-fixture'--";
  const target = seedSession(id);
  const other = seedSession("other");
  assert.deepEqual(await revokeMobileSessionById(id), { status: "revoked" });
  assert.deepEqual(await revokeMobileSessionById(id), { status: "no_change" });
  assert.deepEqual(await revokeMobileSessionById("unknown"), { status: "no_change" });
  const lock = fake.sql.find(({ step }) => step === "session.lock");
  assert.deepEqual(lock?.values, [id]);
  assert.equal(lock?.statement.includes(id), false);
  assert.deepEqual(await rotateMobileRefresh(target.refreshToken), { status: "invalid_credential" });
  assert.equal((await authenticateMobileAccess(other.accessToken)).status, "authenticated");
});

test("cleanup bounds each batch, prunes only absolutely expired history and never cascades a large history", async () => {
  const pinnedChallenge = seedChallenge({ expiresAt: expiry(1), consumedAt: expiry(-1) });
  for (let i = 0; i < 52; i++) seedChallenge({ expiresAt: expiry(0) });
  const heavyId = "oldest'--";
  seedSession(heavyId, { absoluteExpiresAt: expiry(-1), accessExpiresAt: expiry(-1), refreshExpiresAt: expiry(-1) });
  const keep = seedSession("revoked-but-before-absolute", { revokedAt: expiry(-1), refreshExpiresAt: expiry(-1) });
  const history = fake.state.refresh.get(keep.refreshDigestKey);
  assert.ok(history);
  history.consumedAt = expiry(-2);
  for (let i = 0; i < 210; i++) {
    const token = tokenDigest("refresh", createMobileToken("refresh"));
    fake.state.refresh.set(digestKey(token), {
      tokenDigest: token, sessionId: heavyId, issuedAt: expiry(-day), expiresAt: expiry(-1), consumedAt: expiry(-2),
    });
  }
  for (let i = 0; i < 21; i++) {
    seedSession(`other-expired-${String(i).padStart(2, "0")}`, {
      absoluteExpiresAt: expiry(0), accessExpiresAt: expiry(0), refreshExpiresAt: expiry(0),
    });
  }

  const first = await cleanupExpiredMobileAuthRecords();
  assert.deepEqual(first, { status: "cleaned", challengesDeleted: 50, refreshCredentialsDeleted: 200, sessionsDeleted: 0 });
  assert.ok(fake.state.sessions.has(heavyId));
  assert.equal(fake.state.challenges.size, 3);
  const childDelete = fake.sql.find(({ step }) => step === "cleanup.refresh.delete");
  assert.equal(childDelete?.statement.includes(heavyId), false);
  assert.equal(childDelete?.values[0], heavyId);
  assert.equal(childDelete?.values.length, 21);
  assert.equal(childDelete?.values.at(-1), 200);
  assert.deepEqual(fake.sql.find(({ step }) => step === "cleanup.challenge.lock")?.values, [50]);
  assert.deepEqual(fake.sql.find(({ step }) => step === "cleanup.session.lock")?.values, [20]);

  assert.deepEqual(await cleanupExpiredMobileAuthRecords(), {
    status: "cleaned", challengesDeleted: 2, refreshCredentialsDeleted: 30, sessionsDeleted: 20,
  });
  assert.equal(fake.state.sessions.has(heavyId), false);
  assert.equal(fake.state.refresh.has(keep.refreshDigestKey), true);
  assert.equal(fake.state.challenges.has(pinnedChallenge), true);
  assert.equal(fake.state.sessions.size, 3);
});
