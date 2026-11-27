import "server-only";

const clock = "date_trunc('milliseconds', clock_timestamp())";

// Only these statements can run through a mobile transaction callback.
export const mobileStatements = {
  clock: ["SELECT", `SELECT ${clock} AS "now"`],
  insertChallenge: ["INSERT", `
    INSERT INTO "MobileAuthChallenge" ("id", "nonceDigest", "createdAt", "expiresAt")
    VALUES ($1, $2, $3, $4)
  `],
  readChallenge: ["SELECT", `
    SELECT "nonceDigest" FROM "MobileAuthChallenge"
    WHERE "id" = $1 AND "consumedAt" IS NULL AND "expiresAt" > ${clock}
  `],
  lockChallenge: ["SELECT", `
    SELECT "nonceDigest", "expiresAt", "consumedAt" FROM "MobileAuthChallenge"
    WHERE "id" = $1 FOR UPDATE
  `],
  readGoogleAccount: ["SELECT", `
    SELECT "userId" FROM "Account" WHERE "provider" = $1 AND "providerAccountId" = $2
  `],
  lockUser: ["SELECT", 'SELECT "id" FROM "User" WHERE "id" = $1 FOR KEY SHARE'],
  lockGoogleAccount: ["SELECT", `
    SELECT "userId" FROM "Account"
    WHERE "provider" = 'google' AND "providerAccountId" = $1 AND "userId" = $2
    FOR SHARE
  `],
  consumeChallenge: ["UPDATE", `
    UPDATE "MobileAuthChallenge" SET "consumedAt" = $2 WHERE "id" = $1 AND "consumedAt" IS NULL
  `],
  insertSession: ["INSERT", `
    INSERT INTO "MobileSession" ("id", "userId", "createdAt", "absoluteExpiresAt", "accessTokenDigest", "accessExpiresAt")
    VALUES ($1, $2, $3, $4, $5, $6)
  `],
  insertRefresh: ["INSERT", `
    INSERT INTO "MobileRefreshCredential" ("sessionId", "tokenDigest", "issuedAt", "expiresAt") VALUES ($1, $2, $3, $4)
  `],
  readAccess: ["SELECT", `
    WITH auth_time AS MATERIALIZED (SELECT ${clock} AS "now")
    SELECT u."id" AS "userId", s."id" AS "sessionId"
    FROM "MobileSession" s
    JOIN "User" u ON u."id" = s."userId"
    CROSS JOIN auth_time
    WHERE s."accessTokenDigest" = $1 AND s."revokedAt" IS NULL
      AND s."accessExpiresAt" > auth_time."now" AND s."absoluteExpiresAt" > auth_time."now"
  `],
  readRefreshSessionId: ["SELECT", 'SELECT "sessionId" FROM "MobileRefreshCredential" WHERE "tokenDigest" = $1'],
  lockSession: ["SELECT", `
    SELECT "id", "absoluteExpiresAt", "revokedAt" FROM "MobileSession" WHERE "id" = $1 FOR UPDATE
  `],
  rereadRefresh: ["SELECT", `
    SELECT "expiresAt", "consumedAt" FROM "MobileRefreshCredential" WHERE "tokenDigest" = $1 AND "sessionId" = $2
  `],
  revokeSession: ["UPDATE", 'UPDATE "MobileSession" SET "revokedAt" = $2 WHERE "id" = $1 AND "revokedAt" IS NULL'],
  consumeRefresh: ["UPDATE", `
    UPDATE "MobileRefreshCredential" SET "consumedAt" = $3
    WHERE "tokenDigest" = $1 AND "sessionId" = $2 AND "consumedAt" IS NULL
  `],
  rotateAccess: ["UPDATE", `
    UPDATE "MobileSession" SET "accessTokenDigest" = $2, "accessExpiresAt" = $3
    WHERE "id" = $1 AND "revokedAt" IS NULL
  `],
  lockBucket: ["SELECT", `
    SELECT "windowStartedAt", "expiresAt", "admittedCount" FROM "MobileRateLimitBucket"
    WHERE "policy" = $1 AND "bucketKey" = $2 FOR UPDATE
  `],
  lockCapacity: ["SELECT", 'SELECT "bucketCount" FROM "MobileRateLimitCapacity" WHERE "id" = $1 FOR UPDATE'],
  updateCapacity: ["UPDATE", `
    UPDATE "MobileRateLimitCapacity" SET "bucketCount" = $3 WHERE "id" = $1 AND "bucketCount" = $2
  `],
  readChallengeWindow: ["SELECT", `
    SELECT "createdAt" AS "windowStartedAt", "expiresAt" FROM "MobileAuthChallenge"
    WHERE "id" = $1 AND "consumedAt" IS NULL AND "expiresAt" > ${clock}
  `],
  insertBucket: ["INSERT", `
    INSERT INTO "MobileRateLimitBucket" ("policy", "bucketKey", "windowStartedAt", "expiresAt", "admittedCount")
    VALUES ($1, $2, $3, $4, 1)
  `],
  incrementBucket: ["UPDATE", `
    UPDATE "MobileRateLimitBucket" SET "admittedCount" = "admittedCount" + 1 WHERE "policy" = $1 AND "bucketKey" = $2
  `],
  resetBucket: ["UPDATE", `
    UPDATE "MobileRateLimitBucket" SET "windowStartedAt" = $3, "expiresAt" = $4, "admittedCount" = 1
    WHERE "policy" = $1 AND "bucketKey" = $2
  `],
  deleteExpiredBuckets: ["DELETE", `
    WITH expired AS (
      SELECT "policy", "bucketKey" FROM "MobileRateLimitBucket"
      WHERE "expiresAt" <= $1
      ORDER BY "expiresAt", "policy", "bucketKey" LIMIT $2 FOR UPDATE SKIP LOCKED
    )
    DELETE FROM "MobileRateLimitBucket" b USING expired
    WHERE b."policy" = expired."policy" AND b."bucketKey" = expired."bucketKey" AND b."expiresAt" <= $3
  `],
  lockExpiredChallenges: ["SELECT", `
    SELECT "id", "expiresAt" FROM "MobileAuthChallenge"
    WHERE "expiresAt" <= (SELECT ${clock})
    ORDER BY "expiresAt", "id" LIMIT $1 FOR UPDATE SKIP LOCKED
  `],
  lockExpiredSessions: ["SELECT", `
    SELECT "id", "absoluteExpiresAt" AS "expiresAt" FROM "MobileSession"
    WHERE "absoluteExpiresAt" <= (SELECT ${clock})
    ORDER BY "absoluteExpiresAt", "id" LIMIT $1 FOR UPDATE SKIP LOCKED
  `],
  deleteExpiredChallenges: ["DELETE", `
    DELETE FROM "MobileAuthChallenge" WHERE "id" = ANY($1::text[]) AND "expiresAt" <= $2
  `],
  deleteRefreshHistory: ["DELETE", `
    WITH batch AS (
      SELECT "tokenDigest" FROM "MobileRefreshCredential" WHERE "sessionId" = ANY($1::text[]) LIMIT $2
    )
    DELETE FROM "MobileRefreshCredential" r USING batch WHERE r."tokenDigest" = batch."tokenDigest"
  `],
  deleteExpiredSessions: ["DELETE", `
    DELETE FROM "MobileSession" s WHERE s."id" = ANY($1::text[]) AND s."absoluteExpiresAt" <= $2
      AND NOT EXISTS (SELECT 1 FROM "MobileRefreshCredential" r WHERE r."sessionId" = s."id")
  `],
} as const;

export type MobileStatement = keyof typeof mobileStatements;
