import type { fetch } from "expo/fetch";
import type { requestGoogleIdToken } from "./google-sign-in";

export type GoogleProofConfig = {
  webClientId: string;
  iosClientId: string | null;
  verifierOrigin: string;
};

type ProofDependencies = {
  fetch: typeof fetch;
  requestGoogleIdToken: typeof requestGoogleIdToken;
};

async function postJson(
  fetch: ProofDependencies["fetch"],
  url: string,
  body: Record<string, string>,
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      redirect: "error",
      credentials: "omit",
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function runGoogleProof(
  config: GoogleProofConfig,
  { fetch, requestGoogleIdToken }: ProofDependencies,
) {
  const challenge = await postJson(fetch, config.verifierOrigin + "/google-proof/challenge", {});
  if (
    !challenge ||
    typeof challenge !== "object" ||
    !("challengeId" in challenge) ||
    typeof challenge.challengeId !== "string" ||
    !/^[a-zA-Z0-9_-]{16,128}$/.test(challenge.challengeId) ||
    !("nonce" in challenge) ||
    typeof challenge.nonce !== "string" ||
    !/^[a-f0-9]{64}$/.test(challenge.nonce)
  ) {
    return "challenge-error";
  }

  const result = await requestGoogleIdToken(config, challenge.nonce);
  if (result.status !== "token") return result.status;

  const verification = await postJson(fetch, config.verifierOrigin + "/google-proof/verify", {
    challengeId: challenge.challengeId,
    idToken: result.idToken,
  });

  return verification &&
    typeof verification === "object" &&
    "verified" in verification &&
    verification.verified === true
    ? "verified"
    : "verification-error";
}
