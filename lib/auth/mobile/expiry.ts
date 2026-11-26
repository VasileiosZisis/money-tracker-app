import "server-only";

const minuteMs = 60_000;
const dayMs = 24 * 60 * minuteMs;
const challengeLifetimeMs = 5 * minuteMs;
const accessLifetimeMs = 10 * minuteMs;
const refreshInactivityMs = 14 * dayMs;
const sessionLifetimeMs = 30 * dayMs;

export function getMobileChallengeExpiry(issuedAt: Date): Date {
  return new Date(issuedAt.getTime() + challengeLifetimeMs);
}

export function getMobileSessionDeadline(createdAt: Date): Date {
  return new Date(createdAt.getTime() + sessionLifetimeMs);
}

export function isMobileExpiryReached(expiresAt: Date, now: Date): boolean {
  // An invalid instant cannot establish that a credential is still valid.
  return !(now.getTime() < expiresAt.getTime());
}

export function getMobileCredentialExpiries(issuedAt: Date, absoluteExpiresAt: Date) {
  if (isMobileExpiryReached(absoluteExpiresAt, issuedAt)) return null;

  const issuedMs = issuedAt.getTime();
  const deadlineMs = absoluteExpiresAt.getTime();
  return {
    accessExpiresAt: new Date(Math.min(issuedMs + accessLifetimeMs, deadlineMs)),
    refreshExpiresAt: new Date(Math.min(issuedMs + refreshInactivityMs, deadlineMs)),
  };
}
