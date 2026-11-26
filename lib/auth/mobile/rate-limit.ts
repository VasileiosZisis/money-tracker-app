import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import { isMobileChallengeId } from "./credentials";
import { getMobileChallengeExpiry } from "./expiry";
import {
  mobileDatabaseClock,
  readMobileDatabaseTime,
  requireSingleMobileWrite,
  runMobileTransaction,
  type MobileDatabaseFailure,
} from "./lifecycle-store";
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

type BucketIdentity = { policy: PolicyName; bucketKey: Prisma.Bytes };
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

async function lockBucket(tx: Prisma.TransactionClient, { policy, bucketKey }: BucketIdentity) {
  const [bucket] = await tx.$queryRaw<BucketState[]>`
    SELECT "windowStartedAt", "expiresAt", "admittedCount" FROM "MobileRateLimitBucket"
    WHERE "policy" = ${policy} AND "bucketKey" = ${bucketKey} FOR UPDATE
  `;
  return bucket as BucketState | undefined;
}

async function lockCapacity(tx: Prisma.TransactionClient): Promise<number> {
  const [row] = await tx.$queryRaw<{ bucketCount: number }[]>`
    SELECT "bucketCount" FROM "MobileRateLimitCapacity" WHERE "id" = ${capacityId} FOR UPDATE
  `;
  if (!row) throw new Error("Missing mobile rate limit capacity row");
  return row.bucketCount;
}

async function updateCapacity(tx: Prisma.TransactionClient, count: number, change: number): Promise<void> {
  requireSingleMobileWrite(await tx.mobileRateLimitCapacity.updateMany({
    where: { id: capacityId, bucketCount: count },
    data: { bucketCount: count + change },
  }));
}

async function readChallengeWindow(tx: Prisma.TransactionClient, challengeId: string) {
  const [challenge] = await tx.$queryRaw<Window[]>`
    SELECT "createdAt" AS "windowStartedAt", "expiresAt" FROM "MobileAuthChallenge"
    WHERE "id" = ${challengeId} AND "consumedAt" IS NULL AND "expiresAt" > ${mobileDatabaseClock}
  `;
  return challenge as Window | undefined;
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
  tx: Prisma.TransactionClient,
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

    await tx.mobileRateLimitBucket.create({
      data: { ...identity, ...window, admittedCount: 1 },
      select: { policy: true },
    });
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
    requireSingleMobileWrite(await tx.mobileRateLimitBucket.updateMany({
      where: identity,
      data: { admittedCount: { increment: 1 } },
    }));
  } else {
    requireSingleMobileWrite(await tx.mobileRateLimitBucket.updateMany({
      where: identity,
      data: { ...window, admittedCount: 1 },
    }));
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
  tx: Prisma.TransactionClient,
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
    const bucketsDeleted = await tx.$executeRaw`
      WITH expired AS (
        SELECT "policy", "bucketKey" FROM "MobileRateLimitBucket"
        WHERE "expiresAt" <= ${now}
        ORDER BY "expiresAt", "policy", "bucketKey" LIMIT ${cleanupBatchSize} FOR UPDATE SKIP LOCKED
      )
      DELETE FROM "MobileRateLimitBucket" b USING expired
      WHERE b."policy" = expired."policy" AND b."bucketKey" = expired."bucketKey" AND b."expiresAt" <= ${now}
    `;
    if (bucketsDeleted > capacity || bucketsDeleted > cleanupBatchSize) {
      throw new Error("Invalid mobile rate limit cleanup count");
    }
    if (bucketsDeleted > 0) await updateCapacity(tx, capacity, -bucketsDeleted);
    return { status: "cleaned", bucketsDeleted };
  });
}
