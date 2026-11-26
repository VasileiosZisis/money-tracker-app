import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { createRequire, register } from "node:module";
import { beforeEach, mock, test } from "node:test";

import { digestKey, fake, initialTime, resetLifecycleTestDatabase } from "@/lib/auth/mobile/lifecycle-test-db";

// Use NextAuth's actual CommonJS provider export in the plain Node worker.
const loadCommonJs = createRequire(import.meta.url);
export const googleProvider = loadCommonJs("next-auth/providers/google").default;
const overrides = new Map([
  ["server-only", "data:text/javascript,export%20%7B%7D"],
  ["@/lib/db", new URL("../../auth/mobile/lifecycle-test-db.ts", import.meta.url).href],
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

const challengeRoute = await import("@/app/api/v1/auth/google/challenge/route");
const exchangeRoute = await import("@/app/api/v1/auth/google/exchange/route");
const refreshRoute = await import("@/app/api/v1/auth/refresh/route");
const logoutRoute = await import("@/app/api/v1/auth/logout/route");
const { requireMobileBearer } = await import("./mobile-bearer");
const { createMobileChallengeId, createMobileToken, digestMobileNonce, digestMobileToken } =
  await import("@/lib/auth/mobile/credentials");
const { rotateMobileRefresh } = await import("@/lib/auth/mobile/session-service");

const routes = [challengeRoute, exchangeRoute, refreshRoute, logoutRoute];
const userId = "fixture-api-user";
const subject = "fixture-api-subject";
const nonce = "ab".repeat(32);
const audience = "100000000001-fixture-web.apps.googleusercontent.com";
const presenter = "100000000002-fixture-android.apps.googleusercontent.com";
const kid = "mobile-api-fixture-key";
const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
const minute = 60_000;
const day = 24 * 60 * minute;
const limit = 16 * 1024;
const at = (offset = 0) => new Date(initialTime + offset);
let googleUnavailable = false;

mock.timers.enable({ apis: ["Date"], now: initialTime });
mock.method(globalThis, "fetch", async (url: RequestInfo | URL) => {
  assert.equal(url.toString(), "https://www.googleapis.com/oauth2/v1/certs");
  assert.equal(fake.inTransaction, false);
  fake.trace.push("google.keys");
  return googleUnavailable ? Response.json({}, { status: 503 })
    : Response.json({ [kid]: pem }, { headers: { "cache-control": "max-age=0" } });
});

beforeEach(() => {
  resetLifecycleTestDatabase();
  fake.state.users.add(userId);
  fake.state.accounts.set(subject, userId);
  googleUnavailable = false;
  process.env.VERCEL = "1";
  process.env.VERCEL_ENV = "preview";
  process.env.MOBILE_AUTH_API_ENABLED = "true";
  process.env.MOBILE_RATE_LIMIT_KEY_SECRET = Buffer.alloc(32, 73).toString("base64url");
  process.env.MOBILE_GOOGLE_AUDIENCE = audience;
  process.env.MOBILE_GOOGLE_ALLOWED_PRESENTERS = presenter;
});

function post(body: BodyInit | null, headers: HeadersInit = {}, query = "") {
  const requestHeaders = new Headers({
    "Content-Type": "application/json",
    "x-vercel-forwarded-for": "192.0.2.10",
    "X-Request-Id": "caller-supplied-id",
  });
  new Headers(headers).forEach((value, name) => requestHeaders.set(name, value));
  const init: RequestInit & { duplex: "half" } = { method: "POST", body, headers: requestHeaders, duplex: "half" };
  return new Request(`https://app.example.invalid/api/v1/auth${query}`, init);
}

function commonHeaders(response: Response) {
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  const id = response.headers.get("x-request-id");
  assert.match(id ?? "", /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/);
  return id;
}

async function expectFailure(response: Response, status: number, code: string, delay?: number) {
  assert.equal(response.status, status);
  const id = commonHeaders(response);
  assert.match(response.headers.get("content-type") ?? "", /^application\/json\b/);
  assert.equal(response.headers.get("retry-after"), delay === undefined ? null : String(delay));
  const { error, ...remainder } = await response.json();
  assert.deepEqual(remainder, {});
  assert.deepEqual(Object.keys(error).sort(), ["code", "message", "requestId"]);
  assert.equal(error.code, code);
  assert.equal(error.requestId, id);
  assert.equal(typeof error.message, "string");
  assert.doesNotMatch(error.message, /fictional|SQL|mr1\.|ma1\.|mc1\.|fixture-api/);
  return error.message as string;
}

function digest(purpose: "access" | "refresh", token: string) {
  return digestMobileToken(purpose, token) ?? assert.fail("Invalid fixture token");
}

function challengeFixture(expiresAt = at(4 * minute)) {
  const id = createMobileChallengeId();
  fake.state.challenges.set(id, {
    id, nonceDigest: digestMobileNonce(nonce) ?? assert.fail("Invalid fixture nonce"),
    createdAt: at(-minute), expiresAt, consumedAt: null,
  });
  return id;
}

function googleToken(overrides: Record<string, unknown> = {}, valid = true) {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const header = encode({ kid, alg: "RS256" });
  const payload = encode({
    iss: "https://accounts.google.com", sub: subject, aud: audience, azp: presenter, nonce,
    iat: initialTime / 1000 - 1, exp: initialTime / 1000 + 60, ...overrides,
  });
  const input = `${header}.${payload}`;
  const signature = sign("RSA-SHA256", Buffer.from(input), keys.privateKey);
  if (!valid) signature[0] ^= 1;
  return `${input}.${signature.toString("base64url")}`;
}

function sessionFixture(id = "device-a", {
  refreshExpiry = at(14 * day), deadline = at(30 * day), accessExpiry = at(10 * minute), revokedAt = null,
}: { refreshExpiry?: Date; deadline?: Date; accessExpiry?: Date; revokedAt?: Date | null } = {}) {
  const accessToken = createMobileToken("access");
  const refreshToken = createMobileToken("refresh");
  const tokenDigest = digest("refresh", refreshToken);
  const key = digestKey(tokenDigest);
  fake.state.sessions.set(id, {
    id, userId, createdAt: at(-day), absoluteExpiresAt: deadline, accessExpiresAt: accessExpiry,
    accessTokenDigest: digest("access", accessToken), revokedAt,
  });
  fake.state.refresh.set(key, { sessionId: id, tokenDigest, issuedAt: at(-minute), expiresAt: refreshExpiry, consumedAt: null });
  return { accessToken, refreshToken, key };
}

function exchange(challengeId: string, idToken = googleToken()) {
  return exchangeRoute.POST(post(JSON.stringify({ challengeId, idToken })));
}

function withRefreshToken(route: typeof refreshRoute | typeof logoutRoute, refreshToken: string) {
  return route.POST(post(JSON.stringify({ refreshToken })));
}

function ratePolicies() {
  return Array.from(fake.state.buckets.values(), ({ policy }) => policy).sort();
}

async function readTokens(response: Response) {
  assert.equal(response.status, 200);
  commonHeaders(response);
  const { data, ...remainder } = await response.json();
  assert.deepEqual(remainder, {});
  assert.deepEqual(Object.keys(data).sort(), ["accessToken", "accessTokenExpiresAt", "refreshToken", "refreshTokenExpiresAt"]);
  assert.ok(digestMobileToken("access", data.accessToken));
  assert.ok(digestMobileToken("refresh", data.refreshToken));
  return data as { accessToken: string; accessTokenExpiresAt: string; refreshToken: string; refreshTokenExpiresAt: string };
}

test("missing and non-exact enablement values stop every handler and bearer guard before request inspection", async () => {
  for (const flag of [undefined, "", "false", "True", "true ", "1"]) {
    if (flag === undefined) delete process.env.MOBILE_AUTH_API_ENABLED;
    else process.env.MOBILE_AUTH_API_ENABLED = flag;
    const request = post("unread", { "x-mobile-auth-api-enabled": "true" }, "?enabled=true");
    const unexpectedRead = () => assert.fail("A disabled route inspected request data");
    Object.defineProperties(request, { body: { get: unexpectedRead }, headers: { get: unexpectedRead } });
    for (const route of routes) {
      await expectFailure(await route.POST(request), 503, "TEMPORARILY_UNAVAILABLE");
    }
    const result = await requireMobileBearer(request);
    assert.ok(result.status === "rejected");
    await expectFailure(result.response, 503, "TEMPORARILY_UNAVAILABLE");
  }
  assert.deepEqual(fake.trace, []);
});

test("web NextAuth configuration imports without mobile configuration", async () => {
  for (const key of ["MOBILE_AUTH_API_ENABLED", "MOBILE_RATE_LIMIT_KEY_SECRET", "MOBILE_GOOGLE_AUDIENCE", "MOBILE_GOOGLE_ALLOWED_PRESENTERS"]) {
    delete process.env[key];
  }
  process.env.GOOGLE_CLIENT_ID = "fixture-web-id";
  process.env.GOOGLE_CLIENT_SECRET = "fixture-web-secret";
  process.env.NEXTAUTH_SECRET = "fixture-nextauth-secret";
  const { authOptions } = await import("@/lib/auth/options");
  assert.equal(authOptions.session?.strategy, "jwt");
  assert.equal(authOptions.providers[0].id, "google");
});

test("routes are Node-only and dynamic, and method errors carry no-store without auth work", async () => {
  for (const route of routes) {
    assert.equal(route.runtime, "nodejs");
    assert.equal(route.dynamic, "force-dynamic");
    const response = route.OPTIONS();
    assert.equal(response.headers.get("allow"), "POST");
    await expectFailure(response, 405, "METHOD_NOT_ALLOWED");
    await expectFailure(await route.POST(new Request("https://app.example.invalid")), 405, "METHOD_NOT_ALLOWED");
  }
  assert.deepEqual(fake.trace, []);
});

test("strict requests reject malformed JSON, unsafe or duplicate root members and non-object values", async () => {
  for (const body of ["", "{", "null", "0", "true", "[]", '"text"', '{"source":"fake"}', '{"__proto__":{}}', '{"toString":"fake"}']) {
    await expectFailure(await challengeRoute.POST(post(body)), 400, "INVALID_REQUEST");
  }
  for (const body of ['{}', '{"refreshToken":42}', '{"refreshToken":[]}', '{"refreshToken":{}}',
    '{"refreshToken":"first","refreshToken":"second"}', '{"refreshToken":"first","refresh\\u0054oken":"second"}']) {
    await expectFailure(await refreshRoute.POST(post(body)), 400, "INVALID_REQUEST");
  }
  for (const body of ['{}', '{"challengeId":"one","challengeId":"two","idToken":"t"}', '{"challengeId":"one","idToken":[]}']) {
    await expectFailure(await exchangeRoute.POST(post(body)), 400, "INVALID_REQUEST");
  }
  const wrongUtf8 = Uint8Array.from([0x7b, 0xff, 0x7d]);
  await expectFailure(await challengeRoute.POST(post(wrongUtf8)), 400, "INVALID_REQUEST");
  await expectFailure(await challengeRoute.POST(post("{}", {}, "?source=override")), 400, "INVALID_REQUEST");
  assert.deepEqual(fake.trace, []);
});

test("media type and content encoding are explicit, and unsupported representations are never read", async () => {
  const representations: HeadersInit[] = [
    { "content-type": "text/plain" }, { "content-type": "application/json; charset=utf-16" },
    { "content-type": "application/json; unknown=value" }, { "content-encoding": "gzip" },
    { "content-encoding": "identity, identity" },
  ];
  for (const headers of representations) {
    const request = post("{}", headers);
    Object.defineProperty(request, "body", { get: () => assert.fail("Unsupported body was read") });
    await expectFailure(await challengeRoute.POST(request), 415, "UNSUPPORTED_MEDIA_TYPE");
  }
  const missingType = post(null);
  missingType.headers.delete("content-type");
  await expectFailure(await challengeRoute.POST(missingType), 415, "UNSUPPORTED_MEDIA_TYPE");
  assert.deepEqual(fake.trace, []);
  assert.equal((await challengeRoute.POST(post("{}", {
    "content-type": 'Application/JSON; charset="UTF-8"', "content-encoding": "identity",
  }))).status, 200);
});

test("the 16 KiB limit is enforced before reading a large declaration and during actual streamed reads", async () => {
  const declared = post("{}", { "content-length": String(limit + 1) });
  Object.defineProperty(declared, "body", { get: () => assert.fail("Oversized declaration read the body") });
  await expectFailure(await challengeRoute.POST(declared), 413, "REQUEST_TOO_LARGE");

  for (const headers of [new Headers(), new Headers({ "content-length": "2" })]) {
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(limit));
        controller.enqueue(Uint8Array.of(0x20));
      },
      cancel() { cancelled = true; },
    });
    await expectFailure(await challengeRoute.POST(post(stream, headers)), 413, "REQUEST_TOO_LARGE");
    assert.equal(cancelled, true);
  }
  for (const length of ["-1", "2, 2", "1e1", "1"]) {
    await expectFailure(await challengeRoute.POST(post("{}", { "content-length": length })), 400, "INVALID_REQUEST");
  }
  assert.deepEqual(fake.trace, []);
  assert.equal((await challengeRoute.POST(post("{}".padEnd(limit), {
    "content-length": String(limit),
  }))).status, 200);
});

test("multibyte bodies count bytes and preserve the exact size boundary", async () => {
  const empty = '{"refreshToken":""}';
  const padding = "é".repeat(Math.floor((limit - Buffer.byteLength(empty)) / 2));
  const exact = JSON.stringify({ refreshToken: padding }) + " ".repeat((limit - Buffer.byteLength(empty)) % 2);
  assert.equal(Buffer.byteLength(exact), limit);
  await expectFailure(await refreshRoute.POST(post(exact)), 401, "UNAUTHENTICATED");
  await expectFailure(await refreshRoute.POST(post(exact + " ")), 413, "REQUEST_TOO_LARGE");
  assert.deepEqual(fake.trace, []);
});

test("trusted source succeeds before durable challenge creation and response fields are minimal", async () => {
  const response = await challengeRoute.POST(post("{}"));
  assert.equal(response.status, 200);
  const id = commonHeaders(response);
  const { data } = await response.json();
  assert.deepEqual(Object.keys(data).sort(), ["challengeId", "expiresAt", "nonce"]);
  assert.equal(data.expiresAt, at(5 * minute).toISOString());
  assert.ok(fake.state.challenges.has(data.challengeId));
  assert.ok(fake.trace.indexOf("rate.bucket.create") < fake.trace.indexOf("tx.commit"));
  assert.ok(fake.trace.indexOf("tx.commit") < fake.trace.indexOf("challenge.create"));
  assert.deepEqual(ratePolicies(), ["challenge_source"]);
  assert.notEqual(commonHeaders(await challengeRoute.POST(post("{}"))), id);
});

test("source boundary, rate configuration, database and capacity failures stop challenges", async () => {
  const untrusted = post("{}", { "x-forwarded-for": "192.0.2.30" });
  untrusted.headers.delete("x-vercel-forwarded-for");
  await expectFailure(await challengeRoute.POST(untrusted), 503, "TEMPORARILY_UNAVAILABLE");
  delete process.env.MOBILE_RATE_LIMIT_KEY_SECRET;
  await expectFailure(await challengeRoute.POST(post("{}")), 500, "INTERNAL_ERROR");
  process.env.MOBILE_RATE_LIMIT_KEY_SECRET = Buffer.alloc(32, 73).toString("base64url");
  fake.failAt = "rate.capacity.lock";
  await expectFailure(await challengeRoute.POST(post("{}")), 503, "TEMPORARILY_UNAVAILABLE");
  fake.failAt = "";
  fake.state.bucketCount = 10_000;
  await expectFailure(await challengeRoute.POST(post("{}")), 503, "TEMPORARILY_UNAVAILABLE", 5);
  assert.equal(fake.state.challenges.size, 0);
  assert.equal(fake.trace.includes("challenge.create"), false);
});

test("challenge source rejection reports a retry delay without allocating another challenge", async () => {
  for (let i = 0; i < 10; i++) assert.equal((await challengeRoute.POST(post("{}"))).status, 200);
  await expectFailure(await challengeRoute.POST(post("{}")), 429, "RATE_LIMITED", 60);
  assert.equal(fake.state.challenges.size, 10);
});

test("exchange commits source and challenge budgets before Google and serializes only the documented tokens", async () => {
  const id = challengeFixture();
  const data = await readTokens(await exchange(id));
  assert.equal(data.accessTokenExpiresAt, at(10 * minute).toISOString());
  assert.equal(data.refreshTokenExpiresAt, at(14 * day).toISOString());
  assert.deepEqual(ratePolicies(), ["exchange_challenge", "exchange_source"]);
  const beforeGoogle = fake.trace.slice(0, fake.trace.indexOf("google.keys"));
  assert.equal(beforeGoogle.filter((step) => step === "tx.commit").length, 3);
  assert.equal(beforeGoogle.includes("challenge.lock"), false);
  assert.deepEqual(fake.state.challenges.get(id)?.consumedAt, at());
});

test("invalid proofs and nonces consume admission but leave a live challenge unconsumed, and saturation skips Google", async () => {
  const id = challengeFixture();
  for (let i = 0; i < 5; i++) {
    const token = i % 2 === 0 ? googleToken({}, false) : googleToken({ nonce: "cd".repeat(32) });
    await expectFailure(await exchange(id, token), 401, "GOOGLE_AUTH_FAILED");
  }
  await expectFailure(await exchange(id), 429, "RATE_LIMITED", 240);
  assert.equal(fake.trace.filter((step) => step === "google.keys").length, 5);
  assert.equal(fake.state.challenges.get(id)?.consumedAt, null);
  assert.equal(fake.state.sessions.size, 0);
});

test("unknown, expired and consumed challenges allocate no challenge bucket and cannot invoke Google", async () => {
  const consumed = challengeFixture();
  const entry = fake.state.challenges.get(consumed);
  assert.ok(entry);
  entry.consumedAt = at();
  for (const id of [createMobileChallengeId(), challengeFixture(at()), consumed, "malformed"]) {
    await expectFailure(await exchange(id), 401, "GOOGLE_AUTH_FAILED");
  }
  assert.deepEqual(ratePolicies(), ["exchange_source"]);
  assert.equal(fake.trace.includes("challenge.read"), false);
  assert.equal(fake.trace.includes("google.keys"), false);
});

test("exchange source rejection skips challenge admission and Google", async () => {
  for (let i = 0; i < 20; i++) {
    await expectFailure(await exchange(createMobileChallengeId()), 401, "GOOGLE_AUTH_FAILED");
  }
  const id = challengeFixture();
  const probes = fake.trace.filter((step) => step === "rate.challenge.read").length;
  await expectFailure(await exchange(id), 429, "RATE_LIMITED", 60);
  assert.equal(fake.trace.filter((step) => step === "rate.challenge.read").length, probes);
  assert.equal(fake.trace.includes("google.keys"), false);
});

test("unlinked Google identity returns the web-account error after consumption commits", async () => {
  const id = challengeFixture();
  await expectFailure(await exchange(id, googleToken({ sub: "fixture-unlinked" })), 403, "WEB_ACCOUNT_REQUIRED");
  assert.deepEqual(fake.state.challenges.get(id)?.consumedAt, at());
  await expectFailure(await exchange(id), 401, "GOOGLE_AUTH_FAILED");
  assert.equal(fake.state.sessions.size, 0);
});

test("exchange maps Google configuration and provider failures safely and leaves the challenge live", async () => {
  const id = challengeFixture();
  delete process.env.MOBILE_GOOGLE_AUDIENCE;
  await expectFailure(await exchange(id), 500, "INTERNAL_ERROR");
  process.env.MOBILE_GOOGLE_AUDIENCE = audience;
  googleUnavailable = true;
  await expectFailure(await exchange(id), 503, "TEMPORARILY_UNAVAILABLE");
  assert.equal(fake.state.challenges.get(id)?.consumedAt, null);
});

test("refresh commits source first and uses one session bucket across ten rotations", async () => {
  const initial = sessionFixture();
  let current = initial.refreshToken;
  for (let i = 0; i < 10; i++) {
    const tokens = await readTokens(await withRefreshToken(refreshRoute, current));
    current = tokens.refreshToken;
  }
  assert.deepEqual(ratePolicies(), ["refresh_session", "refresh_source"]);
  assert.equal(fake.trace.filter((step) => step === "tx.begin").length, 20);
  assert.ok(fake.trace.indexOf("tx.commit") < fake.trace.indexOf("refresh.candidate"));
  assert.ok(fake.trace.indexOf("refresh.reread") < fake.trace.lastIndexOf("rate.bucket.lock"));
  await expectFailure(await withRefreshToken(refreshRoute, current), 429, "RATE_LIMITED", 60);
  assert.equal(fake.state.refresh.get(digestKey(digest("refresh", current)))?.consumedAt, null);

  const other = sessionFixture("device-b");
  const replay = await expectFailure(await withRefreshToken(refreshRoute, initial.refreshToken), 401, "UNAUTHENTICATED");
  assert.deepEqual(fake.state.sessions.get("device-a")?.revokedAt, at());
  assert.equal(fake.state.sessions.get("device-b")?.revokedAt, null);
  const unknown = await expectFailure(await withRefreshToken(refreshRoute, createMobileToken("refresh")), 401, "UNAUTHENTICATED");
  assert.equal(replay, unknown);
  await readTokens(await withRefreshToken(refreshRoute, other.refreshToken));
});

test("expired and unknown refresh credentials never allocate a session bucket", async () => {
  const old = sessionFixture("expired", { refreshExpiry: at() });
  const revoked = sessionFixture("revoked", { revokedAt: at() });
  for (const token of [old.refreshToken, revoked.refreshToken, createMobileToken("refresh"), old.accessToken]) {
    await expectFailure(await withRefreshToken(refreshRoute, token), 401, "UNAUTHENTICATED");
  }
  assert.deepEqual(ratePolicies(), ["refresh_source"]);
  assert.equal(fake.trace.includes("refresh.consume"), false);
});

test("source exhaustion short-circuits refresh without probing credentials", async () => {
  for (let i = 0; i < 30; i++) {
    await expectFailure(await withRefreshToken(refreshRoute, createMobileToken("refresh")), 401, "UNAUTHENTICATED");
  }
  const current = sessionFixture();
  const probes = fake.trace.filter((step) => step === "refresh.candidate").length;
  await expectFailure(await withRefreshToken(refreshRoute, current.refreshToken), 429, "RATE_LIMITED", 60);
  assert.equal(fake.trace.filter((step) => step === "refresh.candidate").length, probes);
});

test("either expiry while waiting for admission charges the attempt without consuming the credential", async () => {
  // Exercise the absolute check independently of a refresh row's own expiry.
  for (const expiring of [{ refreshExpiry: at(1) }, { deadline: at(1), accessExpiry: at(1) }]) {
    resetLifecycleTestDatabase();
    fake.state.users.add(userId);
    const current = sessionFixture("waiting", expiring);
    fake.onStep = (step) => {
      if (step === "rate.bucket.lock" && fake.trace.includes("session.lock")) fake.now = initialTime + 1;
    };
    await expectFailure(await withRefreshToken(refreshRoute, current.refreshToken), 401, "UNAUTHENTICATED");
    assert.deepEqual(ratePolicies(), ["refresh_session", "refresh_source"]);
    assert.equal(fake.state.refresh.get(current.key)?.consumedAt, null);
    assert.equal(fake.trace.includes("session.rotate"), false);
    assert.equal(fake.trace.filter((step) => step === "tx.commit").length, 2);
  }
});

test("rotation timestamps use the database time sampled after rate admission", async () => {
  const current = sessionFixture();
  fake.onStep = (step) => {
    if (step === "rate.bucket.create" && fake.trace.includes("session.lock")) fake.now = initialTime + 42;
  };
  const tokens = await readTokens(await withRefreshToken(refreshRoute, current.refreshToken));
  assert.equal(tokens.accessTokenExpiresAt, at(10 * minute + 42).toISOString());
  assert.equal(tokens.refreshTokenExpiresAt, at(14 * day + 42).toISOString());
  assert.deepEqual(fake.state.refresh.get(current.key)?.consumedAt, at(42));
});

test("a direct refresh caller enforces the session limiter, with no nested transaction or fail-open", async () => {
  const current = sessionFixture();
  delete process.env.MOBILE_RATE_LIMIT_KEY_SECRET;
  assert.deepEqual(await rotateMobileRefresh(current.refreshToken), { status: "configuration_error" });
  assert.equal(fake.state.refresh.get(current.key)?.consumedAt, null);
  process.env.MOBILE_RATE_LIMIT_KEY_SECRET = Buffer.alloc(32, 73).toString("base64url");
  fake.failAt = "rate.capacity.update";
  assert.deepEqual(await rotateMobileRefresh(current.refreshToken), { status: "database_unavailable" });
  assert.deepEqual(ratePolicies(), []);
  assert.equal(fake.state.refresh.get(current.key)?.consumedAt, null);
  assert.equal(fake.trace.filter((step) => step === "tx.begin").length, 2);
  assert.equal(fake.trace.includes("refresh.consume"), false);
});

test("session capacity failure issues no tokens and cannot suppress a recognized replay", async () => {
  const current = sessionFixture();
  fake.state.bucketCount = 9_999;
  await expectFailure(await withRefreshToken(refreshRoute, current.refreshToken), 503, "TEMPORARILY_UNAVAILABLE", 5);
  assert.deepEqual(ratePolicies(), ["refresh_source"]);
  const old = fake.state.refresh.get(current.key);
  assert.ok(old);
  assert.equal(old.consumedAt, null);

  old.consumedAt = at(-1);
  await expectFailure(await withRefreshToken(refreshRoute, current.refreshToken), 401, "UNAUTHENTICATED");
  assert.deepEqual(fake.state.sessions.get("device-a")?.revokedAt, at());
  assert.deepEqual(ratePolicies(), ["refresh_source"]);
});

test("failed rotation rolls back session admission and an ambiguous commit yields no successful response", async () => {
  const current = sessionFixture();
  fake.failAt = "session.rotate";
  await expectFailure(await withRefreshToken(refreshRoute, current.refreshToken), 503, "TEMPORARILY_UNAVAILABLE");
  assert.deepEqual(ratePolicies(), ["refresh_source"]);
  assert.equal(fake.state.refresh.get(current.key)?.consumedAt, null);
  assert.equal(fake.state.refresh.size, 1);

  fake.failAt = "";
  fake.trace.length = 0;
  fake.onStep = (step) => {
    if (step === "session.rotate") fake.failAt = "tx.afterCommit";
  };
  await expectFailure(await withRefreshToken(refreshRoute, current.refreshToken), 503, "TEMPORARILY_UNAVAILABLE");
  assert.deepEqual(fake.state.refresh.get(current.key)?.consumedAt, at());
  assert.deepEqual(ratePolicies(), ["refresh_session", "refresh_source"]);
  assert.equal(fake.trace.filter((step) => step === "tx.begin").length, 2);
});

test("logout is idempotent for current, rotated, absent and absolutely expired sessions", async () => {
  const current = sessionFixture();
  const rotated = sessionFixture("device-b");
  const unrelated = sessionFixture("device-c");
  const expired = sessionFixture("expired", { deadline: at(), accessExpiry: at(), refreshExpiry: at() });
  await readTokens(await withRefreshToken(refreshRoute, rotated.refreshToken));

  for (const token of [current.refreshToken, current.refreshToken, rotated.refreshToken, expired.refreshToken, createMobileToken("refresh")]) {
    const response = await withRefreshToken(logoutRoute, token);
    assert.equal(response.status, 204);
    commonHeaders(response);
    assert.equal(response.headers.get("content-type"), null);
    assert.equal(response.body, null);
    assert.equal(await response.text(), "");
  }
  assert.deepEqual(fake.state.sessions.get("device-a")?.revokedAt, at());
  assert.deepEqual(fake.state.sessions.get("device-b")?.revokedAt, at());
  assert.equal(fake.state.sessions.get("device-c")?.revokedAt, null);
  await expectFailure(await withRefreshToken(logoutRoute, unrelated.accessToken), 400, "INVALID_REQUEST");
  fake.failAt = "session.revoke";
  await expectFailure(await withRefreshToken(logoutRoute, unrelated.refreshToken), 503, "TEMPORARILY_UNAVAILABLE");
});

test("logout rate-limit rejection never attempts session revocation", async () => {
  for (let i = 0; i < 30; i++) {
    assert.equal((await withRefreshToken(logoutRoute, createMobileToken("refresh"))).status, 204);
  }
  const current = sessionFixture();
  const probes = fake.trace.filter((step) => step === "refresh.candidate").length;
  await expectFailure(await withRefreshToken(logoutRoute, current.refreshToken), 429, "RATE_LIMITED", 60);
  assert.equal(fake.trace.filter((step) => step === "refresh.candidate").length, probes);
  assert.equal(fake.state.sessions.get("device-a")?.revokedAt, null);
});

test("bearer guard accepts one canonical access token and queries again after revocation", async () => {
  const current = sessionFixture();
  const request = new Request("https://app.example.invalid", {
    headers: { authorization: `bEaReR  ${current.accessToken}`, "x-request-id": "caller-supplied-id" },
  });
  const result = await requireMobileBearer(request);
  assert.ok(result.status === "authenticated");
  assert.deepEqual(result.identity, { userId, sessionId: "device-a" });
  assert.notEqual(result.requestId, "caller-supplied-id");
  const row = fake.state.sessions.get("device-a");
  assert.ok(row);
  row.revokedAt = at();
  const next = await requireMobileBearer(request);
  assert.ok(next.status === "rejected");
  assert.equal(next.response.headers.get("www-authenticate"), "Bearer");
  await expectFailure(next.response, 401, "UNAUTHENTICATED");
  assert.equal(fake.trace.filter((step) => step === "access.read").length, 2);
});

test("bearer guard rejects missing, wrong-purpose, ambiguous and extra credentials without cookie fallback", async () => {
  const current = sessionFixture();
  for (const header of [null, `Basic ${current.accessToken}`, `Bearer ${current.refreshToken}`,
    `Bearer ${createMobileChallengeId()}`, `Bearer ${current.accessToken}, Bearer ${current.accessToken}`,
    `Bearer ${current.accessToken} extra`, `Bearer\t${current.accessToken}`]) {
    const headers = new Headers({ cookie: `next-auth.session-token=${current.accessToken}` });
    if (header !== null) headers.set("authorization", header);
    const result = await requireMobileBearer(new Request(`https://app.example.invalid/?accessToken=${current.accessToken}`, { headers }));
    assert.ok(result.status === "rejected");
    assert.equal(result.response.headers.get("www-authenticate"), "Bearer");
    await expectFailure(result.response, 401, "UNAUTHENTICATED");
  }
  assert.deepEqual(fake.trace, []);
});

test("bearer expiry returns a challenge and database outages remain service errors", async () => {
  const { accessToken } = sessionFixture("expired", { accessExpiry: at() });
  const request = new Request("https://app.example.invalid", { headers: { authorization: `Bearer ${accessToken}` } });
  const expired = await requireMobileBearer(request);
  assert.ok(expired.status === "rejected");
  assert.equal(expired.response.headers.get("www-authenticate"), "Bearer");
  await expectFailure(expired.response, 401, "UNAUTHENTICATED");
  fake.failAt = "access.read";
  const outage = await requireMobileBearer(request);
  assert.ok(outage.status === "rejected");
  assert.equal(outage.response.headers.get("www-authenticate"), null);
  await expectFailure(outage.response, 503, "TEMPORARILY_UNAVAILABLE");
});

test("a session token identifies its real owner and revoking another user's device leaves it usable", async () => {
  const first = sessionFixture();
  const second = sessionFixture("device-b");
  const otherUserId = "fixture-other-user";
  fake.state.users.add(otherUserId);
  const row = fake.state.sessions.get("device-b");
  assert.ok(row);
  row.userId = otherUserId;

  assert.equal((await withRefreshToken(logoutRoute, first.refreshToken)).status, 204);
  const request = new Request(`https://app.example.invalid/?userId=${userId}`, {
    headers: { authorization: `Bearer ${second.accessToken}`, "x-user-id": userId },
  });
  const result = await requireMobileBearer(request);
  assert.ok(result.status === "authenticated");
  assert.deepEqual(result.identity, { userId: otherUserId, sessionId: "device-b" });
});
