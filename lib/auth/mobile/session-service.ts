import "server-only";

import { timingSafeEqual } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";

import {
  createMobileChallengeId,
  createMobileNonce,
  createMobileToken,
  digestMobileNonce,
  digestMobileToken,
  isMobileChallengeId,
} from "./credentials";
import { getMobileChallengeExpiry, getMobileCredentialExpiries, getMobileSessionDeadline, isMobileExpiryReached } from "./expiry";
import { findMobileGoogleAccount } from "./google-account";
import { maxMobileGoogleIdTokenLength, verifyMobileGoogleProof, type MobileGoogleVerification } from "./google-verification";
import {
  mobileDatabaseClock,
  readMobileDatabaseTime,
  requireSingleMobileWrite,
  runMobileTransaction,
  type MobileDatabaseFailure,
} from "./lifecycle-store";
import { admitMobileRefreshSession, type MobileRateLimitResult } from "./rate-limit";

type MobileTokens = {
  accessToken: string;
  accessExpiresAt: Date;
  refreshToken: string;
  refreshExpiresAt: Date;
};

export type MobileChallengeResult =
  | { status: "issued"; challengeId: string; nonce: string; expiresAt: Date }
  | MobileDatabaseFailure;

export type MobileGoogleExchangeInput = { challengeId: unknown; idToken: unknown };
export type MobileGoogleExchangeResult =
  | { status: "authenticated"; tokens: MobileTokens }
  | { status: "account_not_linked" }
  | Exclude<MobileGoogleVerification, { status: "verified" }>
  | MobileDatabaseFailure;

export type MobileAccessResult =
  | { status: "authenticated"; userId: string; sessionId: string }
  | { status: "invalid_credential" }
  | MobileDatabaseFailure;

export type MobileRefreshResult =
  | { status: "rotated"; tokens: MobileTokens }
  | { status: "invalid_credential" | "credential_reused" }
  | Exclude<MobileRateLimitResult, { status: "allowed" }>;

export type MobileLogoutResult =
  | { status: "logged_out" }
  | { status: "malformed_credential" }
  | MobileDatabaseFailure;

export type MobileRevocationResult =
  | { status: "revoked" | "no_change" }
  | MobileDatabaseFailure;

type LockedChallenge = { nonceDigest: Uint8Array; expiresAt: Date; consumedAt: Date | null };
type LockedSession = { id: string; absoluteExpiresAt: Date; revokedAt: Date | null };

function createSessionCredentials(now: Date, deadline: Date) {
  const expiries = getMobileCredentialExpiries(now, deadline);
  if (!expiries) throw new Error("Invalid mobile session deadline");

  const accessToken = createMobileToken("access");
  const refreshToken = createMobileToken("refresh");
  const accessTokenDigest = digestMobileToken("access", accessToken);
  const refreshTokenDigest = digestMobileToken("refresh", refreshToken);
  if (!accessTokenDigest || !refreshTokenDigest) throw new Error("Invalid generated mobile credential");

  return { tokens: { accessToken, refreshToken, ...expiries }, accessTokenDigest, refreshTokenDigest };
}

export function issueMobileAuthChallenge(): Promise<MobileChallengeResult> {
  return runMobileTransaction<MobileChallengeResult>(async (tx) => {
    const now = await readMobileDatabaseTime(tx);
    const challengeId = createMobileChallengeId();
    const nonce = createMobileNonce();
    const nonceDigest = digestMobileNonce(nonce);
    if (!nonceDigest) throw new Error("Invalid generated mobile nonce");

    const expiresAt = getMobileChallengeExpiry(now);
    await tx.mobileAuthChallenge.create({
      data: { id: challengeId, nonceDigest, createdAt: now, expiresAt },
      select: { id: true },
    });
    return { status: "issued", challengeId, nonce, expiresAt };
  });
}

async function pinGoogleAccount(tx: Prisma.TransactionClient, subject: string, userId: string): Promise<void> {
  const [user] = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "User" WHERE "id" = ${userId} FOR KEY SHARE
  `;
  if (!user) throw new Error("Mobile Google user changed before locking");

  const [account] = await tx.$queryRaw<{ userId: string }[]>`
    SELECT "userId" FROM "Account"
    WHERE "provider" = 'google' AND "providerAccountId" = ${subject} AND "userId" = ${userId}
    FOR SHARE
  `;
  if (!account) throw new Error("Mobile Google account changed before locking");
}

export async function exchangeMobileGoogleProof({
  challengeId,
  idToken,
}: MobileGoogleExchangeInput): Promise<MobileGoogleExchangeResult> {
  if (
    !isMobileChallengeId(challengeId) ||
    typeof idToken !== "string" || !idToken || idToken.length > maxMobileGoogleIdTokenLength
  ) return { status: "invalid_proof" };

  const preliminary = await runMobileTransaction((tx) => tx.$queryRaw<{ nonceDigest: Uint8Array }[]>`
    SELECT "nonceDigest" FROM "MobileAuthChallenge"
    WHERE "id" = ${challengeId}
      AND "consumedAt" IS NULL AND "expiresAt" > ${mobileDatabaseClock}
  `);
  if ("status" in preliminary) return preliminary;
  const [candidate] = preliminary;
  if (!candidate) return { status: "invalid_proof" };

  // The preliminary read has committed before any Google work or exchange locks.
  let verification: MobileGoogleVerification;
  try {
    verification = await verifyMobileGoogleProof(idToken, candidate.nonceDigest);
  } catch {
    return { status: "verification_error" };
  }
  if (verification.status !== "verified") return verification;
  const { proof } = verification;

  return runMobileTransaction<MobileGoogleExchangeResult>(async (tx) => {
    const [challenge] = await tx.$queryRaw<LockedChallenge[]>`
      SELECT "nonceDigest", "expiresAt", "consumedAt" FROM "MobileAuthChallenge"
      WHERE "id" = ${challengeId} FOR UPDATE
    `;
    if (!challenge || challenge.consumedAt !== null) return { status: "invalid_proof" };

    const account = await findMobileGoogleAccount(proof, tx);
    if (account.status !== "linked" && account.status !== "account_not_linked") return account;
    if (account.status === "linked") await pinGoogleAccount(tx, proof.subject, account.userId);

    const now = await readMobileDatabaseTime(tx);
    if (isMobileExpiryReached(challenge.expiresAt, now) || now.getTime() >= proof.expiresAtMs) {
      return { status: "invalid_proof" };
    }

    const proofDigest = proof.nonceDigest;
    if (challenge.nonceDigest.byteLength !== proofDigest.byteLength) return { status: "verification_error" };
    if (!timingSafeEqual(challenge.nonceDigest, proofDigest)) return { status: "invalid_nonce" };

    requireSingleMobileWrite(await tx.mobileAuthChallenge.updateMany({
      where: { id: challengeId, consumedAt: null },
      data: { consumedAt: now },
    }));
    if (account.status === "account_not_linked") return { status: "account_not_linked" };

    const absoluteExpiresAt = getMobileSessionDeadline(now);
    const { tokens, accessTokenDigest, refreshTokenDigest } = createSessionCredentials(now, absoluteExpiresAt);
    const session = await tx.mobileSession.create({
      data: {
        userId: account.userId, createdAt: now, absoluteExpiresAt, accessTokenDigest, accessExpiresAt: tokens.accessExpiresAt,
      },
      select: { id: true },
    });
    await tx.mobileRefreshCredential.create({
      data: { sessionId: session.id, tokenDigest: refreshTokenDigest, issuedAt: now, expiresAt: tokens.refreshExpiresAt },
      select: { sessionId: true },
    });
    return { status: "authenticated", tokens };
  });
}

export async function authenticateMobileAccess(accessToken: unknown): Promise<MobileAccessResult> {
  const digest = digestMobileToken("access", accessToken);
  if (!digest) return { status: "invalid_credential" };

  return runMobileTransaction<MobileAccessResult>(async (tx) => {
    const [identity] = await tx.$queryRaw<{ userId: string; sessionId: string }[]>`
      WITH auth_time AS MATERIALIZED (SELECT ${mobileDatabaseClock} AS "now")
      SELECT u."id" AS "userId", s."id" AS "sessionId"
      FROM "MobileSession" s
      JOIN "User" u ON u."id" = s."userId"
      CROSS JOIN auth_time
      WHERE s."accessTokenDigest" = ${digest} AND s."revokedAt" IS NULL
        AND s."accessExpiresAt" > auth_time."now" AND s."absoluteExpiresAt" > auth_time."now"
    `;
    return identity
      ? { status: "authenticated", userId: identity.userId, sessionId: identity.sessionId }
      : { status: "invalid_credential" };
  });
}

async function lockMobileSession(tx: Prisma.TransactionClient, sessionId: string) {
  const [session] = await tx.$queryRaw<LockedSession[]>`
    SELECT "id", "absoluteExpiresAt", "revokedAt" FROM "MobileSession" WHERE "id" = ${sessionId} FOR UPDATE
  `;
  return session;
}

async function lockSessionForRefreshDigest(tx: Prisma.TransactionClient, tokenDigest: Prisma.Bytes) {
  const candidate = await tx.mobileRefreshCredential.findUnique({ where: { tokenDigest }, select: { sessionId: true } });
  if (!candidate) return null;

  const session = await lockMobileSession(tx, candidate.sessionId);
  if (!session) return null;

  // A separate Read Committed statement sees a predecessor consumed by a transaction we waited for.
  const credential = await tx.mobileRefreshCredential.findUnique({
    where: { tokenDigest, sessionId: session.id },
    select: { expiresAt: true, consumedAt: true },
  });
  return credential ? { session, credential } : null;
}

function isLiveSession(session: LockedSession, now: Date): boolean {
  return session.revokedAt === null && !isMobileExpiryReached(session.absoluteExpiresAt, now);
}

async function markMobileSessionRevoked(tx: Prisma.TransactionClient, sessionId: string, now: Date): Promise<void> {
  requireSingleMobileWrite(await tx.mobileSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: now },
  }));
}

export async function rotateMobileRefresh(refreshToken: unknown): Promise<MobileRefreshResult> {
  const tokenDigest = digestMobileToken("refresh", refreshToken);
  if (!tokenDigest) return { status: "invalid_credential" };

  return runMobileTransaction<MobileRefreshResult>(async (tx) => {
    const locked = await lockSessionForRefreshDigest(tx, tokenDigest);
    if (!locked) return { status: "invalid_credential" };

    const { session, credential } = locked;
    const now = await readMobileDatabaseTime(tx);
    if (!isLiveSession(session, now)) return { status: "invalid_credential" };
    if (credential.consumedAt !== null) {
      await markMobileSessionRevoked(tx, session.id, now);
      // Return normally so the replay revocation commits before the caller rejects the credential.
      return { status: "credential_reused" };
    }
    if (isMobileExpiryReached(credential.expiresAt, now)) return { status: "invalid_credential" };

    const admission = await admitMobileRefreshSession(tx, session.id);
    if (admission.status !== "allowed") return admission;

    const rotationTime = await readMobileDatabaseTime(tx);
    if (!isLiveSession(session, rotationTime) || isMobileExpiryReached(credential.expiresAt, rotationTime)) {
      // Commit the admitted attempt. The credential stays unconsumed when a limiter wait crossed expiry.
      return { status: "invalid_credential" };
    }

    const { tokens, accessTokenDigest, refreshTokenDigest } = createSessionCredentials(rotationTime, session.absoluteExpiresAt);
    requireSingleMobileWrite(await tx.mobileRefreshCredential.updateMany({
      where: { tokenDigest, sessionId: session.id, consumedAt: null },
      data: { consumedAt: rotationTime },
    }));
    await tx.mobileRefreshCredential.create({
      data: { sessionId: session.id, tokenDigest: refreshTokenDigest, issuedAt: rotationTime, expiresAt: tokens.refreshExpiresAt },
      select: { sessionId: true },
    });
    requireSingleMobileWrite(await tx.mobileSession.updateMany({
      where: { id: session.id, revokedAt: null },
      data: { accessTokenDigest, accessExpiresAt: tokens.accessExpiresAt },
    }));
    return { status: "rotated", tokens };
  });
}

export async function logoutMobileSession(refreshToken: unknown): Promise<MobileLogoutResult> {
  const tokenDigest = digestMobileToken("refresh", refreshToken);
  if (!tokenDigest) return { status: "malformed_credential" };

  return runMobileTransaction<MobileLogoutResult>(async (tx) => {
    const locked = await lockSessionForRefreshDigest(tx, tokenDigest);
    if (!locked) return { status: "logged_out" };

    const now = await readMobileDatabaseTime(tx);
    if (isLiveSession(locked.session, now)) await markMobileSessionRevoked(tx, locked.session.id, now);
    return { status: "logged_out" };
  });
}

// Only a trusted internal caller may supply this ID. This is not an operator authorization boundary.
export function revokeMobileSessionById(sessionId: string): Promise<MobileRevocationResult> {
  return runMobileTransaction<MobileRevocationResult>(async (tx) => {
    const session = await lockMobileSession(tx, sessionId);
    if (!session) return { status: "no_change" };

    const now = await readMobileDatabaseTime(tx);
    if (!isLiveSession(session, now)) return { status: "no_change" };

    await markMobileSessionRevoked(tx, session.id, now);
    return { status: "revoked" };
  });
}
