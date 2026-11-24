import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { link, lstat, mkdtemp, readFile, readdir, rename, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { test } from "node:test";
import { parseEnv } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import { addVerifiedSubject, saveVerifiedSubject } from "./enrollment-config.mjs";
import {
  callbackUri,
  confirmEnrollment,
  createEnrollmentCallback,
  prepareAuthorization,
  receiveEnrollmentCode,
  verifyEnrollmentSubject,
} from "./enrollment.mjs";

const audience = "12345-web.apps.googleusercontent.com";
const subject = "123456789012345678901";
const code = "fixture/code+value";
const idToken = "fixture-id-token";
const state = "fixture-state";
const nonce = "fixture-nonce";
const codeVerifier = "fixture-pkce-verifier";
const expectedEmail = "tester@example.test";
const clock = () => 1_800_000_000_000;

test("authorization requests only online OIDC with fresh state, nonce and S256 PKCE", async () => {
  const requests = [];
  const google = {
    generateCodeVerifierAsync: async () => ({ codeVerifier, codeChallenge: "fixture-pkce-challenge" }),
    generateAuthUrl: (options) => {
      requests.push(options);
      return "https://accounts.google.com/fixture";
    },
  };
  const first = await prepareAuthorization(google);
  const second = await prepareAuthorization(google);
  assert.match(first.state, /^[A-Za-z0-9_-]{43}$/);
  assert.match(first.nonce, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(first.state, second.state);
  assert.notEqual(first.nonce, second.nonce);
  assert.deepEqual(requests[0], {
    redirect_uri: "http://127.0.0.1:8788/google-proof/enrollment/callback",
    response_type: "code",
    response_mode: "form_post",
    access_type: "online",
    scope: ["openid", "email"],
    prompt: "select_account",
    code_challenge: "fixture-pkce-challenge",
    code_challenge_method: "S256",
    state: first.state,
    nonce: first.nonce,
  });
});

async function submitCallback(handler, form, options = {}) {
  const uri = new URL(callbackUri);
  const request = Object.assign(Readable.from([Buffer.from(new URLSearchParams(form).toString())]), {
    url: options.path ?? uri.pathname,
    method: options.method ?? "POST",
    headers: {
      host: uri.host,
      "content-type": "application/x-www-form-urlencoded",
      ...options.headers,
    },
  });
  const response = new EventEmitter();
  const result = {};
  response.writeHead = (status, headers) => Object.assign(result, { status, headers });
  response.end = (message) => {
    result.message = message;
    response.emit("finish");
    response.emit("close");
  };
  await handler(request, response);
  assert.equal(result.headers["Cache-Control"], "no-store");
  assert.doesNotMatch(result.message, /fixture/);
  return result.status;
}

test("callback requires the exact loopback form POST and consumes matching state only once", async () => {
  const results = [];
  const handle = createEnrollmentCallback(state, (result) => results.push(result));
  const body = { state, code };
  assert.equal(await submitCallback(handle, body, { headers: { host: "example.test:8788" } }), 404);
  assert.equal(await submitCallback(handle, body, { method: "GET" }), 404);
  assert.equal(await submitCallback(handle, body, { path: new URL(callbackUri).pathname + "?code=forged" }), 404);
  assert.equal(await submitCallback(handle, { state: "wrong", code }), 400);
  assert.equal(await submitCallback(handle, [["state", state], ["state", state], ["code", code]]), 400);
  assert.equal(await submitCallback(handle, { state, code, error: "access_denied" }), 400);
  assert.equal(await submitCallback(handle, { state, code: "x".repeat(8193) }), 400);
  assert.deepEqual(results, []);

  const statuses = await Promise.all([submitCallback(handle, body), submitCallback(handle, body)]);
  assert.deepEqual(statuses.sort(), [200, 400]);
  assert.deepEqual(results, [{ code }]);
});

test("only a matching state can cancel, and provider errors are redacted", async () => {
  const results = [];
  const handle = createEnrollmentCallback(state, (result) => results.push(result));
  assert.equal(await submitCallback(handle, { state: "forged", error: "access_denied" }), 400);
  assert.equal(await submitCallback(handle, {
    state, error: "access_denied", error_description: "fixture-sensitive",
  }), 200);
  assert.equal(results.length, 1);
  assert.equal(results[0].error.message, "Google sign-in was canceled.");
  assert.equal(await submitCallback(handle, { state, code }), 400);
});

function listenerFixture() {
  const server = new EventEmitter();
  const calls = {};
  server.listen = (options, onListening) => {
    calls.binding = options;
    onListening();
  };
  server.close = (onClosed) => {
    calls.closed = true;
    onClosed();
  };
  server.closeAllConnections = () => { calls.connectionsClosed = true; };
  const makeServer = (_options, handler) => {
    calls.handler = handler;
    return server;
  };
  return { calls, makeServer };
}

test("binds only to loopback before the browser opens and closes on success", async () => {
  const listener = listenerFixture();
  const { signal } = new AbortController();
  const url = "https://accounts.google.com/fixture";
  const received = receiveEnrollmentCode({ url, state }, async (browserUrl) => {
    assert.equal(browserUrl, url);
    assert.equal(listener.calls.binding.host, "127.0.0.1");
    assert.equal(listener.calls.binding.port, 8788);
    await submitCallback(listener.calls.handler, { state, code });
  }, signal, { makeServer: listener.makeServer });

  assert.equal(await received, code);
  assert.equal(listener.calls.closed, true);
  assert.equal(listener.calls.connectionsClosed, true);
});

test("cancellation and timeout close the listener and active connections", async () => {
  for (const canceledBy of ["operator", "timeout"]) {
    const listener = listenerFixture();
    const operator = new AbortController();
    const timeout = new AbortController();
    const received = receiveEnrollmentCode({ url: "https://accounts.google.com/fixture", state },
      async () => {}, operator.signal, { makeServer: listener.makeServer, timeout: timeout.signal });
    (canceledBy === "operator" ? operator : timeout).abort();
    await assert.rejects(received, canceledBy === "operator" ? /canceled/ : /timed out/);
    assert.equal(listener.calls.closed, true);
    assert.equal(listener.calls.connectionsClosed, true);
  }
});

function identityFixture() {
  const claims = {
    iss: "https://accounts.google.com",
    aud: audience,
    azp: audience,
    exp: clock() / 1000 + 300,
    nonce,
    sub: subject,
    email: expectedEmail,
    email_verified: true,
  };
  const google = {
    getToken: async (options) => {
      assert.deepEqual(options, { code, codeVerifier, redirect_uri: callbackUri });
      return { tokens: { id_token: idToken, access_token: "fixture-access-token" } };
    },
    verifyIdToken: async (options) => {
      assert.deepEqual(options, { idToken, audience });
      return { getPayload: () => claims };
    },
  };
  const verify = () => verifyEnrollmentSubject(google, {
    code, codeVerifier, nonce, audience, expectedEmail,
  }, clock);
  return { claims, google, verify };
}

test("only the verified subject is returned by the Web client exchange", async () => {
  const { claims, verify } = identityFixture();
  assert.equal(await verify(), subject);
  delete claims.azp;
  assert.equal(await verify(), subject);
});

const verificationFailure = /^Google verification failed or the selected account did not match\. No subject was saved\.$/;

for (const [label, patch] of [
  ["issuer", { iss: "https://example.test" }],
  ["audience", { aud: ["another-client"] }],
  ["expiry", { exp: clock() / 1000 }],
  ["presenter", { azp: "12345-android.apps.googleusercontent.com" }],
  ["nonce", { nonce: "incorrect" }],
  ["selected email", { email: "other@example.test" }],
  ["email verification", { email_verified: false }],
  ["subject encoding", { sub: "fixture\nOTHER_VAR=wrong" }],
]) {
  test("rejects an invalid " + label, async () => {
    const { claims, verify } = identityFixture();
    Object.assign(claims, patch);
    await assert.rejects(verify, { message: verificationFailure });
  });
}

test("redacts verification exceptions and refuses unexpected refresh tokens", async () => {
  const { google, verify } = identityFixture();
  google.verifyIdToken = async () => { throw new Error("bad signature for " + idToken); };
  await assert.rejects(verify, { message: verificationFailure });
  google.getToken = async () => ({ tokens: { id_token: idToken, refresh_token: "fixture-refresh" } });
  let verifiedOffline = false;
  google.verifyIdToken = async () => { verifiedOffline = true; };
  await assert.rejects(verify, { message: verificationFailure });
  assert.equal(verifiedOffline, false);
});

test("persists only on explicit terminal confirmation and honors cancellation", async () => {
  let saves = 0;
  const save = () => { saves += 1; return true; };
  const controller = new AbortController();
  await assert.rejects(confirmEnrollment(async () => "yes", save, controller.signal), /canceled/);
  assert.equal(saves, 0);
  assert.equal(await confirmEnrollment(async () => "ENROLL", save, controller.signal), true);
  controller.abort(new Error("fixture canceled"));
  await assert.rejects(confirmEnrollment(async () => "ENROLL", save, controller.signal), /fixture canceled/);
  assert.equal(saves, 1);
});

test("updates only the intended allowlist and keeps existing settings on Windows", () => {
  const content = `GOOGLE_PROOF_AUDIENCE=${audience}\r\n# fixture comment\r\nGOOGLE_PROOF_ALLOWED_SUBJECTS="123,456"\r\nGOOGLE_PROOF_PORT=8787\r\n`;
  const updated = addVerifiedSubject(content, audience, subject);
  assert.deepEqual({ ...parseEnv(updated) }, {
    ...parseEnv(content), GOOGLE_PROOF_ALLOWED_SUBJECTS: `123,456,${subject}`,
  });
  assert.match(updated, /# fixture comment\r\n/);
  assert.equal(addVerifiedSubject(updated, audience, subject), updated);
  assert.equal(parseEnv(addVerifiedSubject(`GOOGLE_PROOF_AUDIENCE=${audience}\n`, audience, subject))
    .GOOGLE_PROOF_ALLOWED_SUBJECTS, subject);
});

test("fails closed on a changed audience, unsafe subject, or ambiguous assignment", () => {
  const content = `GOOGLE_PROOF_AUDIENCE=${audience}\nGOOGLE_PROOF_ALLOWED_SUBJECTS=123\n`;
  assert.throws(() => addVerifiedSubject(content, "other", subject), /audience changed/);
  assert.throws(() => addVerifiedSubject(content, audience, "456\nOTHER_VAR=wrong"), /manual review/);
  assert.throws(() => addVerifiedSubject(content + "GOOGLE_PROOF_ALLOWED_SUBJECTS=456\n", audience, subject),
    /manual review/);
  assert.throws(() => addVerifiedSubject(content + "GOOGLE_PROOF_ENROLLMENT_CLIENT_SECRET=fixture-secret\n", audience, subject),
    { message: /^Remove the enrollment secret from \.env\.local/ });
});

async function envFixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "cashcontour-enrollment-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const target = pathToFileURL(join(directory, ".env.local"));
  const contents = `GOOGLE_PROOF_AUDIENCE=${audience}\nGOOGLE_PROOF_ALLOWED_SUBJECTS=123\nGOOGLE_PROOF_PORT=8787\n`;
  await writeFile(target, contents);
  return { directory, target, contents };
}

test("an exclusive save lock prevents overlapping updates and is released after saving", async (t) => {
  const { directory, target, contents } = await envFixture(t);
  const lock = new URL(".env.local.enrollment-lock", target);
  const { signal } = new AbortController();
  await writeFile(lock, "");

  await assert.rejects(saveVerifiedSubject(audience, subject, signal, target), /already locked/);
  assert.equal(await readFile(target, "utf8"), contents);
  await unlink(lock);
  assert.equal(await saveVerifiedSubject(audience, subject, signal, target), true);
  assert.equal(await saveVerifiedSubject(audience, "456", signal, target), true);
  assert.deepEqual({ ...parseEnv(await readFile(target, "utf8")) }, {
    ...parseEnv(contents), GOOGLE_PROOF_ALLOWED_SUBJECTS: `123,${subject},456`,
  });
  assert.deepEqual(await readdir(directory), [".env.local"]);
});

test("concurrent saves retain every subject reported as saved", async (t) => {
  const { target } = await envFixture(t);
  const { signal } = new AbortController();
  const subjects = [subject, "456"];
  const results = await Promise.allSettled(
    subjects.map((entry) => saveVerifiedSubject(audience, entry, signal, target)),
  );
  const saved = parseEnv(await readFile(target, "utf8")).GOOGLE_PROOF_ALLOWED_SUBJECTS.split(",");
  assert.ok(results.some((result) => result.status === "fulfilled"));
  assert.ok(saved.includes("123"));
  for (const [index, result] of results.entries()) {
    if (result.status === "fulfilled") {
      assert.equal(result.value, true);
      assert.ok(saved.includes(subjects[index]));
    } else {
      assert.match(result.reason.message, /already locked/);
      assert.equal(await saveVerifiedSubject(audience, subjects[index], signal, target), true);
    }
  }
  assert.deepEqual(
    new Set(parseEnv(await readFile(target, "utf8")).GOOGLE_PROOF_ALLOWED_SUBJECTS.split(",")),
    new Set(["123", ...subjects]),
  );
});

test("refuses to replace an oversized or multiply linked environment file", async (t) => {
  const { target, contents } = await envFixture(t);
  const { signal } = new AbortController();
  const other = new URL(".env.linked", target);
  await link(target, other);
  await assert.rejects(saveVerifiedSubject(audience, subject, signal, target), /regular verifier/);
  assert.equal(await readFile(other, "utf8"), contents);
  await unlink(other);

  const oversized = contents + "#" + " ".repeat(64 * 1024);
  await writeFile(target, oversized);
  await assert.rejects(saveVerifiedSubject(audience, subject, signal, target), /regular verifier/);
  assert.equal(await readFile(target, "utf8"), oversized);
});

test("refuses to replace a symbolic link or update its target", async (t) => {
  const { target, contents } = await envFixture(t);
  const other = new URL(".env.target", target);
  await rename(target, other);
  try {
    await symlink(fileURLToPath(other), target, "file");
  } catch (error) {
    if (process.platform === "win32" && ["EPERM", "EACCES"].includes(error.code)) {
      t.skip("Windows symlink creation requires permission in this environment");
      return;
    }
    throw error;
  }
  const { signal } = new AbortController();
  await assert.rejects(saveVerifiedSubject(audience, subject, signal, target), /regular verifier/);
  assert.equal((await lstat(target)).isSymbolicLink(), true);
  assert.equal(await readFile(other, "utf8"), contents);
});

test("cancellation before replacement preserves the file and cleans up the lock and temporary file", async (t) => {
  const { directory, target, contents } = await envFixture(t);
  let calls = 0;
  const signal = {
    throwIfAborted() {
      calls += 1;
      if (calls === 2) throw new Error("fixture canceled before replacing");
    },
  };
  await assert.rejects(saveVerifiedSubject(audience, subject, signal, target), /fixture canceled/);
  assert.equal(await readFile(target, "utf8"), contents);
  assert.deepEqual(await readdir(directory), [".env.local"]);
});
