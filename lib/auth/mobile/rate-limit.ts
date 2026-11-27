import "server-only";

import { isMobileChallengeId } from "./credentials";
import { getMobileChallengeExpiry } from "./expiry";
import {
  isMobileDatabaseDate,
  optionalMobileRow,
  readMobileDatabaseTime,
  requireSingleMobileWrite,
  runMobileTransaction,
  type MobileDatabaseFailure,
} from "./lifecycle-store";
import type { MobileTransaction } from "./mobile-transaction";
import { deriveMobileRateLimitKey, readMobileRateLimitSecret } from "./rate-limit-keys";
import { readTrustedMobileSourceGroup, type TrustedMobileRequestSource } from "./request-source";

const policies = {
  challenge_source: { scope: "source", limit: 10 },
  exchange_source: { scope: "source", limit: 20 },
  exchange_challenge: { scope: "challenge", limit: 5 },
  refresh_source: { scope: "source", limit: 30 },
  refresh_session: { scope: "session", limit: 10 },
  logout_source: { scope: "source", limit: 30 },
  financial_write_account: { scope: "account", limit: 60 },
} as const;

type PolicyName = keyof typeof policies;
export type MobileSourceRateLimitPolicy = {
  [P in PolicyName]: (typeof policies)[P]["scope"] extends "source" ? P : never;
}[PolicyName];

export type MobileRateLimitInput =
  | { policy: MobileSourceRateLimitPolicy; source: TrustedMobileRequestSource }
  | { policy: "exchange_challenge"; challengeId: string }
  // These IDs come from authenticated server state, including the locked session for refresh.
  | { policy: "refresh_session"; sessionId: string }
  | { policy: "financial_write_account"; userId: string };

export type MobileRateLimitResult =
  | { status: "allowed" }
  | { status: "rate_limited"; retryAfterSeconds: number }
  | { status: "capacity_unavailable"; retryAfterSeconds: number }
  | { status: "configuration_error" }
  | { status: "source_unavailable" }
  | { status: "scope_unavailable" }
  | MobileDatabaseFailure;

export type MobileRateLimitCleanupResult = { status: "cleaned"; bucketsDeleted: number } | MobileDatabaseFailure;

const minuteMs = 60_000;
const capacityId = 1;
const maxBuckets = 10_000;
const cleanupBatchSize = 200;
const capacityRetrySeconds = 5;

type BucketIdentity = { policy: PolicyName; bucketKey: Uint8Array };
type Window = { windowStartedAt: Date; expiresAt: Date };
type BucketState = Window & { admittedCount: number };

function readScopeIdentity(input: MobileRateLimitInput): string | undefined {
  switch (input.policy) {
    case "exchange_challenge":
      return isMobileChallengeId(input.challengeId) ? input.challengeId : undefined;
    case "refresh_session":
      return typeof input.sessionId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(input.sessionId)
        ? input.sessionId : undefined;
    case "financial_write_account":
      return typeof input.userId === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(input.userId)
        ? input.userId : undefined;
    default:
      return readTrustedMobileSourceGroup(input.source);
  }
}

async function lockBucket(tx: MobileTransaction, { policy, bucketKey }: BucketIdentity) {
  const bucket = optionalMobileRow((await tx.query<BucketState>("lockBucket", [policy, bucketKey])).rows);
  if (bucket && (!isMobileDatabaseDate(bucket.windowStartedAt) || !isMobileDatabaseDate(bucket.expiresAt) ||
    !Number.isSafeInteger(bucket.admittedCount) || bucket.admittedCount < 1 || bucket.admittedCount > policies[policy].limit)) {
    throw new Error("Invalid mobile rate limit bucket");
  }
  return bucket;
}

async function lockCapacity(tx: MobileTransaction): Promise<number> {
  const row = optionalMobileRow((await tx.query<{ bucketCount: number }>("lockCapacity", [capacityId])).rows);
  if (!row || !Number.isSafeInteger(row.bucketCount) || row.bucketCount < 0 || row.bucketCount > maxBuckets) {
    throw new Error("Invalid mobile rate limit capacity");
  }
  return row.bucketCount;
}

async function updateCapacity(tx: MobileTransaction, count: number, change: number): Promise<void> {
  requireSingleMobileWrite(await tx.query("updateCapacity", [capacityId, count, count + change]));
}

async function readChallengeWindow(tx: MobileTransaction, challengeId: string) {
  const challenge = optionalMobileRow((await tx.query<Window>("readChallengeWindow", [challengeId])).rows);
  if (challenge && (!isMobileDatabaseDate(challenge.windowStartedAt) || !isMobileDatabaseDate(challenge.expiresAt))) {
    throw new Error("Invalid mobile challenge window");
  }
  return challenge;
}

function resolveWindow(now: Date, challenge: Window | null): Window | null {
  const nowMs = now.getTime();
  if (challenge) {
    const start = challenge.windowStartedAt.getTime();
    const end = challenge.expiresAt.getTime();
    if (!(start <= nowMs && nowMs < end && end <= getMobileChallengeExpiry(challenge.windowStartedAt).getTime())) {
      return null;
    }
    return challenge;
  }
  const start = Math.floor(nowMs / minuteMs) * minuteMs;
  return { windowStartedAt: new Date(start), expiresAt: new Date(start + minuteMs) };
}

async function admitInTransaction(
  tx: MobileTransaction,
  identity: BucketIdentity,
  challengeId: string | null,
): Promise<MobileRateLimitResult> {
  const challenge = challengeId === null ? null : await readChallengeWindow(tx, challengeId);
  if (challenge === undefined) return { status: "scope_unavailable" };

  let bucket = await lockBucket(tx, identity);
  let capacity: number | undefined;
  if (!bucket) {
    capacity = await lockCapacity(tx);
    // A missing row holds no bucket lock. Once capacity is locked, check for a concurrent allocation.
    bucket = await lockBucket(tx, identity);
  }

  const now = await readMobileDatabaseTime(tx);
  const window = resolveWindow(now, challenge);
  if (!window) return { status: "scope_unavailable" };

  if (!bucket) {
    if (capacity === undefined) throw new Error("Missing mobile rate limit allocation lock");
    if (capacity >= maxBuckets) return { status: "capacity_unavailable", retryAfterSeconds: capacityRetrySeconds };

    requireSingleMobileWrite(await tx.query("insertBucket", [
      identity.policy, identity.bucketKey, window.windowStartedAt, window.expiresAt,
    ]));
    await updateCapacity(tx, capacity, 1);
    return { status: "allowed" };
  }

  if (challenge && (
    bucket.windowStartedAt.getTime() !== window.windowStartedAt.getTime() ||
    bucket.expiresAt.getTime() !== window.expiresAt.getTime()
  )) return { status: "scope_unavailable" };

  if (bucket.expiresAt > now) {
    if (bucket.admittedCount >= policies[identity.policy].limit) {
      return {
        status: "rate_limited",
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.expiresAt.getTime() - now.getTime()) / 1_000)),
      };
    }
    requireSingleMobileWrite(await tx.query("incrementBucket", [identity.policy, identity.bucketKey]));
  } else {
    requireSingleMobileWrite(await tx.query("resetBucket", [
      identity.policy, identity.bucketKey, window.windowStartedAt, window.expiresAt,
    ]));
  }
  return { status: "allowed" };
}

function prepareAdmission(input: MobileRateLimitInput) {
  if (!Object.hasOwn(policies, input.policy)) return { status: "scope_unavailable" } as const;
  const { scope } = policies[input.policy];
  const value = readScopeIdentity(input);
  if (value === undefined) return { status: scope === "source" ? "source_unavailable" : "scope_unavailable" } as const;

  const secret = readMobileRateLimitSecret();
  if (!secret) return { status: "configuration_error" } as const;
  const identity = { policy: input.policy, bucketKey: deriveMobileRateLimitKey(secret, input.policy, scope, value) };
  const challengeId = input.policy === "exchange_challenge" ? input.challengeId : null;

  return { status: "prepared", identity, challengeId } as const;
}

export async function admitMobileRateLimit(input: MobileRateLimitInput): Promise<MobileRateLimitResult> {
  const admission = prepareAdmission(input);
  if (admission.status !== "prepared") return admission;
  return runMobileTransaction((tx) => admitInTransaction(tx, admission.identity, admission.challengeId));
}

// The refresh transaction holds the trusted session row lock. Database errors must
// propagate to that transaction so its admission and credential writes roll back together.
export async function admitMobileRefreshSession(
  tx: MobileTransaction,
  sessionId: string,
): Promise<MobileRateLimitResult> {
  const admission = prepareAdmission({ policy: "refresh_session", sessionId });
  if (admission.status !== "prepared") return admission;
  return admitInTransaction(tx, admission.identity, admission.challengeId);
}

export function cleanupExpiredMobileRateLimits(): Promise<MobileRateLimitCleanupResult> {
  return runMobileTransaction<MobileRateLimitCleanupResult>(async (tx) => {
    const capacity = await lockCapacity(tx);
    const now = await readMobileDatabaseTime(tx);
    const { rowCount: bucketsDeleted } = await tx.query("deleteExpiredBuckets", [now, cleanupBatchSize, now]);
    if (bucketsDeleted > capacity || bucketsDeleted > cleanupBatchSize) {
      throw new Error("Invalid mobile rate limit cleanup count");
    }
    if (bucketsDeleted > 0) await updateCapacity(tx, capacity, -bucketsDeleted);
    return { status: "cleaned", bucketsDeleted };
  });
}
