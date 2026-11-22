const assert = require("node:assert/strict");
const { test } = require("node:test");

const config = {
  webClientId: "12345-web.apps.googleusercontent.com",
  iosClientId: null,
  verifierOrigin: "https://mobile-proof.example.test",
};
const challenge = { challengeId: "fixture-challenge-id", nonce: "a".repeat(64) };
const idToken = "test-id-token";

const reply = (payload, ok = true) => ({ ok, json: async () => payload });

test("the native flow receives the issued nonce and only the test verifier receives the ID token", async () => {
  const { runGoogleProof } = await import("../src/auth/google-proof.ts");
  const calls = [];
  const result = await runGoogleProof(config, {
    fetch: async (url, options) => {
      assert.equal(options.redirect, "error");
      assert.equal(options.credentials, "omit");
      assert.equal(options.method, "POST");
      calls.push([url, JSON.parse(options.body)]);
      return url.endsWith("/challenge") ? reply(challenge) : reply({ verified: true });
    },
    requestGoogleIdToken: async (ids, nonce) => {
      assert.equal(ids.webClientId, config.webClientId);
      assert.equal(nonce, challenge.nonce);
      return { status: "token", idToken, profile: { email: "test@example.test" } };
    },
  });
  assert.equal(result, "verified");
  assert.deepEqual(calls, [
    [config.verifierOrigin + "/google-proof/challenge", {}],
    [config.verifierOrigin + "/google-proof/verify", { challengeId: challenge.challengeId, idToken }],
  ]);
});

test("a failed or malformed challenge stops before opening Google", async (t) => {
  const { runGoogleProof } = await import("../src/auth/google-proof.ts");
  const requestGoogleIdToken = t.mock.fn();
  const failures = [
    async () => { throw new Error("fixture network failure"); },
    async () => reply(challenge, false),
    async () => reply({ ...challenge, nonce: "" }),
    async () => reply({ ...challenge, challengeId: "" }),
  ];
  for (const fetch of failures) {
    assert.equal(await runGoogleProof(config, { fetch, requestGoogleIdToken }), "challenge-error");
  }
  assert.equal(requestGoogleIdToken.mock.callCount(), 0);
});

test("cancellation skips verification and the next attempt requests its own challenge", async (t) => {
  const { runGoogleProof } = await import("../src/auth/google-proof.ts");
  const next = { ...challenge, nonce: "b".repeat(64) };
  const challenges = [challenge, next];
  const fetch = t.mock.fn(async () => reply(challenges.shift()));
  const received = [];
  const requestGoogleIdToken = async (_ids, nonce) => {
    received.push(nonce);
    return { status: "cancelled" };
  };

  assert.equal(await runGoogleProof(config, { fetch, requestGoogleIdToken }), "cancelled");
  assert.equal(await runGoogleProof(config, { fetch, requestGoogleIdToken }), "cancelled");
  assert.deepEqual(received, [challenge.nonce, next.nonce]);
  assert.deepEqual(fetch.mock.calls.map(({ arguments: [url] }) => url), [
    config.verifierOrigin + "/google-proof/challenge",
    config.verifierOrigin + "/google-proof/challenge",
  ]);
});

test("the proof requires an explicit verified response from a successful verifier request", async () => {
  const { runGoogleProof } = await import("../src/auth/google-proof.ts");
  const requestGoogleIdToken = async () => ({ status: "token", idToken });
  const failures = [
    async () => reply({ verified: "true" }),
    async () => reply({ verified: true }, false),
    async () => { throw new Error("fixture verifier failure"); },
    async () => ({ ok: true, json: async () => { throw new SyntaxError("fixture invalid JSON"); } }),
  ];
  for (const verify of failures) {
    const fetch = (url) => url.endsWith("/challenge") ? reply(challenge) : verify();
    assert.equal(await runGoogleProof(config, { fetch, requestGoogleIdToken }), "verification-error");
  }
});
