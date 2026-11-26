import assert from "node:assert/strict";
import { createRequire, register } from "node:module";
import { before, beforeEach, test } from "node:test";

import { Prisma, type MobileRateLimitBucket } from "@/generated/prisma/client";

import type { TrustedMobileRequestSource } from "./request-source";

type Challenge = { windowStartedAt: Date; expiresAt: Date; consumedAt: Date | null };
type State = {
  buckets: Map<string, MobileRateLimitBucket>;
  capacity: number | undefined;
  challenges: Map<string, Challenge>;
};
type Identity = Pick<MobileRateLimitBucket, "policy" | "bucketKey">;
type BucketUpdate = Pick<MobileRateLimitBucket, "windowStartedAt" | "expiresAt" | "admittedCount"> |
  { admittedCount: { increment: number } };

const epoch = Date.parse("2031-07-11T15:02:00.000Z");
const minute = 60_000;
const fixtureSecret = Buffer.alloc(32, 42).toString("base64url");
const sourceAddress = "192.0.2.42";
const stableSessionId = "fictional-stable-session";
const fake = {
  state: { buckets: new Map(), capacity: 0, challenges: new Map() } as State,
  now: epoch + 12_345,
  trace: [] as string[],
  statements: [] as { step: string; sql: string; values: readonly unknown[] }[],
  onStep: undefined as ((step: string, state: State) => void) | undefined,
  failAt: "",
};

function record(step: string, state: State, statement?: Prisma.Sql) {
  fake.trace.push(step);
  fake.onStep?.(step, state);
  if (statement) fake.statements.push({ step, sql: statement.text.replace(/\s+/g, " ").trim(), values: statement.values });
  if (fake.failAt === step) throw new Error("Fictional database error: do not serialize");
}

function keyOf(policy: string, bytes: Uint8Array): string {
  return `${policy}:${Buffer.from(bytes).toString("hex")}`;
}

function transactionClient(state: State) {
  return {
    async $queryRaw(parts: TemplateStringsArray, ...args: unknown[]) {
      const statement = Prisma.sql(parts, ...args);
      const [key, digest] = statement.values;
      if (statement.text.includes('FROM "MobileRateLimitBucket"')) {
        record("bucket.lock", state, statement);
        assert.match(statement.text, /"policy" = \$1 AND "bucketKey" = \$2 FOR UPDATE/);
        assert.ok(digest instanceof Uint8Array);
        return [state.buckets.get(keyOf(String(key), digest))].filter(Boolean);
      }
      if (statement.text.includes('FROM "MobileRateLimitCapacity"')) {
        record("capacity.lock", state, statement);
        assert.match(statement.text, /"id" = \$1 FOR UPDATE/);
        assert.equal(key, 1);
        return state.capacity === undefined ? [] : [{ bucketCount: state.capacity }];
      }
      if (statement.text.includes('FROM "MobileAuthChallenge"')) {
        record("challenge.read", state, statement);
        assert.match(statement.text, /"id" = \$1 AND "consumedAt" IS NULL AND "expiresAt" > date_trunc\('milliseconds', clock_timestamp\(\)\)/);
        assert.doesNotMatch(statement.text, /FOR (?:UPDATE|SHARE)/);
        const challenge = state.challenges.get(String(key));
        if (!challenge || challenge.consumedAt !== null || challenge.expiresAt.getTime() <= fake.now) return [];
        return [{ windowStartedAt: challenge.windowStartedAt, expiresAt: challenge.expiresAt }];
      }
      record("clock", state, statement);
      assert.equal(statement.text, 'SELECT date_trunc(\'milliseconds\', clock_timestamp()) AS "now"');
      return [{ now: new Date(fake.now) }];
    },
    async $executeRaw(parts: TemplateStringsArray, ...args: unknown[]) {
      const statement = Prisma.sql(parts, ...args);
      if (statement.text.startsWith("SET LOCAL")) {
        record("tx.settings", state, statement);
        assert.ok(["SET LOCAL lock_timeout = '1500ms'", "SET LOCAL statement_timeout = '3000ms'"].includes(statement.text));
        return 0;
      }
      record("bucket.cleanup", state, statement);
      assert.match(statement.text, /"expiresAt" <= \$1/);
      assert.match(statement.text, /ORDER BY "expiresAt", "policy", "bucketKey" LIMIT \$2 FOR UPDATE SKIP LOCKED/);
      assert.match(statement.text, /AND b\."expiresAt" <= \$3/);
      const [cutoff, limit, recheck] = statement.values;
      assert.ok(cutoff instanceof Date && recheck instanceof Date && typeof limit === "number");
      assert.deepEqual(cutoff, recheck);
      const expired = Array.from(state.buckets.entries())
        .filter(([, bucket]) => bucket.expiresAt <= cutoff)
        .sort(([a, first], [b, second]) => first.expiresAt.getTime() - second.expiresAt.getTime() || a.localeCompare(b))
        .slice(0, limit);
      for (const [id] of expired) state.buckets.delete(id);
      return expired.length;
    },
    mobileRateLimitBucket: {
      async create({ data }: { data: MobileRateLimitBucket }) {
        record("bucket.create", state);
        assert.deepEqual(Object.keys(data).sort(), ["admittedCount", "bucketKey", "expiresAt", "policy", "windowStartedAt"]);
        assert.equal(data.bucketKey.byteLength, 32);
        const id = keyOf(data.policy, data.bucketKey);
        assert.equal(state.buckets.has(id), false);
        state.buckets.set(id, data);
        return { policy: data.policy };
      },
      async updateMany({ where, data }: { where: Identity; data: BucketUpdate }) {
        record("bucket.update", state);
        const bucket = state.buckets.get(keyOf(where.policy, where.bucketKey));
        if (!bucket) return { count: 0 };
        if ("expiresAt" in data) Object.assign(bucket, data);
        else bucket.admittedCount += data.admittedCount.increment;
        return { count: 1 };
      },
    },
    mobileRateLimitCapacity: {
      async updateMany({ where, data }: { where: { id: number; bucketCount: number }; data: { bucketCount: number } }) {
        record("capacity.update", state);
        if (where.id !== 1 || state.capacity !== where.bucketCount) return { count: 0 };
        assert.ok(data.bucketCount >= 0 && data.bucketCount <= 10_000);
        state.capacity = data.bucketCount;
        return { count: 1 };
      },
    },
  };
}

// This double records real statement construction and simulates transaction outcomes with a draft.
// PostgreSQL lock and isolation behavior require a separate integration test.
export const db = {
  async $transaction<T>(operation: (tx: ReturnType<typeof transactionClient>) => Promise<T>, options: unknown): Promise<T> {
    assert.deepEqual(options, { isolationLevel: "ReadCommitted", maxWait: 2_000, timeout: 5_000 });
    record("tx.begin", fake.state);
    const draft = structuredClone(fake.state);
    try {
      const result = await operation(transactionClient(draft));
      record("tx.beforeCommit", draft);
      fake.state = draft;
      fake.trace.push("tx.commit");
      record("tx.afterCommit", draft);
      return result;
    } catch (error) {
      if (fake.state !== draft) fake.trace.push("tx.rollback");
      throw error;
    }
  },
};

const loadCommonJs = createRequire(import.meta.url);
export const googleProvider = loadCommonJs("next-auth/providers/google").default;
const overrides = new Map([
  ["server-only", "data:text/javascript,export%20%7B%7D"],
  ["@/lib/db", import.meta.url],
  ["next-auth/providers/google", `data:text/javascript,${encodeURIComponent(
    `export { googleProvider as default } from ${JSON.stringify(import.meta.url)};`,
  )}`],
]);
const resolver = `
let overrides;
export function initialize(data) { overrides = data; }
export function resolve(specifier, context, nextResolve) {
  const url = overrides.get(specifier);
  return url ? { url, shortCircuit: true } : nextResolve(specifier, context);
}
`;
register(`data:text/javascript,${encodeURIComponent(resolver)}`, { data: overrides });

let rateLimit: typeof import("./rate-limit");
let requestSource: typeof import("./request-source");
let rateLimitKeys: typeof import("./rate-limit-keys");
let createMobileChallengeId: typeof import("./credentials").createMobileChallengeId;

before(async () => {
  rateLimit = await import("./rate-limit");
  requestSource = await import("./request-source");
  rateLimitKeys = await import("./rate-limit-keys");
  ({ createMobileChallengeId } = await import("./credentials"));
});

beforeEach(() => {
  fake.state = { buckets: new Map(), capacity: 0, challenges: new Map() };
  fake.now = epoch + 12_345;
  fake.trace.length = 0;
  fake.statements.length = 0;
  fake.onStep = undefined;
  fake.failAt = "";
  process.env.MOBILE_RATE_LIMIT_KEY_SECRET = fixtureSecret;
  process.env.VERCEL = "1";
  process.env.VERCEL_ENV = "preview";
});

function identifiedSource(address = sourceAddress) {
  const result = requestSource.identifyMobileRequestSource(new Headers({ "x-vercel-forwarded-for": address }));
  assert.ok(result.status === "identified");
  return result.source;
}

function sourceInput() {
  return { policy: "challenge_source", source: identifiedSource() } as const;
}

function challengeFixture(expiresAt = epoch + 4 * minute) {
  const challengeId = createMobileChallengeId();
  fake.state.challenges.set(challengeId, {
    windowStartedAt: new Date(epoch - 1), expiresAt: new Date(expiresAt), consumedAt: null,
  });
  return { policy: "exchange_challenge", challengeId } as const;
}

test("only the dedicated secret accepts canonical unpadded encoding for 32 bytes", () => {
  assert.equal(rateLimitKeys.readMobileRateLimitSecret({ MOBILE_RATE_LIMIT_KEY_SECRET: fixtureSecret })?.symmetricKeySize, 32);
  const zeroes = Buffer.alloc(32).toString("base64url");
  for (const secret of [undefined, "", fixtureSecret + "=", fixtureSecret.slice(1), " " + fixtureSecret, zeroes.slice(0, -1) + "B"]) {
    assert.equal(rateLimitKeys.readMobileRateLimitSecret({
      MOBILE_RATE_LIMIT_KEY_SECRET: secret, NEXTAUTH_SECRET: fixtureSecret, GOOGLE_CLIENT_SECRET: fixtureSecret,
    }), null);
  }
});

test("missing limiter configuration leaves web auth importable and fails closed without database work", async () => {
  delete process.env.MOBILE_RATE_LIMIT_KEY_SECRET;
  process.env.NEXTAUTH_SECRET = fixtureSecret;
  process.env.GOOGLE_CLIENT_ID = "fixture-web-client";
  process.env.GOOGLE_CLIENT_SECRET = fixtureSecret;
  const { authOptions } = await import("../options");
  assert.equal(authOptions.session?.strategy, "jwt");
  assert.deepEqual(await rateLimit.admitMobileRateLimit(sourceInput()), { status: "configuration_error" });
  assert.deepEqual(fake.trace, []);
});

test("only the direct Vercel boundary and one valid platform address can identify a source", () => {
  assert.ok(identifiedSource());
  const unavailable = { status: "source_unavailable" };
  assert.deepEqual(requestSource.identifyMobileRequestSource(new Headers({
    "x-forwarded-for": sourceAddress, "x-real-ip": sourceAddress, forwarded: `for=${sourceAddress}`,
  })), unavailable);
  for (const value of ["", "not-an-ip", "192.000.2.42", "192.0.2.42:80", "[2001:db8::1]", "fe80::1%eth0", "192.0.2.42, 192.0.2.11"]) {
    assert.deepEqual(requestSource.identifyMobileRequestSource(new Headers({ "x-vercel-forwarded-for": value })), unavailable);
  }
  const duplicate = new Headers();
  duplicate.append("x-vercel-forwarded-for", sourceAddress);
  duplicate.append("x-vercel-forwarded-for", sourceAddress);
  assert.deepEqual(requestSource.identifyMobileRequestSource(duplicate), unavailable);

  process.env.VERCEL_ENV = "development";
  const spoofed = new Headers({ "x-vercel-forwarded-for": sourceAddress, "x-vercel-env": "preview", vercel: "1" });
  assert.deepEqual(requestSource.identifyMobileRequestSource(spoofed), unavailable);
  process.env.VERCEL_ENV = "preview";
  delete process.env.VERCEL;
  assert.deepEqual(requestSource.identifyMobileRequestSource(spoofed), unavailable);
});

test("IPv6 aliases share a /64 group and IPv4-mapped addresses share their IPv4 bucket", () => {
  const group = (address: string) => requestSource.readTrustedMobileSourceGroup(identifiedSource(address));
  assert.equal(group("2001:0DB8:0000:0001:0000:0000:0000:0007"), group("2001:db8:0:1::7"));
  assert.equal(group("2001:db8:0:1::7"), group("2001:db8:0:1:ffff::99"));
  assert.notEqual(group("2001:db8:0:1::7"), group("2001:db8:0:2::7"));
  assert.equal(group(sourceAddress), group("::ffff:192.0.2.42"));
  assert.equal(group(sourceAddress), group("0:0:0:0:0:ffff:c000:022a"));
  assert.notEqual(group(sourceAddress), group("192.0.2.43"));
});

test("key derivation is deterministic, policy separated, scope separated and keyed", () => {
  const secret = rateLimitKeys.readMobileRateLimitSecret() ?? assert.fail("Missing fixture secret");
  const derive = (policy: string, scope: "source" | "challenge" | "session" | "account") =>
    rateLimitKeys.deriveMobileRateLimitKey(secret, policy, scope, "same-fictional-input");
  const keys = [derive("challenge_source", "source"), derive("challenge_source", "challenge"),
    derive("challenge_source", "session"), derive("challenge_source", "account"), derive("exchange_source", "source")];
  assert.equal(new Set(keys.map((key) => key.toString("hex"))).size, keys.length);
  assert.ok(keys.every((key) => key.byteLength === 32));
  assert.deepEqual(keys[0], derive("challenge_source", "source"));
  const rotated = rateLimitKeys.readMobileRateLimitSecret({
    MOBILE_RATE_LIMIT_KEY_SECRET: Buffer.alloc(32, 99).toString("base64url"),
  }) ?? assert.fail("Missing rotation fixture");
  assert.notDeepEqual(keys[0], rateLimitKeys.deriveMobileRateLimitKey(rotated, "challenge_source", "source", "same-fictional-input"));
});

test("first admission stores only a digest and uses bound parameters and the post-lock database clock", async () => {
  assert.deepEqual(await rateLimit.admitMobileRateLimit(sourceInput()), { status: "allowed" });
  const [bucket] = fake.state.buckets.values();
  assert.equal(bucket.admittedCount, 1);
  assert.deepEqual(bucket.windowStartedAt, new Date(epoch));
  assert.deepEqual(bucket.expiresAt, new Date(epoch + minute));
  assert.equal(fake.state.capacity, 1);
  assert.deepEqual(fake.trace, [
    "tx.begin", "tx.settings", "tx.settings", "bucket.lock", "capacity.lock", "bucket.lock", "clock",
    "bucket.create", "capacity.update", "tx.beforeCommit", "tx.commit", "tx.afterCommit",
  ]);
  const lock = fake.statements.find(({ step }) => step === "bucket.lock");
  assert.deepEqual(lock?.values, ["challenge_source", bucket.bucketKey]);
  assert.equal(lock?.sql.includes(sourceAddress), false);
  assert.equal(JSON.stringify(bucket).includes(sourceAddress), false);

  fake.trace.length = 0;
  assert.deepEqual(await rateLimit.admitMobileRateLimit(sourceInput()), { status: "allowed" });
  assert.equal(fake.trace.includes("capacity.lock"), false);
  assert.equal(fake.state.buckets.values().next().value?.admittedCount, 2);
});

test("source admission rejects a fabricated source object and invalid trusted IDs without a transaction", async () => {
  assert.deepEqual(await rateLimit.admitMobileRateLimit({ policy: "challenge_source", source: {} as TrustedMobileRequestSource }),
    { status: "source_unavailable" });
  assert.deepEqual(await rateLimit.admitMobileRateLimit({ policy: "refresh_session", sessionId: "mr1.fictional-credential" }),
    { status: "scope_unavailable" });
  assert.deepEqual(fake.trace, []);
});

test("all fixed-window policies enforce independent exact limits without incrementing saturated rows", async () => {
  const source = identifiedSource();
  const policies = [
    [{ policy: "challenge_source", source }, 10], [{ policy: "exchange_source", source }, 20],
    [{ policy: "refresh_source", source }, 30], [{ policy: "logout_source", source }, 30],
    [{ policy: "refresh_session", sessionId: stableSessionId }, 10],
    [{ policy: "financial_write_account", userId: "fixture-account-one" }, 60],
  ] as const;
  for (const [input, limit] of policies) {
    for (let i = 0; i < limit; i++) assert.deepEqual(await rateLimit.admitMobileRateLimit(input), { status: "allowed" });
    for (let i = 0; i < 2; i++) {
      assert.deepEqual(await rateLimit.admitMobileRateLimit(input), { status: "rate_limited", retryAfterSeconds: 48 });
    }
    const bucket = Array.from(fake.state.buckets.values()).find(({ policy }) => policy === input.policy);
    assert.equal(bucket?.admittedCount, limit);
  }
  assert.deepEqual(await rateLimit.admitMobileRateLimit({ policy: "refresh_session", sessionId: "second-session" }), { status: "allowed" });
  assert.deepEqual(await rateLimit.admitMobileRateLimit({ policy: "financial_write_account", userId: "fixture-account-two" }), { status: "allowed" });
  assert.equal(JSON.stringify(Array.from(fake.state.buckets.values())).includes(stableSessionId), false);
  assert.equal(fake.state.capacity, 8);
});

test("a saturated bucket reports a positive retry and rolls over at the post-lock minute boundary", async () => {
  const input = sourceInput();
  for (let i = 0; i < 10; i++) await rateLimit.admitMobileRateLimit(input);
  fake.now = epoch + minute - 1;
  assert.deepEqual(await rateLimit.admitMobileRateLimit(input), { status: "rate_limited", retryAfterSeconds: 1 });

  fake.onStep = (step) => { if (step === "bucket.lock") fake.now = epoch + minute; };
  assert.deepEqual(await rateLimit.admitMobileRateLimit(input), { status: "allowed" });
  const [bucket] = fake.state.buckets.values();
  assert.equal(bucket.admittedCount, 1);
  assert.deepEqual(bucket.windowStartedAt, new Date(epoch + minute));
  assert.deepEqual(bucket.expiresAt, new Date(epoch + 2 * minute));
  assert.equal(fake.state.capacity, 1);
});

test("a backward database clock does not reset a saturated live bucket", async () => {
  const input = sourceInput();
  for (let i = 0; i < 10; i++) {
    assert.deepEqual(await rateLimit.admitMobileRateLimit(input), { status: "allowed" });
  }
  fake.now = epoch - 1;

  assert.deepEqual(await rateLimit.admitMobileRateLimit(input), { status: "rate_limited", retryAfterSeconds: 61 });
  const [bucket] = fake.state.buckets.values();
  assert.equal(bucket.admittedCount, 10);
  assert.deepEqual(bucket.windowStartedAt, new Date(epoch));
  assert.deepEqual(bucket.expiresAt, new Date(epoch + minute));
});

test("challenge admission uses its stored lifetime across minutes and excludes unknown, consumed, and expired scopes", async () => {
  const input = challengeFixture();
  for (let i = 0; i < 5; i++) {
    fake.now = epoch + i * 30_000;
    assert.deepEqual(await rateLimit.admitMobileRateLimit(input), { status: "allowed" });
  }
  fake.now = epoch + 3 * minute + 1;
  assert.deepEqual(await rateLimit.admitMobileRateLimit(input), { status: "rate_limited", retryAfterSeconds: 60 });
  const [bucket] = fake.state.buckets.values();
  assert.deepEqual(bucket.expiresAt, new Date(epoch + 4 * minute));
  assert.equal(bucket.admittedCount, 5);

  const consumed = challengeFixture();
  const row = fake.state.challenges.get(consumed.challengeId);
  assert.ok(row);
  row.consumedAt = new Date(fake.now);
  assert.deepEqual(await rateLimit.admitMobileRateLimit(consumed), { status: "scope_unavailable" });
  assert.deepEqual(await rateLimit.admitMobileRateLimit({ policy: "exchange_challenge", challengeId: createMobileChallengeId() }),
    { status: "scope_unavailable" });
  fake.now = epoch + 4 * minute;
  assert.deepEqual(await rateLimit.admitMobileRateLimit(input), { status: "scope_unavailable" });
  assert.equal(fake.state.capacity, 1);
});

test("a challenge that expires during allocation is rejected before creating a bucket", async () => {
  const input = challengeFixture(fake.now + 1);
  fake.onStep = (step) => { if (step === "capacity.lock") fake.now += 1; };
  assert.deepEqual(await rateLimit.admitMobileRateLimit(input), { status: "scope_unavailable" });
  assert.equal(fake.state.capacity, 0);
  assert.equal(fake.state.buckets.size, 0);
});

test("the allocation lock is followed by a fresh bucket read, including at capacity", async () => {
  const input = sourceInput();
  const secret = rateLimitKeys.readMobileRateLimitSecret() ?? assert.fail("Missing fixture secret");
  const key = rateLimitKeys.deriveMobileRateLimitKey(secret, input.policy, "source", `ipv4:${sourceAddress}`);
  fake.state.capacity = 9_999;
  fake.onStep = (step, state) => {
    if (step === "capacity.lock") {
      state.capacity = 10_000;
      state.buckets.set(keyOf(input.policy, key), {
        policy: input.policy, bucketKey: key, admittedCount: 1, windowStartedAt: new Date(epoch),
        expiresAt: new Date(epoch + minute),
      });
    }
  };
  assert.deepEqual(await rateLimit.admitMobileRateLimit(input), { status: "allowed" });
  assert.equal(fake.state.capacity, 10_000);
  assert.equal(fake.state.buckets.values().next().value?.admittedCount, 2);
  assert.equal(fake.trace.includes("bucket.create"), false);
});

test("delayed cleanup preserves the hard cap while existing buckets can roll over in place", async () => {
  fake.state.capacity = 9_999;
  const input = sourceInput();
  assert.deepEqual(await rateLimit.admitMobileRateLimit(input), { status: "allowed" });
  assert.equal(fake.state.capacity, 10_000);
  fake.now = epoch + minute;
  const other = { policy: input.policy, source: identifiedSource("192.0.2.43") } as const;
  assert.deepEqual(await rateLimit.admitMobileRateLimit(other), { status: "capacity_unavailable", retryAfterSeconds: 5 });
  assert.deepEqual(await rateLimit.admitMobileRateLimit(input), { status: "allowed" });
  assert.equal(fake.state.buckets.size, 1);
  assert.equal(fake.state.capacity, 10_000);
  assert.deepEqual(fake.state.buckets.values().next().value?.expiresAt, new Date(epoch + 2 * minute));
});

test("database rollback and ambiguous commit never return admission or retry the operation", async () => {
  const input = sourceInput();
  fake.failAt = "capacity.update";
  assert.deepEqual(await rateLimit.admitMobileRateLimit(input), { status: "database_unavailable" });
  assert.equal(fake.state.buckets.size, 0);
  assert.equal(fake.state.capacity, 0);
  assert.ok(fake.trace.includes("tx.rollback"));

  fake.failAt = "tx.afterCommit";
  assert.deepEqual(await rateLimit.admitMobileRateLimit(input), { status: "database_unavailable" });
  assert.equal(fake.state.capacity, 1);
  assert.equal(fake.state.buckets.values().next().value?.admittedCount, 1);
  assert.equal(fake.trace.filter((step) => step === "tx.begin").length, 2);
});

test("cleanup is bounded, preserves active buckets and returns capacity with the deletion", async () => {
  const input = sourceInput();
  assert.deepEqual(await rateLimit.admitMobileRateLimit(input), { status: "allowed" });
  for (let i = 0; i < 207; i++) {
    const bucketKey = Buffer.alloc(32);
    bucketKey.writeUInt32BE(i);
    fake.state.buckets.set(keyOf(input.policy, bucketKey), {
      policy: input.policy, bucketKey, windowStartedAt: new Date(epoch - minute),
      expiresAt: new Date(epoch), admittedCount: 1,
    });
  }
  assert.equal(fake.state.capacity, 1);
  fake.state.capacity = 208;
  assert.deepEqual(await rateLimit.cleanupExpiredMobileRateLimits(), { status: "cleaned", bucketsDeleted: 200 });
  assert.equal(fake.state.buckets.size, 8);
  assert.equal(fake.state.capacity, 8);
  const deletion = fake.statements.find(({ step }) => step === "bucket.cleanup");
  assert.deepEqual(deletion?.values, [new Date(fake.now), 200, new Date(fake.now)]);
  assert.deepEqual(await rateLimit.cleanupExpiredMobileRateLimits(), { status: "cleaned", bucketsDeleted: 7 });
  assert.equal(fake.state.capacity, 1);
  assert.equal(fake.state.buckets.values().next().value?.expiresAt.getTime(), epoch + minute);
});

test("cleanup failure restores the deleted bucket and preserves counted capacity", async () => {
  assert.deepEqual(await rateLimit.admitMobileRateLimit(sourceInput()), { status: "allowed" });
  fake.now = epoch + minute;
  fake.failAt = "capacity.update";
  assert.deepEqual(await rateLimit.cleanupExpiredMobileRateLimits(), { status: "database_unavailable" });
  assert.equal(fake.state.capacity, 1);
  assert.equal(fake.state.buckets.size, 1);
});
