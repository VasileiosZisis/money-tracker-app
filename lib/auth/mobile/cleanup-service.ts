import "server-only";

import { Prisma } from "@/generated/prisma/client";

import { isMobileExpiryReached } from "./expiry";
import { mobileDatabaseClock, readMobileDatabaseTime, runMobileTransaction, type MobileDatabaseFailure } from "./lifecycle-store";

const challengeBatchSize = 50;
const sessionBatchSize = 20;
const refreshHistoryBatchSize = 200;

export type MobileCleanupResult =
  | { status: "cleaned"; challengesDeleted: number; refreshCredentialsDeleted: number; sessionsDeleted: number }
  | MobileDatabaseFailure;

type CleanupCandidate = { id: string; expiresAt: Date };

export function cleanupExpiredMobileAuthRecords(): Promise<MobileCleanupResult> {
  return runMobileTransaction<MobileCleanupResult>(async (tx) => {
    const challenges = await tx.$queryRaw<CleanupCandidate[]>`
      SELECT "id", "expiresAt" FROM "MobileAuthChallenge"
      WHERE "expiresAt" <= (SELECT ${mobileDatabaseClock})
      ORDER BY "expiresAt", "id" LIMIT ${challengeBatchSize} FOR UPDATE SKIP LOCKED
    `;
    const sessions = await tx.$queryRaw<CleanupCandidate[]>`
      SELECT "id", "absoluteExpiresAt" AS "expiresAt" FROM "MobileSession"
      WHERE "absoluteExpiresAt" <= (SELECT ${mobileDatabaseClock})
      ORDER BY "absoluteExpiresAt", "id" LIMIT ${sessionBatchSize} FOR UPDATE SKIP LOCKED
    `;
    const now = await readMobileDatabaseTime(tx);
    const challengeIds = challenges.filter(({ expiresAt }) => isMobileExpiryReached(expiresAt, now)).map(({ id }) => id);
    const sessionIds = sessions.filter(({ expiresAt }) => isMobileExpiryReached(expiresAt, now)).map(({ id }) => id);

    let challengesDeleted = 0;
    if (challengeIds.length > 0) {
      const result = await tx.mobileAuthChallenge.deleteMany({
        where: { id: { in: challengeIds }, expiresAt: { lte: now } },
      });
      challengesDeleted = result.count;
    }

    let refreshCredentialsDeleted = 0;
    let sessionsDeleted = 0;
    if (sessionIds.length > 0) {
      // The selected parents stay locked through both deletes. Never cascade their history as part of cleanup.
      refreshCredentialsDeleted = await tx.$executeRaw`
        WITH batch AS (
          SELECT "tokenDigest" FROM "MobileRefreshCredential"
          WHERE "sessionId" IN (${Prisma.join(sessionIds)})
          LIMIT ${refreshHistoryBatchSize}
        )
        DELETE FROM "MobileRefreshCredential" r
        USING batch WHERE r."tokenDigest" = batch."tokenDigest"
      `;
      const result = await tx.mobileSession.deleteMany({
        where: { id: { in: sessionIds }, absoluteExpiresAt: { lte: now }, refreshCredentials: { none: {} } },
      });
      sessionsDeleted = result.count;
    }

    return { status: "cleaned", challengesDeleted, refreshCredentialsDeleted, sessionsDeleted };
  });
}
