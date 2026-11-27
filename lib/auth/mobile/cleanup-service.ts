import "server-only";

import { isMobileExpiryReached } from "./expiry";
import {
  isMobileDatabaseDate, isMobileDatabaseId, readMobileDatabaseTime, runMobileTransaction, type MobileDatabaseFailure,
} from "./lifecycle-store";

const challengeBatchSize = 50;
const sessionBatchSize = 20;
const refreshHistoryBatchSize = 200;

export type MobileCleanupResult =
  | { status: "cleaned"; challengesDeleted: number; refreshCredentialsDeleted: number; sessionsDeleted: number }
  | MobileDatabaseFailure;

type CleanupCandidate = { id: string; expiresAt: Date };

function expiredIds(rows: CleanupCandidate[], limit: number, now: Date) {
  if (rows.length > limit || rows.some((row) => !row || !isMobileDatabaseId(row.id) || !isMobileDatabaseDate(row.expiresAt))) {
    throw new Error("Invalid mobile cleanup candidates");
  }
  return rows.filter(({ expiresAt }) => isMobileExpiryReached(expiresAt, now)).map(({ id }) => id);
}

export function cleanupExpiredMobileAuthRecords(): Promise<MobileCleanupResult> {
  return runMobileTransaction<MobileCleanupResult>(async (tx) => {
    const challenges = await tx.query<CleanupCandidate>("lockExpiredChallenges", [challengeBatchSize]);
    const sessions = await tx.query<CleanupCandidate>("lockExpiredSessions", [sessionBatchSize]);
    const now = await readMobileDatabaseTime(tx);
    const challengeIds = expiredIds(challenges.rows, challengeBatchSize, now);
    const sessionIds = expiredIds(sessions.rows, sessionBatchSize, now);

    let challengesDeleted = 0;
    if (challengeIds.length > 0) {
      ({ rowCount: challengesDeleted } = await tx.query("deleteExpiredChallenges", [challengeIds, now]));
    }

    let refreshCredentialsDeleted = 0;
    let sessionsDeleted = 0;
    if (sessionIds.length > 0) {
      // The selected parents stay locked through both deletes. Never cascade their history as part of cleanup.
      ({ rowCount: refreshCredentialsDeleted } = await tx.query("deleteRefreshHistory", [sessionIds, refreshHistoryBatchSize]));
      ({ rowCount: sessionsDeleted } = await tx.query("deleteExpiredSessions", [sessionIds, now]));
    }
    if (challengesDeleted > challengeIds.length || sessionsDeleted > sessionIds.length ||
      refreshCredentialsDeleted > refreshHistoryBatchSize) {
      throw new Error("Invalid mobile authentication deletion count");
    }

    return { status: "cleaned", challengesDeleted, refreshCredentialsDeleted, sessionsDeleted };
  });
}
