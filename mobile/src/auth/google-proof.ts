import type { fetch } from "expo/fetch";
import type { requestGoogleIdToken } from "./google-sign-in";

export type GoogleProofConfig = {
  webClientId: string;
  iosClientId: string | null;
  verifierOrigin: string;
};

export function readGoogleProofConfig(settings: unknown, platform: string): GoogleProofConfig | null {
  if (!settings || typeof settings !== "object") return null;
  const { webClientId, iosClientId, verifierOrigin } = settings as Partial<Record<keyof GoogleProofConfig, unknown>>;
  if (typeof webClientId !== "string" || !webClientId || typeof verifierOrigin !== "string" || !verifierOrigin) {
    return null;
  }
  if (platform === "android") return { webClientId, iosClientId: null, verifierOrigin };
  if (platform === "ios" && typeof iosClientId === "string" && iosClientId) {
    return { webClientId, iosClientId, verifierOrigin };
  }
  return null;
}

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
  if (result.status === "google-error") {
    return { status: result.status, step: result.step, code: result.code };
  }
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
