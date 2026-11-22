const clientIdPattern = /^\d+-[a-z0-9-]+\.apps\.googleusercontent\.com$/i;
const subjectPattern = /^[\x21-\x7e]{1,255}$/;

function readAllowlist(env, name, pattern) {
  const values = env[name]?.split(",").map((value) => value.trim());
  if (!values?.every((value) => pattern.test(value))) {
    throw new Error("Set " + name + " to a comma-separated list of approved test values.");
  }
  return new Set(values);
}

export function readConfig(env) {
  const audience = env.GOOGLE_PROOF_AUDIENCE?.trim();
  if (!audience || !clientIdPattern.test(audience)) {
    throw new Error("Set GOOGLE_PROOF_AUDIENCE to the development Web OAuth client ID.");
  }

  const portText = env.GOOGLE_PROOF_PORT ?? "8787";
  const port = Number(portText);
  if (!/^\d+$/.test(portText) || !Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("Set GOOGLE_PROOF_PORT to a valid TCP port.");
  }

  return {
    audience,
    allowedPresenters: readAllowlist(env, "GOOGLE_PROOF_ALLOWED_PRESENTERS", clientIdPattern),
    allowedSubjects: readAllowlist(env, "GOOGLE_PROOF_ALLOWED_SUBJECTS", subjectPattern),
    port,
  };
}
