import "server-only";

export function isMobileAuthApiEnabled(): boolean {
  return process.env.MOBILE_AUTH_API_ENABLED === "true";
}
