import "server-only";

type MobileGoogleConfig = {
  audience: string;
  allowedPresenters: ReadonlySet<string>;
};

type MobileGoogleConfigResult =
  | { status: "configured"; config: MobileGoogleConfig }
  | { status: "configuration_error" };

function isGoogleClientId(value: string): boolean {
  return value.length <= 255 && /^\d+-[a-z0-9]+(?:-[a-z0-9]+)*\.apps\.googleusercontent\.com$/.test(value);
}

export function readMobileGoogleConfig(
  env: Readonly<Record<string, string | undefined>> = process.env,
): MobileGoogleConfigResult {
  const audience = env.MOBILE_GOOGLE_AUDIENCE?.trim();
  const presenters = env.MOBILE_GOOGLE_ALLOWED_PRESENTERS?.split(",").map((value) => value.trim());
  if (!audience || !isGoogleClientId(audience) || !presenters?.every(isGoogleClientId)) {
    return { status: "configuration_error" };
  }

  const allowedPresenters = new Set(presenters);
  if (allowedPresenters.size !== presenters.length) {
    return { status: "configuration_error" };
  }

  return { status: "configured", config: { audience, allowedPresenters } };
}
