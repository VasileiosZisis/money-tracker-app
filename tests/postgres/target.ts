import { createHash } from "node:crypto";
import { readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";

export const fixtureHost = "127.0.0.1";
export const fixturePort = "55437";
export const fixtureStages = ["fresh", "upgrade", "web"] as const;
export type FixtureStage = typeof fixtureStages[number];
export const targetRejected = "Disposable PostgreSQL fixture rejected";

export type FixtureManifest = {
  runId: string;
  marker: string;
  systemIdentifier: string;
  caSha256: string;
};

type FixtureEndpoint = FixtureManifest & {
  connectionString: string;
  host: typeof fixtureHost;
  port: number;
  database: string;
  user: string;
  password: string;
  caPath: string;
};
export type FixtureTarget = FixtureEndpoint & { ca: Buffer };

type Env = Readonly<Record<string, string | undefined>>;

function reject(): never {
  throw new Error(targetRejected);
}

export function requireFixtureOptIn(env: Env): void {
  if (env.CASHCONTOUR_PG_TEST !== "local-disposable" ||
    Object.keys(env).some((key) => /^PG|^DATABASE_URL(?:_|$)/i.test(key)) ||
    env.MOBILE_AUTH_API_ENABLED === "true" ||
    env.NODE_TLS_REJECT_UNAUTHORIZED === "0" || env.NODE_EXTRA_CA_CERTS ||
    env.VERCEL !== undefined || env.NEON_PROJECT_ID !== undefined ||
    env.AUTH_SECRET !== undefined || env.NEXTAUTH_SECRET !== undefined ||
    env.DEBUG || env.NODE_DEBUG || env.PRISMA_LOG_LEVEL) {
    reject();
  }
}

export function parseFixtureManifest(value: unknown): FixtureManifest {
  if (!value || typeof value !== "object" || Array.isArray(value)) reject();
  const { runId, marker, systemIdentifier, caSha256 } = value as Partial<FixtureManifest>;
  if (Object.keys(value).length !== 4 ||
    typeof runId !== "string" || !/^[0-9a-f]{32}$/.test(runId) ||
    typeof marker !== "string" || !/^[0-9a-f]{64}$/.test(marker) ||
    typeof systemIdentifier !== "string" || !/^[1-9][0-9]{8,19}$/.test(systemIdentifier) ||
    typeof caSha256 !== "string" || !/^[a-f0-9]{64}$/.test(caSha256)) {
    reject();
  }
  return { runId, marker, systemIdentifier, caSha256 };
}

export function validateFixtureTarget(env: Env, manifest: unknown, stage: FixtureStage, fixtureRoot: string): FixtureEndpoint {
  requireFixtureOptIn(env);
  const config = parseFixtureManifest(manifest);
  if (!fixtureStages.includes(stage)) reject();
  const user = "cc_pgtest_role_" + config.runId;
  const database = "cc_pgtest_" + config.runId + "_" + stage;
  const caPath = join(fixtureRoot, "ca.crt");
  const connectionString = env.CASHCONTOUR_PG_TEST_URL;
  if (!connectionString || connectionString.trim() !== connectionString || /[\t\r\n]/.test(connectionString)) reject();
  try {
    const url = new URL(connectionString);
    const options = [...url.searchParams.entries()];
    if (url.protocol !== "postgresql:" || url.hostname !== fixtureHost || url.port !== fixturePort ||
      url.username !== user || url.pathname !== "/" + database || !/^[0-9a-f]{64}$/.test(url.password) ||
      url.hash || connectionString.endsWith("#") || options.length !== 2 ||
      url.searchParams.get("sslmode") !== "verify-full" || url.searchParams.get("sslrootcert") !== caPath) {
      reject();
    }
    return { ...config, connectionString, host: fixtureHost, port: Number(fixturePort), database, user, password: url.password, caPath };
  } catch {
    return reject();
  }
}

export function loadFixtureTarget(stage: FixtureStage, env: Env = process.env): FixtureTarget {
  requireFixtureOptIn(env);
  try {
    const manifestPath = env.CASHCONTOUR_PG_TEST_MANIFEST;
    if (!manifestPath || resolve(manifestPath) !== manifestPath) reject();
    const root = dirname(manifestPath);
    if (dirname(root) !== realpathSync(tmpdir()) || basename(manifestPath) !== "manifest.json" ||
      !/^cashcontour-pg17-[0-9a-f]{32}$/.test(basename(root)) ||
      realpathSync(root) !== root || realpathSync(manifestPath) !== manifestPath) reject();
    const manifest = parseFixtureManifest(JSON.parse(readFileSync(manifestPath, "utf8")) as unknown);
    if (basename(root) !== "cashcontour-pg17-" + manifest.runId) reject();
    const target = validateFixtureTarget(env, manifest, stage, root);
    if (realpathSync(target.caPath) !== target.caPath) reject();
    const ca = readFileSync(target.caPath);
    if (createHash("sha256").update(ca).digest("hex") !== target.caSha256) reject();
    return { ...target, ca };
  } catch {
    return reject();
  }
}
