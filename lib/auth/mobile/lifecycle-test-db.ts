import assert from "node:assert/strict";

import { mobileDatabaseDouble } from "./mobile-database-double";
import type { MobileParameter, MobileTransaction } from "./mobile-transaction";

type Challenge = { id: string; nonceDigest: Uint8Array; createdAt: Date; expiresAt: Date; consumedAt: Date | null };
type Session = {
  id: string; userId: string; createdAt: Date; accessTokenDigest: Uint8Array;
  accessExpiresAt: Date; absoluteExpiresAt: Date; revokedAt: Date | null;
};
type Refresh = { tokenDigest: Uint8Array; sessionId: string; issuedAt: Date; expiresAt: Date; consumedAt: Date | null };
type Bucket = { policy: string; bucketKey: Uint8Array; windowStartedAt: Date; expiresAt: Date; admittedCount: number };

type MemoryDatabase = {
  users: Set<string>;
  accounts: Map<string, string>;
  challenges: Map<string, Challenge>;
  sessions: Map<string, Session>;
  refresh: Map<string, Refresh>;
  buckets: Map<string, Bucket>;
  bucketCount: number;
};

export const initialTime = Date.parse("2026-11-26T12:00:00.000Z");
export const fake = {
  state: emptyDatabase(),
  now: initialTime,
  trace: [] as string[],
  sql: [] as { step: string; statement: string; values: readonly MobileParameter[] }[],
  failAt: "",
  zeroAt: "",
  inTransaction: false,
  poolCalls: 0,
  onStep: undefined as ((step: string, state: MemoryDatabase) => void) | undefined,
};

function emptyDatabase(): MemoryDatabase {
  return {
    users: new Set(), accounts: new Map(), challenges: new Map(), sessions: new Map(), refresh: new Map(),
    buckets: new Map(), bucketCount: 0,
  };
}

export function resetLifecycleTestDatabase() {
  Object.assign(fake, {
    state: emptyDatabase(), now: initialTime, trace: [], sql: [], failAt: "", zeroAt: "", inTransaction: false,
    poolCalls: 0, onStep: undefined,
  });
}

export function digestKey(value: Uint8Array): string {
  return Buffer.from(value).toString("hex");
}

export function rateBucketKey(policy: string, bytes: Uint8Array): string {
  return policy + ":" + digestKey(bytes);
}

function record(step: string, state: MemoryDatabase) {
  fake.trace.push(step);
  fake.onStep?.(step, state);
  if (fake.failAt === step) throw new Error("Fictional raw database error");
}

function cleanupCandidates<T>(
  rows: Iterable<T>, expiry: (row: T) => Date, id: (row: T) => string, limit: number,
) {
  return Array.from(rows, (row) => ({ id: id(row), expiresAt: expiry(row) }))
    .filter(({ expiresAt }) => expiresAt.getTime() <= fake.now)
    .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime() || a.id.localeCompare(b.id))
    .slice(0, limit);
}

function binary(value: MobileParameter): Uint8Array {
  assert.ok(value instanceof Uint8Array && value.byteLength === 32);
  return value;
}

function date(value: MobileParameter): Date {
  assert.ok(value instanceof Date);
  return value;
}

function ids(value: MobileParameter): readonly string[] {
  assert.ok(Array.isArray(value) && value.every((id) => typeof id === "string"));
  return value;
}

const execute = mobileDatabaseDouble<MemoryDatabase>({
  current: () => fake.state,
  commit: (state) => { fake.state = state; },
  record,
  onConnection(active) {
    if (active) assert.equal(fake.inTransaction, false, "Nested transactions are not allowed");
    fake.inTransaction = active;
  },
  query(state, name, sql, values) {
    assert.equal(fake.inTransaction, true);
    const [first, second, third, fourth, fifth, sixth] = values;
    function step(label: string) {
      record(label, state);
      fake.sql.push({ step: label, statement: sql, values });
      return fake.zeroAt === label;
    }

    switch (name) {
      case "clock":
        step("clock");
        assert.equal(sql, "SELECT date_trunc('milliseconds', clock_timestamp()) AS \"now\"");
        return [{ now: new Date(fake.now) }];
      case "readAccess": {
        step("access.read");
        assert.match(sql, /WITH auth_time AS MATERIALIZED .*clock_timestamp\(\)/);
        assert.match(sql, /"accessTokenDigest" = \$1 AND s\."revokedAt" IS NULL/);
        assert.match(sql, /s\."accessExpiresAt" > auth_time\."now" AND s\."absoluteExpiresAt" > auth_time\."now"/);
        const digest = digestKey(binary(first));
        const session = Array.from(state.sessions.values()).find((row) =>
          digestKey(row.accessTokenDigest) === digest && state.users.has(row.userId) && row.revokedAt === null &&
          row.accessExpiresAt.getTime() > fake.now && row.absoluteExpiresAt.getTime() > fake.now);
        return session ? [{ sessionId: session.id, userId: session.userId }] : [];
      }
      case "lockBucket": {
        step("rate.bucket.lock");
        assert.match(sql, /"policy" = \$1 AND "bucketKey" = \$2 FOR UPDATE$/);
        const row = state.buckets.get(rateBucketKey(String(first), binary(second)));
        return row ? [{ windowStartedAt: row.windowStartedAt, expiresAt: row.expiresAt, admittedCount: row.admittedCount }] : [];
      }
      case "lockCapacity":
        step("rate.capacity.lock");
        assert.match(sql, /"id" = \$1 FOR UPDATE$/);
        assert.equal(first, 1);
        return [{ bucketCount: state.bucketCount }];
      case "lockExpiredChallenges":
        step("cleanup.challenge.lock");
        assert.match(sql, /"expiresAt" <= \(SELECT date_trunc\(.*clock_timestamp\(\)\)\) ORDER BY "expiresAt", "id" LIMIT \$1 FOR UPDATE SKIP LOCKED$/);
        return cleanupCandidates(state.challenges.values(), (row) => row.expiresAt, (row) => row.id, Number(first));
      case "lockExpiredSessions":
        step("cleanup.session.lock");
        assert.match(sql, /"absoluteExpiresAt" <= \(SELECT date_trunc\(.*clock_timestamp\(\)\)\) ORDER BY "absoluteExpiresAt", "id" LIMIT \$1 FOR UPDATE SKIP LOCKED$/);
        return cleanupCandidates(state.sessions.values(), (row) => row.absoluteExpiresAt, (row) => row.id, Number(first));
      case "lockChallenge": {
        step("challenge.lock");
        assert.match(sql, /^SELECT "nonceDigest", "expiresAt", "consumedAt".* WHERE "id" = \$1 FOR UPDATE$/);
        const row = state.challenges.get(String(first));
        return row ? [{ nonceDigest: row.nonceDigest, expiresAt: row.expiresAt, consumedAt: row.consumedAt }] : [];
      }
      case "readChallengeWindow": {
        step("rate.challenge.read");
        assert.match(sql, /"id" = \$1 AND "consumedAt" IS NULL AND "expiresAt" > date_trunc/);
        const row = state.challenges.get(String(first));
        return row?.consumedAt === null && row.expiresAt.getTime() > fake.now
          ? [{ windowStartedAt: row.createdAt, expiresAt: row.expiresAt }] : [];
      }
      case "readChallenge": {
        step("challenge.read");
        assert.match(sql, /^SELECT "nonceDigest" FROM "MobileAuthChallenge" WHERE "id" = \$1/);
        assert.match(sql, /"consumedAt" IS NULL AND "expiresAt" > date_trunc\('milliseconds', clock_timestamp\(\)\)/);
        const row = state.challenges.get(String(first));
        return row && row.consumedAt === null && row.expiresAt.getTime() > fake.now ? [{ nonceDigest: row.nonceDigest }] : [];
      }
      case "lockUser":
        step("user.lock");
        assert.match(sql, /"id" = \$1 FOR KEY SHARE$/);
        return state.users.has(String(first)) ? [{ id: first }] : [];
      case "readGoogleAccount": {
        step("account.read");
        assert.equal(sql, 'SELECT "userId" FROM "Account" WHERE "provider" = $1 AND "providerAccountId" = $2');
        assert.equal(first, "google");
        const userId = state.accounts.get(String(second));
        return userId ? [{ userId }] : [];
      }
      case "lockGoogleAccount":
        step("account.lock");
        assert.match(sql, /"provider" = 'google' AND "providerAccountId" = \$1 AND "userId" = \$2 FOR SHARE$/);
        return state.accounts.get(String(first)) === second ? [{ userId: second }] : [];
      case "lockSession": {
        step("session.lock");
        assert.match(sql, /FROM "MobileSession" WHERE "id" = \$1 FOR UPDATE$/);
        const row = state.sessions.get(String(first));
        return row ? [{ id: row.id, revokedAt: row.revokedAt, absoluteExpiresAt: row.absoluteExpiresAt }] : [];
      }
      case "insertBucket": {
        const zero = step("rate.bucket.create");
        const key = rateBucketKey(String(first), binary(second));
        assert.equal(state.buckets.has(key), false);
        if (zero) return 0;
        state.buckets.set(key, { policy: String(first), bucketKey: binary(second), windowStartedAt: date(third), expiresAt: date(fourth), admittedCount: 1 });
        return 1;
      }
      case "incrementBucket":
      case "resetBucket": {
        const zero = step("rate.bucket.update");
        const row = state.buckets.get(rateBucketKey(String(first), binary(second)));
        if (zero || !row) return 0;
        if (name === "resetBucket") Object.assign(row, { windowStartedAt: date(third), expiresAt: date(fourth), admittedCount: 1 });
        else row.admittedCount++;
        return 1;
      }
      case "updateCapacity":
        if (step("rate.capacity.update") || first !== 1 || state.bucketCount !== second) return 0;
        assert.ok(typeof third === "number" && third >= 0 && third <= 10_000);
        state.bucketCount = third;
        return 1;
      case "insertChallenge":
        if (step("challenge.create")) return 0;
        assert.match(sql, /\("id", "nonceDigest", "createdAt", "expiresAt"\) VALUES \(\$1, \$2, \$3, \$4\)$/);
        assert.equal(state.challenges.has(String(first)), false);
        state.challenges.set(String(first), { id: String(first), consumedAt: null, nonceDigest: binary(second), createdAt: date(third), expiresAt: date(fourth) });
        return 1;
      case "consumeChallenge": {
        const zero = step("challenge.consume");
        const row = state.challenges.get(String(first));
        assert.match(sql, /"id" = \$1 AND "consumedAt" IS NULL$/);
        if (zero || !row || row.consumedAt !== null) return 0;
        row.consumedAt = date(second);
        return 1;
      }
      case "deleteExpiredChallenges": {
        step("cleanup.challenge.delete");
        assert.match(sql, /"id" = ANY\(\$1::text\[\]\) AND "expiresAt" <= \$2$/);
        const eligible = ids(first).filter((id) => {
          const row = state.challenges.get(id);
          return row && row.expiresAt <= date(second);
        });
        for (const id of eligible) state.challenges.delete(id);
        return eligible.length;
      }
      case "insertSession":
        if (step("session.create")) return 0;
        assert.match(sql, /\("id", "userId", "createdAt", "absoluteExpiresAt", "accessTokenDigest", "accessExpiresAt"\) VALUES \(\$1, \$2, \$3, \$4, \$5, \$6\)$/);
        assert.ok(state.users.has(String(second)) && !state.sessions.has(String(first)));
        state.sessions.set(String(first), {
          id: String(first), userId: String(second), createdAt: date(third), absoluteExpiresAt: date(fourth),
          accessTokenDigest: binary(fifth), accessExpiresAt: date(sixth), revokedAt: null,
        });
        return 1;
      case "revokeSession":
      case "rotateAccess": {
        const zero = step(name === "revokeSession" ? "session.revoke" : "session.rotate");
        const row = state.sessions.get(String(first));
        assert.match(sql, /WHERE "id" = \$1 AND "revokedAt" IS NULL$/);
        if (zero || !row || row.revokedAt !== null) return 0;
        if (name === "revokeSession") row.revokedAt = date(second);
        else Object.assign(row, { accessTokenDigest: binary(second), accessExpiresAt: date(third) });
        return 1;
      }
      case "deleteExpiredSessions": {
        step("cleanup.session.delete");
        assert.match(sql, /s\."id" = ANY\(\$1::text\[\]\) AND s\."absoluteExpiresAt" <= \$2 AND NOT EXISTS \(SELECT 1.*r\."sessionId" = s\."id"\)$/);
        const eligible = ids(first).filter((id) => {
          const row = state.sessions.get(id);
          return row && row.absoluteExpiresAt <= date(second) &&
            !Array.from(state.refresh.values()).some((history) => history.sessionId === id);
        });
        for (const id of eligible) state.sessions.delete(id);
        return eligible.length;
      }
      case "readRefreshSessionId":
      case "rereadRefresh": {
        step(name === "readRefreshSessionId" ? "refresh.candidate" : "refresh.reread");
        const row = state.refresh.get(digestKey(binary(first)));
        if (name === "readRefreshSessionId") {
          assert.match(sql, /^SELECT "sessionId".* WHERE "tokenDigest" = \$1$/);
          return row ? [{ sessionId: row.sessionId }] : [];
        }
        assert.match(sql, /^SELECT "expiresAt", "consumedAt".* WHERE "tokenDigest" = \$1 AND "sessionId" = \$2$/);
        return row && row.sessionId === second ? [{ expiresAt: row.expiresAt, consumedAt: row.consumedAt }] : [];
      }
      case "insertRefresh": {
        const zero = step("refresh.create");
        assert.ok(state.sessions.has(String(first)));
        const key = digestKey(binary(second));
        assert.equal(state.refresh.has(key), false);
        assert.equal(Array.from(state.refresh.values()).some((row) => row.sessionId === first && row.consumedAt === null), false);
        if (zero) return 0;
        state.refresh.set(key, { sessionId: String(first), tokenDigest: binary(second), issuedAt: date(third), expiresAt: date(fourth), consumedAt: null });
        return 1;
      }
      case "consumeRefresh": {
        const zero = step("refresh.consume");
        const row = state.refresh.get(digestKey(binary(first)));
        assert.match(sql, /"tokenDigest" = \$1 AND "sessionId" = \$2 AND "consumedAt" IS NULL$/);
        if (zero || !row || row.sessionId !== second || row.consumedAt !== null) return 0;
        row.consumedAt = date(third);
        return 1;
      }
      case "deleteRefreshHistory": {
        step("cleanup.refresh.delete");
        assert.match(sql, /WHERE "sessionId" = ANY\(\$1::text\[\]\) LIMIT \$2 \) DELETE FROM "MobileRefreshCredential" r USING batch/);
        const eligible = Array.from(state.refresh.entries())
          .filter(([, row]) => ids(first).includes(row.sessionId)).slice(0, Number(second));
        for (const [key] of eligible) state.refresh.delete(key);
        return eligible.length;
      }
      case "deleteExpiredBuckets": {
        step("rate.bucket.cleanup");
        const cutoff = date(first);
        assert.deepEqual(third, first);
        const eligible = Array.from(state.buckets.entries()).filter(([, row]) => row.expiresAt <= cutoff)
          .sort(([a, x], [b, y]) => x.expiresAt.getTime() - y.expiresAt.getTime() || a.localeCompare(b)).slice(0, Number(second));
        for (const [key] of eligible) state.buckets.delete(key);
        return eligible.length;
      }
    }
  },
});

export function executeMobileDatabaseTransaction<T>(transition: (tx: MobileTransaction) => Promise<T>) {
  fake.poolCalls++;
  return execute(transition);
}
