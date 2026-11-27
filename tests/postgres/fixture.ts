import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import { checkServerIdentity } from "node:tls";

import pg from "pg";

import type { FixtureTarget } from "./target";
import { fixtureConnectionOptions } from "./tls";

export type Actor = Pick<pg.Client, "query">;
export type FixtureIdentity = {
  database: string; role: string; marker: string | null; system: string; version: string;
  encrypted: boolean; pid: number;
};
export type Fixture = {
  target: FixtureTarget;
  observer: pg.Client;
  blocker: pg.Client;
  pool: pg.Pool;
  terminate(pid: number): Promise<void>;
  clean(pids: ReadonlySet<number>, timeoutMs?: number, observedPool?: pg.Pool): Promise<void>;
};

export const fixtureIdentitySql = `
    SELECT current_database() AS database, current_user AS role,
      current_setting('cashcontour.fixture_marker', true) AS marker,
      (pg_catalog.pg_control_system()).system_identifier::text AS system,
      current_setting('server_version_num') AS version,
      COALESCE((SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()), false) AS encrypted,
      pg_backend_pid() AS pid
  `;

export function requireFixtureIdentity(rows: FixtureIdentity[], target: FixtureTarget) {
  const row = rows[0];
  if (rows.length !== 1 || !row || row.database !== target.database || row.role !== target.user ||
    row.marker !== target.marker || row.system !== target.systemIdentifier || !row.encrypted ||
    !/^17[0-9]{4}$/.test(row.version) || !Number.isInteger(row.pid) || row.pid <= 0) {
    throw new Error("Disposable PostgreSQL instance identity could not be confirmed");
  }
  return row.pid;
}

export async function verifyFixtureIdentity(client: Actor, target: FixtureTarget) {
  return requireFixtureIdentity((await client.query<FixtureIdentity>(fixtureIdentitySql)).rows, target);
}

export async function connectFixture(target: FixtureTarget) {
  const client = new pg.Client({
    ...fixtureConnectionOptions(target), connectionTimeoutMillis: 1_500, statement_timeout: 8_000,
  });
  client.on("error", () => {});
  try {
    await client.connect();
    await verifyFixtureIdentity(client, target);
    return client;
  } catch (error) {
    await client.end().catch(() => {});
    throw error;
  }
}

export async function requireTlsRejections(target: FixtureTarget) {
  const options = fixtureConnectionOptions(target);
  const variants = [
    {
      ssl: { ...options.ssl, ca: [] },
      codes: ["UNABLE_TO_VERIFY_LEAF_SIGNATURE", "UNABLE_TO_GET_ISSUER_CERT_LOCALLY", "SELF_SIGNED_CERT_IN_CHAIN"],
    },
    {
      ssl: {
        ...options.ssl,
        checkServerIdentity: (_name: string, cert: Parameters<typeof checkServerIdentity>[1]) =>
          checkServerIdentity("cashcontour-fixture-mismatch.invalid", cert),
      },
      codes: ["ERR_TLS_CERT_ALTNAME_INVALID"],
    },
  ];
  for (const { ssl, codes } of variants) {
    const client = new pg.Client({ ...options, ssl, connectionTimeoutMillis: 1_500 });
    client.on("error", () => {});
    try {
      await assert.rejects(client.connect(), (error: unknown) => error instanceof Error &&
        codes.includes((error as NodeJS.ErrnoException).code ?? ""));
    } finally {
      await client.end();
    }
  }
}

export function createFixturePool(target: FixtureTarget, overrides: Pick<pg.PoolConfig, "max" | "connectionTimeoutMillis" | "idleTimeoutMillis"> = {}) {
  const pool = new pg.Pool({
    ...fixtureConnectionOptions(target),
    ...overrides,
    async onConnect(client) { await verifyFixtureIdentity(client, target); },
  });
  pool.on("error", () => {});
  return pool;
}

export async function withFixture<T>(target: FixtureTarget, operation: (fixture: Fixture) => Promise<T>, max = 1): Promise<T> {
  const observer = await connectFixture(target);
  let blocker: pg.Client | undefined;
  const pool = createFixturePool(target, { max, connectionTimeoutMillis: 1_500, idleTimeoutMillis: 10_000 });
  try {
    blocker = await connectFixture(target);
    return await operation({
      target, observer, blocker, pool,
      async terminate(pid) {
        const result = await observer.query<{ ended: boolean }>(`
          SELECT pg_terminate_backend(pid) AS ended FROM pg_stat_activity
          WHERE pid = $1 AND datname = current_database() AND usename = current_user AND pid <> pg_backend_pid()
        `, [pid]);
        assert.equal(result.rows[0]?.ended, true, "Fixture backend did not terminate");
      },
      async clean(pids, timeoutMs = 8_000, observedPool = pool) {
        const deadline = performance.now() + timeoutMs;
        do {
          const { rows } = await observer.query(`
            SELECT a.pid, a.state, a.xact_start, a.wait_event_type,
              (SELECT count(*)::int FROM pg_locks l
               WHERE l.pid = a.pid AND l.locktype IN ('transactionid', 'virtualxid', 'tuple', 'relation')) AS locks
            FROM pg_stat_activity a WHERE a.pid = ANY($1::integer[]) AND a.datname = current_database()
          `, [[...pids]]);
          if (rows.every((row) => row.state === "idle" && row.xact_start === null && row.locks === 0) &&
            observedPool.waitingCount === 0 && observedPool.totalCount === observedPool.idleCount) return;
          await delay(Math.min(50, Math.max(0, deadline - performance.now())));
        } while (performance.now() < deadline);
        throw new Error("Fixture transaction or pool cleanup remains unconfirmed");
      },
    });
  } finally {
    const results = await Promise.allSettled([pool.end(), observer.end(), blocker?.end()]);
    if (results.some(({ status }) => status === "rejected")) throw new Error("Fixture connection cleanup failed");
  }
}
