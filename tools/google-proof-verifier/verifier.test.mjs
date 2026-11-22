import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";

import { readConfig } from "./config.mjs";
import { createProofHandler } from "./verifier.mjs";

const audience = "12345-web.apps.googleusercontent.com";
const presenter = "12345-android.apps.googleusercontent.com";
const subject = "123456789012345678901";
const idToken = "fixture.jwt.signature";
const challengePath = "/google-proof/challenge";
const verifyPath = "/google-proof/verify";

function fixture() {
  let time = 1_800_000_000_000;
  const claims = {
    iss: "https://accounts.google.com",
    aud: audience,
    sub: subject,
    azp: presenter,
    exp: time / 1000 + 3600,
  };
  const calls = [];
  let verify = () => claims;
  const handler = createProofHandler({
    audience,
    allowedPresenters: new Set([presenter]),
    allowedSubjects: new Set([subject]),
    now: () => time,
    verifyIdToken: (token, expectedAudience) => {
      calls.push({ token, expectedAudience });
      return verify();
    },
  });

  async function request(url, body, options = {}) {
    const chunks = options.chunks ?? [Buffer.from(JSON.stringify(body))];
    const req = Object.assign(Readable.from(chunks), {
      method: options.method ?? "POST",
      url,
      headers: { "content-type": "application/json", ...options.headers },
    });
    const result = {};
    await handler(req, {
      writeHead(status, headers) { Object.assign(result, { status, headers }); },
      end(data) { result.body = JSON.parse(data); },
    });
    assert.equal(result.headers["Cache-Control"], "no-store");
    return result;
  }

  return {
    claims,
    calls,
    request,
    advance(ms) { time += ms; },
    setVerification(fn) { verify = fn; },
    async issue() {
      const result = await request(challengePath, {});
      assert.equal(result.status, 200);
      claims.nonce = result.body.nonce;
      return result.body;
    },
    submit(challengeId) { return request(verifyPath, { challengeId, idToken }); },
  };
}

test("requires explicit audience, presenter and subject configuration", () => {
  const env = {
    GOOGLE_PROOF_AUDIENCE: audience,
    GOOGLE_PROOF_ALLOWED_PRESENTERS: presenter,
    GOOGLE_PROOF_ALLOWED_SUBJECTS: subject,
  };
  const config = readConfig(env);
  assert.deepEqual(config, {
    audience,
    allowedPresenters: new Set([presenter]),
    allowedSubjects: new Set([subject]),
    port: 8787,
  });
  for (const name of Object.keys(env)) {
    assert.throws(() => readConfig({ ...env, [name]: "" }), new RegExp(name));
  }
  assert.throws(() => readConfig({ ...env, GOOGLE_PROOF_PORT: "0" }), /GOOGLE_PROOF_PORT/);
});

test("issues a URL-safe challenge ID and a 32-byte nonce without consulting Google", async () => {
  const f = fixture();
  const { challengeId, nonce } = await f.issue();
  assert.match(challengeId, /^[A-Za-z0-9_-]{32}$/);
  assert.match(nonce, /^[a-f0-9]{64}$/);
  assert.deepEqual(f.calls, []);
});

test("accepts verified claims and rejects replay without another Google verification", async () => {
  const f = fixture();
  const { challengeId } = await f.issue();
  const result = await f.submit(challengeId);
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { verified: true });
  assert.deepEqual(f.calls, [{ token: idToken, expectedAudience: audience }]);
  assert.equal((await f.submit(challengeId)).status, 401);
  assert.equal(f.calls.length, 1);
});

test("accepts a Google issuer without the scheme and a token with no presenter claim", async () => {
  const f = fixture();
  const { challengeId } = await f.issue();
  f.claims.iss = "accounts.google.com";
  delete f.claims.azp;
  assert.equal((await f.submit(challengeId)).status, 200);
});

for (const [label, key, value] of [
  ["foreign issuer", "iss", "https://other.example.test"],
  ["wrong audience", "aud", "other-audience"],
  ["multiple audiences", "aud", [audience, "other-audience"]],
  ["wrong nonce", "nonce", "b".repeat(64)],
  ["expired token", "exp", 1_800_000_000],
  ["malformed expiry", "exp", "1800003600"],
  ["disallowed subject", "sub", "987654321"],
  ["missing subject", "sub", undefined],
  ["unapproved presenter", "azp", "other-presenter"],
  ["malformed presenter", "azp", null],
]) {
  test("rejects " + label + " without consuming the challenge", async () => {
    const f = fixture();
    const { challengeId } = await f.issue();
    const original = f.claims[key];
    f.claims[key] = value;
    const result = await f.submit(challengeId);
    assert.equal(result.status, 401);
    assert.deepEqual(result.body, { error: "proof_rejected" });
    f.claims[key] = original;
    assert.equal((await f.submit(challengeId)).status, 200);
  });
}

test("rejects an invalid signature without reflecting the underlying verifier error", async () => {
  const f = fixture();
  const { challengeId } = await f.issue();
  f.setVerification(() => { throw new Error("bad signature for " + idToken); });
  const result = await f.submit(challengeId);
  assert.equal(result.status, 401);
  assert.deepEqual(result.body, { error: "proof_rejected" });
});

test("rejects an expired challenge before consulting Google", async () => {
  const f = fixture();
  const { challengeId } = await f.issue();
  f.advance(5 * 60 * 1000);
  assert.equal((await f.submit(challengeId)).status, 401);
  assert.deepEqual(f.calls, []);
});

test("rejects a challenge that expires while Google verification is pending", async () => {
  const f = fixture();
  const { challengeId } = await f.issue();
  const started = Promise.withResolvers();
  const release = Promise.withResolvers();
  f.setVerification(async () => {
    started.resolve();
    await release.promise;
    return f.claims;
  });

  const response = f.submit(challengeId);
  await started.promise;
  f.advance(5 * 60 * 1000);
  release.resolve();
  assert.equal((await response).status, 401);
});

test("only one concurrent verification can consume the same valid challenge", async () => {
  const f = fixture();
  const { challengeId } = await f.issue();
  const bothStarted = Promise.withResolvers();
  const release = Promise.withResolvers();
  f.setVerification(async () => {
    if (f.calls.length === 2) bothStarted.resolve();
    await release.promise;
    return f.claims;
  });

  const results = [f.submit(challengeId), f.submit(challengeId)];
  await bothStarted.promise;
  release.resolve();
  assert.deepEqual((await Promise.all(results)).map(({ status }) => status).sort(), [200, 401]);
  assert.equal((await f.submit(challengeId)).status, 401);
  assert.equal(f.calls.length, 2);
});

test("rejects malformed JSON, token shape, unexpected fields and unsupported methods", async () => {
  const f = fixture();
  const { challengeId } = await f.issue();
  assert.equal((await f.request(challengePath, [], {})).status, 400);
  assert.equal((await f.request(challengePath, {}, { chunks: [Buffer.from("{")] })).status, 400);
  assert.equal((await f.request(challengePath, { account: "fixture" })).status, 400);
  assert.equal((await f.request(verifyPath, { challengeId, idToken: "malformed" })).status, 400);
  assert.equal((await f.request(verifyPath, { challengeId, idToken, extra: true })).status, 400);
  assert.equal((await f.request(challengePath, {}, { method: "GET" })).status, 405);
  assert.equal((await f.request("/other", {})).status, 404);
  assert.deepEqual(f.calls, []);
});

test("enforces content type and size limits for declared and streamed bodies", async () => {
  const f = fixture();
  assert.equal((await f.request(challengePath, {}, {
    headers: { "content-type": "text/plain" },
  })).status, 415);
  assert.equal((await f.request(challengePath, {}, {
    headers: { "content-encoding": "gzip" },
  })).status, 415);
  assert.equal((await f.request(challengePath, {}, {
    headers: { "content-length": String(13 * 1024) },
  })).status, 413);
  assert.equal((await f.request(challengePath, {}, {
    chunks: [Buffer.alloc(12 * 1024), Buffer.from("x")],
  })).status, 413);
});

test("limits each endpoint independently and allows requests after the window resets", async () => {
  const f = fixture();
  const { challengeId } = await f.issue();
  for (let i = 1; i < 20; i += 1) await f.issue();
  const issueLimit = await f.request(challengePath, {});
  assert.equal(issueLimit.status, 429);
  assert.equal(issueLimit.headers["Retry-After"], "60");

  for (let i = 0; i < 30; i += 1) {
    assert.equal((await f.request(verifyPath, { challengeId, idToken: "invalid" })).status, 400);
  }
  assert.equal((await f.submit(challengeId)).status, 429);
  assert.equal(f.calls.length, 0);

  f.advance(60 * 1000);
  const fresh = await f.issue();
  assert.equal((await f.submit(fresh.challengeId)).status, 200);
});

test("prunes expired challenges before issuing more at store capacity", async () => {
  const f = fixture();
  for (let window = 0; window < 4; window += 1) {
    for (let i = 0; i < 20; i += 1) await f.issue();
    f.advance(60 * 1000);
  }

  assert.equal((await f.request(challengePath, {})).status, 503);
  f.advance(60 * 1000);
  const fresh = await f.issue();
  assert.equal((await f.submit(fresh.challengeId)).status, 200);
});

test("limits concurrent Google verification without consuming the next challenge", async () => {
  const f = fixture();
  const first = await f.issue();
  const next = await f.issue();
  const allStarted = Promise.withResolvers();
  const release = Promise.withResolvers();
  f.setVerification(async () => {
    if (f.calls.length === 8) allStarted.resolve();
    await release.promise;
    return { ...f.claims, nonce: first.nonce };
  });

  const pending = Array.from({ length: 8 }, () => f.submit(first.challengeId));
  await allStarted.promise;
  try {
    assert.equal((await f.submit(next.challengeId)).status, 503);
    assert.equal(f.calls.length, 8);
  } finally {
    release.resolve();
    await Promise.all(pending);
  }

  f.setVerification(() => f.claims);
  assert.equal((await f.submit(next.challengeId)).status, 200);
});
