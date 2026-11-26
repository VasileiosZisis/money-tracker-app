import assert from "node:assert/strict";

import { Prisma, type MobileAuthChallenge, type MobileRateLimitBucket, type MobileRefreshCredential, type MobileSession } from "@/generated/prisma/client";

type MemoryDatabase = {
  users: Set<string>;
  accounts: Map<string, string>;
  challenges: Map<string, MobileAuthChallenge>;
  sessions: Map<string, MobileSession>;
  refresh: Map<string, MobileRefreshCredential>;
  buckets: Map<string, MobileRateLimitBucket>;
  bucketCount: number;
  nextSession: number;
};

export const initialTime = Date.parse("2026-11-26T12:00:00.000Z");
export const fake = {
  state: emptyDatabase(),
  now: initialTime,
  trace: [] as string[],
  sql: [] as { step: string; statement: string; values: readonly unknown[] }[],
  failAt: "",
  zeroAt: "",
  inTransaction: false,
  onStep: undefined as ((step: string, state: MemoryDatabase) => void) | undefined,
};

function emptyDatabase(): MemoryDatabase {
  return {
    users: new Set(),
    accounts: new Map(),
    challenges: new Map(),
    sessions: new Map(),
    refresh: new Map(),
    buckets: new Map(),
    bucketCount: 0,
    nextSession: 1,
  };
}

export function resetLifecycleTestDatabase() {
  Object.assign(fake, {
    state: emptyDatabase(), now: initialTime, trace: [], sql: [], failAt: "", zeroAt: "", inTransaction: false, onStep: undefined,
  });
}

export function digestKey(value: Uint8Array): string {
  return Buffer.from(value).toString("hex");
}

export function rateBucketKey(policy: string, bytes: Uint8Array): string {
  return `${policy}:${digestKey(bytes)}`;
}

function record(step: string, state: MemoryDatabase) {
  fake.trace.push(step);
  fake.onStep?.(step, state);
  if (fake.failAt === step) throw new Error("Fictional raw database error");
}

function recordSql(step: string, state: MemoryDatabase, sql: Prisma.Sql) {
  record(step, state);
  fake.sql.push({ step, statement: sql.text.replace(/\s+/g, " ").trim(), values: sql.values });
}

function cleanupCandidates<T>(
  rows: Iterable<T>,
  expiry: (row: T) => Date,
  id: (row: T) => string,
  limit: number,
) {
  return Array.from(rows, (row) => ({ id: id(row), expiresAt: expiry(row) }))
    .filter(({ expiresAt }) => expiresAt.getTime() <= fake.now)
    .sort((a, b) => a.expiresAt.getTime() - b.expiresAt.getTime() || a.id.localeCompare(b.id))
    .slice(0, limit);
}

function makeClient(state: MemoryDatabase, inTransaction: boolean) {
  return {
    async $queryRaw(strings: TemplateStringsArray, ...args: unknown[]) {
      const sql = Prisma.sql(strings, ...args);
      const query = sql.text.replace(/\s+/g, " ").trim();
      const [first, second] = sql.values;
      if (query.startsWith("SELECT date_trunc(")) {
        assert.ok(inTransaction);
        recordSql("clock", state, sql);
        return [{ now: new Date(fake.now) }];
      }
      if (query.includes("JOIN \"User\"")) {
        assert.ok(inTransaction);
        recordSql("access.read", state, sql);
        assert.match(query, /WITH auth_time AS MATERIALIZED .*clock_timestamp\(\)/);
        assert.match(query, /"accessTokenDigest" = \$1 AND s\."revokedAt" IS NULL/);
        assert.match(query, /s\."accessExpiresAt" > auth_time\."now" AND s\."absoluteExpiresAt" > auth_time\."now"/);
        const session = Array.from(state.sessions.values()).find((row) =>
          digestKey(row.accessTokenDigest) === digestKey(first as Uint8Array) &&
          state.users.has(row.userId) && row.revokedAt === null &&
          row.accessExpiresAt.getTime() > fake.now && row.absoluteExpiresAt.getTime() > fake.now);
        return session ? [{ sessionId: session.id, userId: session.userId }] : [];
      }
      if (query.includes('FROM "MobileRateLimitBucket"')) {
        assert.ok(inTransaction);
        recordSql("rate.bucket.lock", state, sql);
        assert.match(query, /"policy" = \$1 AND "bucketKey" = \$2 FOR UPDATE$/);
        assert.ok(second instanceof Uint8Array);
        const row = state.buckets.get(rateBucketKey(String(first), second));
        return row ? [{ windowStartedAt: row.windowStartedAt, expiresAt: row.expiresAt, admittedCount: row.admittedCount }] : [];
      }
      if (query.includes('FROM "MobileRateLimitCapacity"')) {
        assert.ok(inTransaction);
        recordSql("rate.capacity.lock", state, sql);
        assert.match(query, /"id" = \$1 FOR UPDATE$/);
        assert.equal(first, 1);
        return [{ bucketCount: state.bucketCount }];
      }
      if (query.endsWith("FOR UPDATE SKIP LOCKED")) {
        assert.ok(inTransaction);
        if (query.includes('FROM "MobileAuthChallenge"')) {
          recordSql("cleanup.challenge.lock", state, sql);
          assert.match(query, /"expiresAt" <= \(SELECT date_trunc\(.*clock_timestamp\(\)\)\) ORDER BY "expiresAt", "id" LIMIT \$1/);
          return cleanupCandidates(state.challenges.values(), (row) => row.expiresAt, (row) => row.id, Number(first));
        }
        recordSql("cleanup.session.lock", state, sql);
        assert.match(query, /"absoluteExpiresAt" <= \(SELECT date_trunc\(.*clock_timestamp\(\)\)\) ORDER BY "absoluteExpiresAt", "id" LIMIT \$1/);
        return cleanupCandidates(state.sessions.values(), (row) => row.absoluteExpiresAt, (row) => row.id, Number(first));
      }
      if (query.includes('FROM "MobileAuthChallenge"')) {
        if (query.endsWith("FOR UPDATE")) {
          assert.ok(inTransaction);
          recordSql("challenge.lock", state, sql);
          const row = state.challenges.get(String(first));
          return row ? [{ nonceDigest: row.nonceDigest, expiresAt: row.expiresAt, consumedAt: row.consumedAt }] : [];
        }
        assert.ok(inTransaction);
        if (query.startsWith('SELECT "createdAt" AS "windowStartedAt"')) {
          recordSql("rate.challenge.read", state, sql);
          assert.match(query, /"id" = \$1 AND "consumedAt" IS NULL AND "expiresAt" > date_trunc/);
          const row = state.challenges.get(String(first));
          return row?.consumedAt === null && row.expiresAt.getTime() > fake.now
            ? [{ windowStartedAt: row.createdAt, expiresAt: row.expiresAt }] : [];
        }
        recordSql("challenge.read", state, sql);
        assert.match(query, /^SELECT "nonceDigest" FROM "MobileAuthChallenge" WHERE "id" = \$1/);
        assert.match(query, /"consumedAt" IS NULL AND "expiresAt" > date_trunc\('milliseconds', clock_timestamp\(\)\)/);
        const row = state.challenges.get(String(first));
        return row && row.consumedAt === null && row.expiresAt.getTime() > fake.now ? [{ nonceDigest: row.nonceDigest }] : [];
      }
      assert.ok(inTransaction);
      if (query.includes('FROM "User"')) {
        recordSql("user.lock", state, sql);
        assert.match(query, /"id" = \$1 FOR KEY SHARE$/);
        return state.users.has(String(first)) ? [{ id: first }] : [];
      }
      if (query.includes('FROM "Account"')) {
        recordSql("account.lock", state, sql);
        assert.match(query, /"provider" = 'google' AND "providerAccountId" = \$1 AND "userId" = \$2 FOR SHARE$/);
        return state.accounts.get(String(first)) === second ? [{ userId: second }] : [];
      }
      assert.match(query, /FROM "MobileSession" WHERE "id" = \$1 FOR UPDATE$/);
      recordSql("session.lock", state, sql);
      const row = state.sessions.get(String(first));
      return row ? [{ id: row.id, revokedAt: row.revokedAt, absoluteExpiresAt: row.absoluteExpiresAt }] : [];
    },
    async $executeRaw(strings: TemplateStringsArray, ...args: unknown[]) {
      assert.ok(inTransaction);
      const sql = Prisma.sql(strings, ...args);
      const query = sql.text.replace(/\s+/g, " ").trim();
      if (query.startsWith("SET LOCAL")) {
        assert.ok(["SET LOCAL lock_timeout = '1500ms'", "SET LOCAL statement_timeout = '3000ms'"].includes(query));
        recordSql("tx.settings", state, sql);
        return 0;
      }
      recordSql("cleanup.refresh.delete", state, sql);
      assert.match(query, /WHERE "sessionId" IN \(\$\d+(?:,\$\d+)*\) LIMIT \$\d+ \) DELETE FROM "MobileRefreshCredential" r USING batch/);
      const ids = sql.values.slice(0, -1);
      const limit = Number(sql.values.at(-1));
      const rows = Array.from(state.refresh.entries()).filter(([, row]) => ids.includes(row.sessionId)).slice(0, limit);
      for (const [key] of rows) state.refresh.delete(key);
      return rows.length;
    },
    account: {
      async findUnique(query: {
        where: { provider_providerAccountId: { provider: string; providerAccountId: string } };
        select: { userId: true };
      }) {
        assert.ok(inTransaction);
        record("account.read", state);
        assert.deepEqual(query.select, { userId: true });
        const { provider, providerAccountId } = query.where.provider_providerAccountId;
        assert.equal(provider, "google");
        const userId = state.accounts.get(providerAccountId);
        return userId ? { userId } : null;
      },
    },
    mobileRateLimitBucket: {
      async create({ data }: { data: MobileRateLimitBucket }) {
        assert.ok(inTransaction);
        record("rate.bucket.create", state);
        const key = rateBucketKey(data.policy, data.bucketKey);
        assert.equal(state.buckets.has(key), false);
        state.buckets.set(key, data);
        return { policy: data.policy };
      },
      async updateMany({ where, data }: {
        where: Pick<MobileRateLimitBucket, "policy" | "bucketKey">;
        data: Pick<MobileRateLimitBucket, "admittedCount" | "expiresAt" | "windowStartedAt"> |
          { admittedCount: { increment: number } };
      }) {
        assert.ok(inTransaction);
        record("rate.bucket.update", state);
        const row = state.buckets.get(rateBucketKey(where.policy, where.bucketKey));
        if (!row) return { count: 0 };
        if ("expiresAt" in data) Object.assign(row, data);
        else row.admittedCount += data.admittedCount.increment;
        return { count: 1 };
      },
    },
    mobileRateLimitCapacity: {
      async updateMany({ where, data }: { where: { id: number; bucketCount: number }; data: { bucketCount: number } }) {
        assert.ok(inTransaction);
        record("rate.capacity.update", state);
        if (where.id !== 1 || state.bucketCount !== where.bucketCount) return { count: 0 };
        assert.ok(data.bucketCount >= 0 && data.bucketCount <= 10_000);
        state.bucketCount = data.bucketCount;
        return { count: 1 };
      },
    },
    mobileAuthChallenge: {
      async create({ data }: { data: Omit<MobileAuthChallenge, "consumedAt"> }) {
        record("challenge.create", state);
        assert.equal(state.challenges.has(data.id), false);
        state.challenges.set(data.id, { consumedAt: null, ...data });
        return { id: data.id };
      },
      async updateMany({ where, data }: { where: { id: string; consumedAt: null }; data: { consumedAt: Date } }) {
        record("challenge.consume", state);
        const row = state.challenges.get(where.id);
        if (!row || fake.zeroAt === "challenge.consume" || row.consumedAt !== where.consumedAt) return { count: 0 };
        row.consumedAt = data.consumedAt;
        return { count: 1 };
      },
      async deleteMany({ where }: { where: { id: { in: string[] }; expiresAt: { lte: Date } } }) {
        record("cleanup.challenge.delete", state);
        let count = 0;
        for (const id of where.id.in) {
          const row = state.challenges.get(id);
          if (row && row.expiresAt <= where.expiresAt.lte && state.challenges.delete(id)) count++;
        }
        return { count };
      },
    },
    mobileSession: {
      async create({ data }: { data: Omit<MobileSession, "id" | "revokedAt"> }) {
        record("session.create", state);
        assert.ok(state.users.has(data.userId));
        const id = `session-${state.nextSession++}`;
        state.sessions.set(id, { id, revokedAt: null, ...data });
        return { id };
      },
      async updateMany({ where, data }: {
        where: { id: string; revokedAt: null };
        data: Partial<Pick<MobileSession, "accessTokenDigest" | "accessExpiresAt" | "revokedAt">>;
      }) {
        const step = "revokedAt" in data ? "session.revoke" : "session.rotate";
        record(step, state);
        const row = state.sessions.get(where.id);
        if (!row || fake.zeroAt === step || row.revokedAt !== where.revokedAt) return { count: 0 };
        Object.assign(row, data);
        return { count: 1 };
      },
      async deleteMany({ where }: {
        where: { id: { in: string[] }; absoluteExpiresAt: { lte: Date }; refreshCredentials: { none: object } };
      }) {
        record("cleanup.session.delete", state);
        assert.deepEqual(where.refreshCredentials, { none: {} });
        let count = 0;
        for (const id of where.id.in) {
          const row = state.sessions.get(id);
          if (row && row.absoluteExpiresAt <= where.absoluteExpiresAt.lte &&
            !Array.from(state.refresh.values()).some((history) => history.sessionId === id) &&
            state.sessions.delete(id)) count++;
        }
        return { count };
      },
    },
    mobileRefreshCredential: {
      async findUnique({ where, select }: {
        where: { tokenDigest: Uint8Array; sessionId?: string };
        select: { sessionId?: boolean; expiresAt?: boolean; consumedAt?: boolean };
      }) {
        assert.ok(inTransaction);
        record(where.sessionId === undefined ? "refresh.candidate" : "refresh.reread", state);
        const row = state.refresh.get(digestKey(where.tokenDigest));
        if (where.sessionId === undefined) {
          assert.deepEqual(select, { sessionId: true });
          return row ? { sessionId: row.sessionId } : null;
        }
        assert.deepEqual(select, { expiresAt: true, consumedAt: true });
        return row?.sessionId === where.sessionId ? { expiresAt: row.expiresAt, consumedAt: row.consumedAt } : null;
      },
      async create({ data }: { data: Omit<MobileRefreshCredential, "consumedAt"> }) {
        record("refresh.create", state);
        assert.ok(state.sessions.has(data.sessionId));
        assert.equal(state.refresh.has(digestKey(data.tokenDigest)), false);
        assert.equal(Array.from(state.refresh.values()).some((row) => row.sessionId === data.sessionId && row.consumedAt === null), false);
        state.refresh.set(digestKey(data.tokenDigest), { consumedAt: null, ...data });
        return { sessionId: data.sessionId };
      },
      async updateMany({ where, data }: {
        where: { tokenDigest: Uint8Array; sessionId: string; consumedAt: null };
        data: { consumedAt: Date };
      }) {
        record("refresh.consume", state);
        const row = state.refresh.get(digestKey(where.tokenDigest));
        if (!row || fake.zeroAt === "refresh.consume" || row.sessionId !== where.sessionId ||
          row.consumedAt !== where.consumedAt) return { count: 0 };
        row.consumedAt = data.consumedAt;
        return { count: 1 };
      },
    },
  };
}

// This double records call order and models commit/rollback. It does not emulate PostgreSQL row locking.
export const db = {
  $queryRaw(strings: TemplateStringsArray, ...args: unknown[]) {
    return makeClient(fake.state, false).$queryRaw(strings, ...args);
  },
  async $transaction<T>(transition: (client: ReturnType<typeof makeClient>) => Promise<T>, options: unknown): Promise<T> {
    assert.deepEqual(options, { isolationLevel: "ReadCommitted", maxWait: 2_000, timeout: 5_000 });
    assert.equal(fake.inTransaction, false, "Nested transactions are not allowed");
    record("tx.begin", fake.state);
    const draft = structuredClone(fake.state);
    fake.inTransaction = true;
    try {
      const result = await transition(makeClient(draft, true));
      record("tx.beforeCommit", draft);
      fake.state = draft;
      fake.trace.push("tx.commit");
      record("tx.afterCommit", draft);
      return result;
    } catch (error) {
      if (fake.state !== draft) fake.trace.push("tx.rollback");
      throw error;
    } finally {
      fake.inTransaction = false;
    }
  },
};
