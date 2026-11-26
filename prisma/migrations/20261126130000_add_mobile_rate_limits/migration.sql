BEGIN;

CREATE TABLE "MobileRateLimitBucket" (
    "policy" TEXT NOT NULL,
    "bucketKey" BYTEA NOT NULL,
    "windowStartedAt" TIMESTAMPTZ(3) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "admittedCount" INTEGER NOT NULL,

    CONSTRAINT "MobileRateLimitBucket_pkey" PRIMARY KEY ("policy", "bucketKey"),
    CONSTRAINT "MobileRateLimitBucket_key_length" CHECK (octet_length("bucketKey") = 32),
    CONSTRAINT "MobileRateLimitBucket_policy_count" CHECK (
        "admittedCount" BETWEEN 1 AND CASE "policy"
            WHEN 'challenge_source' THEN 10
            WHEN 'exchange_source' THEN 20
            WHEN 'exchange_challenge' THEN 5
            WHEN 'refresh_source' THEN 30
            WHEN 'refresh_session' THEN 10
            WHEN 'logout_source' THEN 30
            WHEN 'financial_write_account' THEN 60
            ELSE 0
        END
    ),
    CONSTRAINT "MobileRateLimitBucket_window" CHECK (
        isfinite("windowStartedAt") AND isfinite("expiresAt") AND "expiresAt" > "windowStartedAt"
        AND CASE WHEN "policy" = 'exchange_challenge' THEN
            "expiresAt" - "windowStartedAt" <= INTERVAL '5 minutes'
        ELSE
            EXTRACT(SECOND FROM "windowStartedAt" AT TIME ZONE 'UTC') = 0
            AND "expiresAt" - "windowStartedAt" = INTERVAL '1 minute'
        END
    )
);

CREATE INDEX "MobileRateLimitBucket_expiresAt_policy_bucketKey_idx"
ON "MobileRateLimitBucket"("expiresAt", "policy", "bucketKey");

CREATE TABLE "MobileRateLimitCapacity" (
    "id" INTEGER NOT NULL,
    "bucketCount" INTEGER NOT NULL,

    CONSTRAINT "MobileRateLimitCapacity_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "MobileRateLimitCapacity_singleton" CHECK ("id" = 1),
    CONSTRAINT "MobileRateLimitCapacity_count" CHECK ("bucketCount" BETWEEN 0 AND 10000)
);

INSERT INTO "MobileRateLimitCapacity" ("id", "bucketCount") VALUES (1, 0);

COMMIT;
