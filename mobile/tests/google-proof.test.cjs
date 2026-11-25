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

const statusCodes = Object.fromEntries([
  "DEVELOPER_ERROR", "IN_PROGRESS", "ONE_TAP_START_FAILED",
  "SIGN_IN_CANCELLED", "PLAY_SERVICES_NOT_AVAILABLE",
].map((code) => [code, code]));

function mockGoogleNative(overrides = {}) {
  return async () => ({
    statusCodes,
    isErrorWithCode: (error) => typeof error?.code === "string",
    GoogleOneTapSignIn: {
      checkPlayServices: async () => {},
      configure: () => {},
      presentExplicitSignIn: async () => ({ type: "cancelled" }),
      ...overrides,
    },
  });
}

test("only string proof settings reach native configuration and Android ignores the iOS setting", async () => {
  const { readGoogleProofConfig } = await import("../src/auth/google-proof.ts");
  const iosClientId = "12345-ios.apps.googleusercontent.com";
  assert.deepEqual(readGoogleProofConfig({ ...config, iosClientId: {} }, "android"), config);
  assert.deepEqual(readGoogleProofConfig({ ...config, iosClientId }, "android"), config);
  assert.deepEqual(readGoogleProofConfig({ ...config, iosClientId }, "ios"), { ...config, iosClientId });
  assert.equal(readGoogleProofConfig({ ...config, iosClientId: {} }, "ios"), null);
  assert.equal(readGoogleProofConfig({ ...config, webClientId: {} }, "android"), null);
  assert.equal(readGoogleProofConfig({ ...config, verifierOrigin: {} }, "android"), null);
});

test("native configuration omits the empty iOS option and preserves the signed nonce", async (t) => {
  const { requestGoogleIdToken } = await import("../src/auth/google-sign-in.ts");
  const configure = t.mock.fn();
  const native = mockGoogleNative({ configure });
  const iosClientId = "12345-ios.apps.googleusercontent.com";

  await requestGoogleIdToken(config, challenge.nonce, native);
  await requestGoogleIdToken({ ...config, iosClientId }, challenge.nonce, native);

  assert.deepEqual(configure.mock.calls.map(({ arguments: args }) => args[0]), [
    { webClientId: config.webClientId, nonce: challenge.nonce },
    { webClientId: config.webClientId, iosClientId, nonce: challenge.nonce },
  ]);
});

test("native errors report a fixed diagnostic or the existing cancellation and Play Services status", async () => {
  const { requestGoogleIdToken } = await import("../src/auth/google-sign-in.ts");
  const cases = [
    ["checkPlayServices", "OTHER", { status: "google-error", step: "checkPlayServices", code: "UNKNOWN" }],
    ["configure", "DEVELOPER_ERROR", { status: "google-error", step: "configure", code: "DEVELOPER_ERROR" }],
    ["presentExplicitSignIn", "IN_PROGRESS", { status: "google-error", step: "presentExplicitSignIn", code: "IN_PROGRESS" }],
    ["presentExplicitSignIn", "SIGN_IN_CANCELLED", { status: "cancelled" }],
    ["checkPlayServices", "PLAY_SERVICES_NOT_AVAILABLE", { status: "play-services-unavailable" }],
  ];
  for (const [method, code, expected] of cases) {
    const native = mockGoogleNative({
      [method]() { throw Object.assign(new Error("fixture provider details"), { code }); },
    });
    assert.deepEqual(await requestGoogleIdToken(config, challenge.nonce, native), expected);
  }
});

test("configure failures classify bridge details without exposing native argument values", async () => {
  const { requestGoogleIdToken } = await import("../src/auth/google-sign-in.ts");
  const cases = [
    ["NoSuchMethodError: OneTapConfigureParams.fromCpp", "CONFIG_PARAMS_BRIDGE"],
    ["NoSuchMethodError: Variant_NullType_String.create", "STRING_VARIANT_BRIDGE"],
    ["ClassNotFoundException", "NATIVE_LINKAGE"],
    ["React Native context is not available yet.", "NATIVE_CONTEXT_UNAVAILABLE"],
    ["Cannot convert this value to a variant", "ARGUMENT_CONVERSION"],
    ["Unrecognized failure", "UNKNOWN"],
    ["Unexpected native argument", "JS_TYPE_ERROR", TypeError],
  ];
  for (const [message, code, ErrorType = Error] of cases) {
    const native = mockGoogleNative({
      configure() { throw new ErrorType(message + " Fixture argument: " + challenge.nonce); },
    });
    assert.deepEqual(await requestGoogleIdToken(config, challenge.nonce, native), {
      status: "google-error", step: "configure", code,
    });
  }
});

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

test("a native failure returns only the development diagnostic and skips verification", async (t) => {
  const { runGoogleProof } = await import("../src/auth/google-proof.ts");
  const fetch = t.mock.fn(async () => reply(challenge));
  const diagnostic = { status: "google-error", step: "presentExplicitSignIn", code: "IN_PROGRESS" };
  const result = await runGoogleProof(config, {
    fetch,
    requestGoogleIdToken: async () => ({
      ...diagnostic,
      message: "fixture provider details",
      idToken,
      nonce: challenge.nonce,
    }),
  });

  assert.deepEqual(result, diagnostic);
  assert.equal(fetch.mock.callCount(), 1);
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
