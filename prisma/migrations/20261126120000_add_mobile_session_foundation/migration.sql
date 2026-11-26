BEGIN;

-- CreateTable
CREATE TABLE "MobileAuthChallenge" (
    "id" TEXT NOT NULL,
    "nonceDigest" BYTEA NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),

    CONSTRAINT "MobileAuthChallenge_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MobileAuthChallenge_nonce_digest_length" CHECK (octet_length("nonceDigest") = 32),
    CONSTRAINT "MobileAuthChallenge_timestamps" CHECK (
        "createdAt" < "expiresAt"
        AND ("consumedAt" IS NULL OR ("createdAt" <= "consumedAt" AND "consumedAt" < "expiresAt"))
    )
);

CREATE TABLE "MobileSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL,
    "accessTokenDigest" BYTEA NOT NULL,
    "accessExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "absoluteExpiresAt" TIMESTAMPTZ(3) NOT NULL,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "MobileSession_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MobileSession_access_digest_length" CHECK (octet_length("accessTokenDigest") = 32),
    CONSTRAINT "MobileSession_timestamps" CHECK (
        "createdAt" < "accessExpiresAt" AND "accessExpiresAt" <= "absoluteExpiresAt"
        AND ("revokedAt" IS NULL OR "createdAt" <= "revokedAt")
    ),
    CONSTRAINT "MobileSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "MobileRefreshCredential" (
    "tokenDigest" BYTEA NOT NULL,
    "sessionId" TEXT NOT NULL,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "consumedAt" TIMESTAMPTZ(3),

    CONSTRAINT "MobileRefreshCredential_pkey" PRIMARY KEY ("tokenDigest"),
    CONSTRAINT "MobileRefreshCredential_digest_length" CHECK (octet_length("tokenDigest") = 32),
    CONSTRAINT "MobileRefreshCredential_timestamps" CHECK (
        "issuedAt" < "expiresAt"
        AND ("consumedAt" IS NULL OR ("issuedAt" <= "consumedAt" AND "consumedAt" < "expiresAt"))
    ),
    CONSTRAINT "MobileRefreshCredential_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "MobileSession"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MobileAuthChallenge_expiresAt_id_idx" ON "MobileAuthChallenge"("expiresAt", "id");
CREATE UNIQUE INDEX "MobileSession_accessTokenDigest_key" ON "MobileSession"("accessTokenDigest");
CREATE INDEX "MobileSession_userId_idx" ON "MobileSession"("userId");
CREATE INDEX "MobileSession_absoluteExpiresAt_id_idx" ON "MobileSession"("absoluteExpiresAt", "id");
CREATE INDEX "MobileRefreshCredential_sessionId_idx" ON "MobileRefreshCredential"("sessionId");

-- Spent digests remain queryable while only one credential can be unconsumed.
CREATE UNIQUE INDEX "MobileRefreshCredential_current_session_key"
ON "MobileRefreshCredential"("sessionId") WHERE "consumedAt" IS NULL;

COMMIT;
