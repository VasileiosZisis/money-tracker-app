import "server-only";

import pg from "pg";

import { createMobileTransactionExecutor } from "./mobile-transaction";

export function readMobileDatabaseUrl(value: string | undefined): string {
  if (value && value === value.trim()) {
    try {
      const url = new URL(value);
      const hasOverrides = ["host", "port", "user", "database", "query_timeout"]
        .some((name) => url.searchParams.has(name));
      const sslModes = url.searchParams.getAll("sslmode");
      const useLibpq = url.searchParams.getAll("uselibpqcompat").includes("true");
      // The pinned driver verifies names and certificates for these modes.
      // Its opt-in libpq mode has different semantics except for verify-full.
      const allowedModes = useLibpq ? ["verify-full"] : ["require", "verify-full", "verify-ca", "prefer"];
      const verifiedTls = sslModes.every((mode) => allowedModes.includes(mode)) &&
        url.searchParams.getAll("ssl").every((ssl) => ssl === "true" || ssl === "1");
      if (["postgres:", "postgresql:"].includes(url.protocol) && url.hostname &&
        decodeURIComponent(url.username).trim() && decodeURIComponent(url.pathname.slice(1)).trim() &&
        !url.hash && !hasOverrides && verifiedTls && (url.port === "" || Number(url.port) > 0)) {
        return value;
      }
    } catch {
      // Keep even URL parsing exceptions out of returned errors and diagnostics.
    }
  }
  throw new Error("Invalid mobile database configuration");
}

const runtime = globalThis as typeof globalThis & { cashContourMobilePool?: pg.Pool };

function getPool() {
  if (runtime.cashContourMobilePool) return runtime.cashContourMobilePool;
  const pool = new pg.Pool({
    connectionString: readMobileDatabaseUrl(process.env.DATABASE_URL),
    ssl: { rejectUnauthorized: true },
    max: 2,
    connectionTimeoutMillis: 1_500,
    idleTimeoutMillis: 10_000,
  });
  pool.on("error", () => {
    // pg evicts failed idle clients. Avoid logging driver errors or connection details.
  });
  runtime.cashContourMobilePool = pool;
  return pool;
}

const owners = globalThis as typeof globalThis & {
  cashContourMobileTransactionExecutor?: ReturnType<typeof createMobileTransactionExecutor>;
};

export const executeMobileDatabaseTransaction = owners.cashContourMobileTransactionExecutor ??=
  createMobileTransactionExecutor(getPool);
