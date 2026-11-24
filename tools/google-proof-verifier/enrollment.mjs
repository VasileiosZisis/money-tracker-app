import { randomBytes, timingSafeEqual } from "node:crypto";
import { createServer } from "node:http";

const callbackHost = "127.0.0.1";
const callbackPort = 8788;
const callbackPath = "/google-proof/enrollment/callback";
export const callbackUri = `http://${callbackHost}:${callbackPort}${callbackPath}`;
export const subjectPattern = /^[A-Za-z0-9._~-]{1,255}$/;

export class EnrollmentError extends Error {}

function equalSecret(actual, expected) {
  if (typeof actual !== "string" || actual.length !== expected.length) return false;
  const actualBytes = Buffer.from(actual, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

export async function prepareAuthorization(google) {
  const state = randomBytes(32).toString("base64url");
  const nonce = randomBytes(32).toString("base64url");
  const { codeVerifier, codeChallenge } = await google.generateCodeVerifierAsync();
  const url = google.generateAuthUrl({
    redirect_uri: callbackUri,
    response_type: "code",
    response_mode: "form_post",
    access_type: "online",
    scope: ["openid", "email"],
    prompt: "select_account",
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    state,
    nonce,
  });
  return { url, state, nonce, codeVerifier };
}

export async function verifyEnrollmentSubject(google, {
  code, codeVerifier, nonce, audience, expectedEmail,
}, now = Date.now) {
  try {
    const { tokens } = await google.getToken({ code, codeVerifier, redirect_uri: callbackUri });
    if (!tokens.id_token || tokens.refresh_token) throw new EnrollmentError();

    const ticket = await google.verifyIdToken({ idToken: tokens.id_token, audience });
    const claims = ticket.getPayload();
    if (
      !claims ||
      !["accounts.google.com", "https://accounts.google.com"].includes(claims.iss) ||
      claims.aud !== audience ||
      !Number.isSafeInteger(claims.exp) ||
      claims.exp <= Math.floor(now() / 1000) ||
      (claims.azp !== undefined && claims.azp !== audience) ||
      !equalSecret(claims.nonce, nonce) ||
      claims.email_verified !== true ||
      typeof claims.email !== "string" ||
      claims.email.toLowerCase() !== expectedEmail.toLowerCase() ||
      typeof claims.sub !== "string" ||
      !subjectPattern.test(claims.sub)
    ) {
      throw new EnrollmentError();
    }
    return claims.sub;
  } catch {
    throw new EnrollmentError("Google verification failed or the selected account did not match. No subject was saved.");
  }
}

export async function confirmEnrollment(prompt, save, signal) {
  const answer = await prompt();
  signal.throwIfAborted();
  if (answer.trim() !== "ENROLL") throw new EnrollmentError("Enrollment canceled. No subject was saved.");
  return save();
}

function reply(response, status, message) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "text/plain; charset=utf-8",
    "Connection": "close",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(message);
}

async function readCallbackForm(request) {
  const contentType = request.headers["content-type"]?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/x-www-form-urlencoded" || request.headers["content-encoding"]) {
    return null;
  }
  const maxBytes = 8192;
  if (Number(request.headers["content-length"]) > maxBytes) return null;

  const chunks = [];
  let size = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > maxBytes) return null;
    chunks.push(chunk);
  }
  return new URLSearchParams(Buffer.concat(chunks).toString("utf8"));
}

export function createEnrollmentCallback(expectedState, complete) {
  let claimed = false;
  return async function handle(request, response) {
    if (request.headers.host !== `${callbackHost}:${callbackPort}` ||
        request.url !== callbackPath || request.method !== "POST") {
      return reply(response, 404, "Enrollment callback unavailable.");
    }
    const form = await readCallbackForm(request).catch(() => null);
    const states = form?.getAll("state");
    const codes = form?.getAll("code") ?? [];
    const errors = form?.getAll("error") ?? [];
    const hasCode = codes.length === 1 && errors.length === 0 && /^[\x21-\x7e]{1,2048}$/.test(codes[0]);
    const hasError = errors.length === 1 && codes.length === 0 && errors[0].length > 0;
    if (claimed || states?.length !== 1 || !equalSecret(states[0], expectedState) || (!hasCode && !hasError)) {
      return reply(response, 400, "Enrollment callback rejected.");
    }

    claimed = true;
    const result = hasCode ? { code: codes[0] } : {
      error: new EnrollmentError(errors[0] === "access_denied"
        ? "Google sign-in was canceled."
        : "Google did not complete enrollment. Check the development OAuth configuration."),
    };
    function onFinished() {
      response.off("close", onFinished);
      response.off("finish", onFinished);
      complete(result);
    }
    response.once("close", onFinished);
    response.once("finish", onFinished);
    return reply(response, 200, "Return to the terminal to finish CashContour test enrollment.");
  };
}

export async function receiveEnrollmentCode({ url, state }, openBrowser, signal, {
  timeout = AbortSignal.timeout(5 * 60 * 1000),
  makeServer = createServer,
} = {}) {
  const stop = AbortSignal.any([signal, timeout]);
  const callback = Promise.withResolvers();
  function stopWaiting() {
    callback.resolve({ error: new EnrollmentError(
      timeout.aborted ? "Google sign-in timed out." : "Enrollment canceled.",
    ) });
  }

  const handle = createEnrollmentCallback(state, callback.resolve);
  const server = makeServer({
    maxHeaderSize: 8192,
    headersTimeout: 5000,
    requestTimeout: 10000,
    connectionsCheckingInterval: 1000,
  }, (request, response) => handle(request, response).catch(() => response.destroy()));
  server.maxConnections = 8;
  server.on("clientError", (_error, socket) => socket.destroy());
  server.on("error", () => callback.resolve({
    error: new EnrollmentError("Could not listen on 127.0.0.1:8788. Check whether the port is in use."),
  }));

  stop.throwIfAborted();
  stop.addEventListener("abort", stopWaiting, { once: true });
  try {
    server.listen({ host: callbackHost, port: callbackPort, signal: stop }, () => {
      if (!stop.aborted) {
        openBrowser(url).catch(() => callback.resolve({
          error: new EnrollmentError("Could not open the system browser."),
        }));
      }
    });
    const result = await callback.promise;
    if (result.error) throw result.error;
    stop.throwIfAborted();
    return result.code;
  } finally {
    stop.removeEventListener("abort", stopWaiting);
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections();
    });
  }
}
