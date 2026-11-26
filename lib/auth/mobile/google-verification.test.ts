import assert from "node:assert/strict";
import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { createRequire, register } from "node:module";
import { beforeEach, mock, test } from "node:test";

import { OAuth2Client } from "google-auth-library";

const audience = "100000000001-test-mobile.apps.googleusercontent.com";
const presenter = "100000000002-test-android.apps.googleusercontent.com";
const webClient = "100000000003-test-web.apps.googleusercontent.com";
const nonce = "ab".repeat(32);
const subject = "Fictional.Google-Subject";
const email = "fictional@example.invalid";
const kid = "fixture-signing-key";
const signingKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const otherKeys = generateKeyPairSync("rsa", { modulusLength: 2048 });

function publicKeyPem(key: KeyObject): string {
  return key.export({ type: "spki", format: "pem" }).toString();
}

const accounts = [
  { provider: "google", providerAccountId: subject, userId: "internal-user-id", email },
  { provider: "other", providerAccountId: "other-provider-subject", userId: "other-user-id", email },
];
const findUnique = mock.fn(async (query: {
  where: { provider_providerAccountId: { provider: string; providerAccountId: string } };
  select: { userId: true };
}) => {
  const { provider, providerAccountId } = query.where.provider_providerAccountId;
  const account = accounts.find((row) => row.provider === provider && row.providerAccountId === providerAccountId);
  return account ? { userId: account.userId } : null;
});
export const db = { account: { findUnique } };

// Next's bundler unwraps this CommonJS default import. Use that same export in the Node worker.
const loadCommonJs = createRequire(import.meta.url);
export const googleProvider = loadCommonJs("next-auth/providers/google").default;
const overrides = new Map([
  ["server-only", "data:text/javascript,export%20%7B%7D"],
  ["@/lib/db", import.meta.url],
  ["next-auth/providers/google", `data:text/javascript,${encodeURIComponent(
    `export { googleProvider as default } from ${JSON.stringify(import.meta.url)};`,
  )}`],
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

const { readMobileGoogleConfig } = await import("./google-config");
const { digestMobileNonce } = await import("./credentials");
const { verifyMobileGoogleProof } = await import("./google-verification");
const expectedDigest = digestMobileNonce(nonce) ?? assert.fail("Invalid nonce fixture");

let nowMs = Date.parse("2026-11-26T12:00:00.000Z");
mock.timers.enable({ apis: ["Date"], now: nowMs });

function certificateResponse(certs: Record<string, string> = { [kid]: publicKeyPem(signingKeys.publicKey) }) {
  return Response.json(certs, { headers: { "cache-control": "public, max-age=60" } });
}

let fetchKeys: (init?: RequestInit) => Response | Promise<Response> = () => certificateResponse();
const fetchMock = mock.method(globalThis, "fetch", async (url: RequestInfo | URL, init?: RequestInit) => {
  assert.equal(url.toString(), "https://www.googleapis.com/oauth2/v1/certs");
  assert.equal(init?.cache, "no-store");
  assert.equal(init?.redirect, "error");
  return fetchKeys(init);
});

beforeEach(() => {
  nowMs += 120_000;
  mock.timers.setTime(nowMs);
  process.env.MOBILE_GOOGLE_AUDIENCE = audience;
  process.env.MOBILE_GOOGLE_ALLOWED_PRESENTERS = presenter;
  fetchKeys = () => certificateResponse();
  fetchMock.mock.resetCalls();
  findUnique.mock.resetCalls();
});

function signCompactToken(encodedHeader: string, encodedPayload: string, privateKey = signingKeys.privateKey) {
  const signed = `${encodedHeader}.${encodedPayload}`;
  return `${signed}.${sign("RSA-SHA256", Buffer.from(signed), privateKey).toString("base64url")}`;
}

function token(
  claims: Record<string, unknown> = {},
  header: Record<string, unknown> = {},
  privateKey = signingKeys.privateKey,
) {
  const second = Math.floor(Date.now() / 1000);
  const payload = {
    iss: "https://accounts.google.com",
    aud: audience,
    azp: presenter,
    iat: second - 30,
    exp: second + 600,
    sub: subject,
    nonce,
    ...claims,
  };
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return signCompactToken(encode({ alg: "RS256", kid, ...header }), encode(payload), privateKey);
}

async function verifiedProof(idToken = token()) {
  const result = await verifyMobileGoogleProof(idToken, expectedDigest);
  assert.ok(result.status === "verified", `Expected a verified proof, got ${result.status}`);
  return result.proof;
}

test("mobile config requires one dedicated audience and an explicit list of distinct presenters", () => {
  assert.deepEqual(readMobileGoogleConfig({
    MOBILE_GOOGLE_AUDIENCE: ` ${audience} `,
    MOBILE_GOOGLE_ALLOWED_PRESENTERS: `${presenter}, ${audience}`,
  }), { status: "configured", config: { audience, allowedPresenters: new Set([presenter, audience]) } });

  for (const invalidAudience of [undefined, "", "invalid", `${audience},${webClient}`, `https://${audience}`]) {
    assert.deepEqual(readMobileGoogleConfig({
      MOBILE_GOOGLE_AUDIENCE: invalidAudience,
      MOBILE_GOOGLE_ALLOWED_PRESENTERS: presenter,
    }), { status: "configuration_error" });
  }

  for (const invalidPresenters of [undefined, "", " ", "*", "invalid", `${presenter},`, `${presenter},${presenter}`]) {
    assert.deepEqual(readMobileGoogleConfig({
      MOBILE_GOOGLE_AUDIENCE: audience,
      MOBILE_GOOGLE_ALLOWED_PRESENTERS: invalidPresenters,
    }), { status: "configuration_error" });
  }
});

test("missing mobile config does not borrow legacy settings or break import of web auth options", async () => {
  delete process.env.MOBILE_GOOGLE_AUDIENCE;
  delete process.env.MOBILE_GOOGLE_ALLOWED_PRESENTERS;
  process.env.GOOGLE_CLIENT_ID = webClient;
  process.env.GOOGLE_CLIENT_SECRET = "fictional-web-client-secret";
  process.env.NEXTAUTH_SECRET = "fictional-web-auth-secret";
  process.env.GOOGLE_PROOF_AUDIENCE = audience;
  process.env.GOOGLE_PROOF_ALLOWED_PRESENTERS = presenter;

  const { authOptions } = await import("../options");
  assert.equal(authOptions.session?.strategy, "jwt");
  assert.equal(authOptions.providers[0].id, "google");
  assert.deepEqual(await verifyMobileGoogleProof(token(), expectedDigest), { status: "configuration_error" });
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("Google's verifier validates a real offline RSA signature and returns only the required proof", async () => {
  const exp = Math.floor(Date.now() / 1000) + 180;
  const proof = await verifiedProof(token({
    exp,
    email,
    name: "Fictional profile",
    picture: "https://example.invalid/profile",
    refresh_token: "fictional-refresh",
  }, { jku: "https://example.invalid/keys" }));

  assert.deepEqual(Object.keys(proof).sort(), ["expiresAtMs", "nonceDigest", "subject"]);
  assert.equal(proof.subject, subject);
  assert.equal(proof.expiresAtMs, exp * 1000);
  assert.deepEqual(proof.nonceDigest, expectedDigest);
  proof.nonceDigest.fill(0);
  assert.deepEqual(proof.nonceDigest, expectedDigest);
  assert.equal(fetchMock.mock.callCount(), 1);
});

test("both documented issuers and absent or explicitly allowed presenters work only for a single audience", async () => {
  await verifiedProof(token({ iss: "accounts.google.com", azp: undefined }));
  await verifiedProof(token({ azp: presenter }));
  for (const claims of [
    { iss: "https://example.invalid" }, { aud: webClient }, { aud: undefined },
    { aud: [audience] }, { aud: [audience, webClient], azp: undefined }, { aud: { audience } },
    { azp: "" }, { azp: null }, { azp: 42 }, { azp: ` ${presenter}` }, { azp: webClient },
  ]) {
    assert.deepEqual(await verifyMobileGoogleProof(token(claims), expectedDigest), { status: "invalid_proof" });
  }
});

test("malformed compact tokens, mismatched signatures, and unsupported headers fail", async () => {
  for (const candidate of [
    undefined, "", "not-a-jwt", "eyJhbGciOiJSUzI1NiJ9.bm90LWpzb24.YQ", `${token()}=`,
    token({}, { alg: "HS256" }), token({}, { kid: undefined }), token({}, { kid: "unrecognized" }),
    token({}, { crit: ["unknown-extension"] }), token({}, {}, otherKeys.privateKey),
  ]) {
    assert.deepEqual(await verifyMobileGoogleProof(candidate, expectedDigest), { status: "invalid_proof" });
  }
});

test("BOM-prefixed header and payload JSON are rejected before certificate retrieval", async () => {
  const [header, payload] = token().split(".");
  const withBom = (segment: string) => Buffer.concat([
    Buffer.from("\uFEFF"),
    Buffer.from(segment, "base64url"),
  ]).toString("base64url");

  for (const candidate of [signCompactToken(withBom(header), payload), signCompactToken(header, withBom(payload))]) {
    assert.deepEqual(await verifyMobileGoogleProof(candidate, expectedDigest), { status: "invalid_proof" });
  }
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("subjects must be present, visible case-sensitive ASCII and at most 255 characters", async () => {
  assert.equal((await verifiedProof(token({ sub: "X".repeat(255) }))).subject, "X".repeat(255));
  for (const sub of [undefined, "", 42, "   ", ` ${subject}`, "subjéct", "X".repeat(256), "test\u007f"]) {
    assert.deepEqual(await verifyMobileGoogleProof(token({ sub }), expectedDigest), { status: "invalid_proof" });
  }
});

test("expiry is exclusive and ignores the library's late-use skew window", async () => {
  const exp = Math.floor(Date.now() / 1000) + 10;
  const candidate = token({ exp });
  mock.timers.setTime(exp * 1000 - 1);
  await verifiedProof(candidate);
  mock.timers.setTime(exp * 1000);
  assert.deepEqual(await verifyMobileGoogleProof(candidate, expectedDigest), { status: "invalid_proof" });
  mock.timers.setTime(exp * 1000 + 1);
  assert.deepEqual(await verifyMobileGoogleProof(candidate, expectedDigest), { status: "invalid_proof" });
});

test("expiration, issued-at, and optional not-before claims must meet the strict NumericDate policy", async () => {
  const second = Math.floor(Date.now() / 1000);
  await verifiedProof(token({ iat: second + 300, nbf: second }));
  for (const claims of [
    { exp: undefined }, { exp: "9999999999" }, { exp: second + 0.5 }, { exp: second + 86_400 },
    { iat: undefined }, { iat: `${second}` }, { iat: second + 301 }, { iat: second + 30, exp: second + 30 },
    { nbf: second + 1 }, { nbf: `${second}` }, { nbf: null },
  ]) {
    assert.deepEqual(await verifyMobileGoogleProof(token(claims), expectedDigest), { status: "invalid_proof" });
  }
});

test("the server checks the canonical signed nonce against the expected digest", async () => {
  await verifiedProof();
  for (const value of [undefined, "", nonce.toUpperCase(), nonce.slice(1), "cd".repeat(32), 42]) {
    assert.deepEqual(await verifyMobileGoogleProof(token({ nonce: value }), expectedDigest), { status: "invalid_nonce" });
  }
  assert.deepEqual(await verifyMobileGoogleProof(token(), Buffer.alloc(31)), { status: "verification_error" });
  assert.deepEqual(await verifyMobileGoogleProof(token(), Buffer.alloc(32)), { status: "invalid_nonce" });
});

test("the Google certificate cache is reused and refreshed after max-age for a rotated key", async () => {
  await verifiedProof();
  await verifiedProof();
  assert.equal(fetchMock.mock.callCount(), 1);

  const rotatedKid = "fixture-rotated-key";
  fetchKeys = () => certificateResponse({ [rotatedKid]: publicKeyPem(otherKeys.publicKey) });
  mock.timers.setTime(nowMs + 61_000);
  await verifiedProof(token({}, { kid: rotatedKid }, otherKeys.privateKey));
  assert.equal(fetchMock.mock.callCount(), 2);
});

test("a proof expiring during certificate retrieval is rejected before use", async () => {
  const exp = Math.floor(Date.now() / 1000) + 10;
  fetchKeys = () => {
    mock.timers.setTime(exp * 1000);
    return certificateResponse();
  };
  assert.deepEqual(await verifyMobileGoogleProof(token({ exp }), expectedDigest), { status: "invalid_proof" });
});

test("certificate HTTP failure, malformed responses, and timeouts produce a safe provider outcome without retries", async (t) => {
  const errorMessage = "synthetic-private-provider-details";
  const log = t.mock.method(console, "log", () => {});
  const errorLog = t.mock.method(console, "error", () => {});
  const warn = t.mock.method(console, "warn", () => {});

  fetchKeys = () => Response.json({ error: errorMessage }, { status: 503 });
  assert.deepEqual(await verifyMobileGoogleProof(token(), expectedDigest), { status: "provider_unavailable" });
  assert.equal(fetchMock.mock.callCount(), 1);
  fetchKeys = () => Response.json([]);
  assert.deepEqual(await verifyMobileGoogleProof(token(), expectedDigest), { status: "provider_unavailable" });
  assert.equal(fetchMock.mock.callCount(), 2);

  const timeout = t.mock.method(AbortSignal, "timeout", (duration: number) => {
    assert.equal(duration, 5_000);
    return AbortSignal.abort(new DOMException(errorMessage, "TimeoutError"));
  });
  fetchKeys = (init) => {
    assert.ok(init?.signal?.aborted);
    throw init.signal.reason;
  };
  assert.deepEqual(await verifyMobileGoogleProof(token(), expectedDigest), { status: "provider_unavailable" });
  assert.equal(timeout.mock.callCount(), 1);
  assert.equal(fetchMock.mock.callCount(), 3);
  assert.equal(log.mock.callCount() + errorLog.mock.callCount() + warn.mock.callCount(), 0);
});

test("an unclassified library exception is a safe internal error even if its text contains token data", async (t) => {
  const idToken = token();
  t.mock.method(OAuth2Client.prototype, "verifySignedJwtWithCertsAsync", async () => {
    throw new Error(`Invalid token signature: ${idToken} fictional private information`);
  });
  assert.deepEqual(await verifyMobileGoogleProof(idToken, expectedDigest), { status: "verification_error" });
});

test("the resolver reads only userId through the exact existing Google provider and subject compound key", async () => {
  const { findMobileGoogleAccount } = await import("./google-account");
  const proof = await verifiedProof();
  assert.deepEqual(await findMobileGoogleAccount(proof), { status: "linked", userId: "internal-user-id" });
  assert.deepEqual(findUnique.mock.calls[0].arguments, [{
    where: { provider_providerAccountId: { provider: "google", providerAccountId: subject } },
    select: { userId: true },
  }]);

  for (const sub of ["other-provider-subject", "unknown", subject.toLowerCase()]) {
    const otherProof = await verifiedProof(token({ sub, email }));
    assert.deepEqual(await findMobileGoogleAccount(otherProof), { status: "account_not_linked" });
  }
  assert.equal(findUnique.mock.callCount(), 4);
});

test("only an original verified proof can reach the database, whose errors are distinct from missing accounts", async (t) => {
  const { findMobileGoogleAccount } = await import("./google-account");
  const proof = await verifiedProof();
  assert.deepEqual(await findMobileGoogleAccount({ ...proof }), { status: "invalid_proof" });
  assert.equal(findUnique.mock.callCount(), 0);

  const transactionRead = mock.fn(async () => { throw new Error("fictional database access details"); });
  const transaction = { account: { findUnique: transactionRead } };
  const log = t.mock.method(console, "error", () => {});
  assert.deepEqual(
    await findMobileGoogleAccount(proof, transaction as unknown as Parameters<typeof findMobileGoogleAccount>[1]),
    { status: "database_unavailable" },
  );
  assert.equal(transactionRead.mock.callCount(), 1);
  assert.equal(findUnique.mock.callCount(), 0);
  assert.equal(log.mock.callCount(), 0);
});
