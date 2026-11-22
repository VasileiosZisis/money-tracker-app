import { randomBytes, timingSafeEqual } from "node:crypto";

const maxBodyBytes = 12 * 1024;
const challengeLifetimeMs = 5 * 60 * 1000;
const rateWindowMs = 60 * 1000;
const challengePath = "/google-proof/challenge";
const verifyPath = "/google-proof/verify";
const requestLimits = new Map([[challengePath, 20], [verifyPath, 30]]);
const issuers = new Set(["accounts.google.com", "https://accounts.google.com"]);
const challengeIdPattern = /^[A-Za-z0-9_-]{16,128}$/;
const tokenPattern = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const noncePattern = /^[a-f0-9]{64}$/;

export function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, {
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Connection": "close",
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const { headers } = request;
  if (
    headers["content-type"]?.split(";")[0].trim().toLowerCase() !== "application/json" ||
    (headers["content-encoding"] ?? "identity").toLowerCase() !== "identity"
  ) {
    return { status: 415 };
  }
  if (Number(headers["content-length"]) > maxBodyBytes) return { status: 413 };

  let size = 0;
  const chunks = [];
  try {
    for await (const chunk of request.iterator({ destroyOnReturn: false })) {
      size += chunk.length;
      if (size > maxBodyBytes) return { status: 413 };
      chunks.push(chunk);
    }
    const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
    if (body && typeof body === "object" && !Array.isArray(body)) return { body };
  } catch {
    // Errors may contain client-provided data. Only return a fixed error.
  }
  return { status: 400 };
}

export function createProofHandler({
  audience,
  allowedPresenters,
  allowedSubjects,
  verifyIdToken,
  now = Date.now,
}) {
  const challenges = new Map();
  const rateWindows = new Map();
  let pendingVerifications = 0;

  return async function handle(request, response) {
    const path = request.url;
    const limit = requestLimits.get(path);
    if (!limit) return sendJson(response, 404, { error: "not_found" });
    if (request.method !== "POST") {
      return sendJson(response, 405, { error: "method_not_allowed" }, { Allow: "POST" });
    }

    const receivedAt = now();
    let window = rateWindows.get(path);
    if (!window || receivedAt >= window.resetAt) {
      window = { count: 0, resetAt: receivedAt + rateWindowMs };
      rateWindows.set(path, window);
    }
    if (window.count >= limit) {
      return sendJson(response, 429, { error: "rate_limited" }, {
        "Retry-After": String(Math.ceil((window.resetAt - receivedAt) / 1000)),
      });
    }
    window.count += 1;

    const { body, status } = await readJson(request);
    if (!body) return sendJson(response, status, { error: "invalid_request" });

    if (path === challengePath) {
      if (Object.keys(body).length !== 0) return sendJson(response, 400, { error: "invalid_request" });

      const issuedAt = now();
      for (const [id, challenge] of challenges) {
        if (challenge.expiresAt <= issuedAt) challenges.delete(id);
      }
      if (challenges.size >= 80) return sendJson(response, 503, { error: "busy" });

      const challengeId = randomBytes(24).toString("base64url");
      const nonce = randomBytes(32).toString("hex");
      challenges.set(challengeId, { nonce, expiresAt: issuedAt + challengeLifetimeMs });
      return sendJson(response, 200, { challengeId, nonce });
    }

    const { challengeId, idToken } = body;
    if (
      Object.keys(body).length !== 2 ||
      typeof challengeId !== "string" ||
      !challengeIdPattern.test(challengeId) ||
      typeof idToken !== "string" ||
      !tokenPattern.test(idToken)
    ) {
      return sendJson(response, 400, { error: "invalid_request" });
    }

    const challenge = challenges.get(challengeId);
    if (!challenge || challenge.expiresAt <= now()) {
      return sendJson(response, 401, { error: "proof_rejected" });
    }
    if (pendingVerifications >= 8) return sendJson(response, 503, { error: "busy" });

    pendingVerifications += 1;
    try {
      const claims = await verifyIdToken(idToken, audience);
      const verifiedAt = now();
      if (
        !claims ||
        !issuers.has(claims.iss) ||
        claims.aud !== audience ||
        !Number.isSafeInteger(claims.exp) ||
        claims.exp <= Math.floor(verifiedAt / 1000) ||
        typeof claims.sub !== "string" ||
        !allowedSubjects.has(claims.sub) ||
        (claims.azp !== undefined && !allowedPresenters.has(claims.azp)) ||
        typeof claims.nonce !== "string" ||
        !noncePattern.test(claims.nonce) ||
        !timingSafeEqual(Buffer.from(claims.nonce, "hex"), Buffer.from(challenge.nonce, "hex")) ||
        challenge.expiresAt <= verifiedAt ||
        challenges.get(challengeId) !== challenge
      ) {
        return sendJson(response, 401, { error: "proof_rejected" });
      }

      // No await between checking and deleting the original challenge.
      challenges.delete(challengeId);
    } catch {
      // Google's verification errors can include token or claim data.
      return sendJson(response, 401, { error: "proof_rejected" });
    } finally {
      pendingVerifications -= 1;
    }

    return sendJson(response, 200, { verified: true });
  };
}
