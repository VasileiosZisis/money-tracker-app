import { register } from "node:module";

import type { RunCase } from "./cases";
import { fixtureStages, loadFixtureTarget, type FixtureStage } from "./target";

const writeOut = (message: string) => process.stdout.write(message + "\n");
const writeFailure = (message: string) => process.stderr.write(message + "\n");

function abort(message: string): never {
  writeFailure(message);
  process.exit(1);
}

const runCase: RunCase = async (name, work, timeoutMs = 20_000) => {
  const timeout = setTimeout(() => abort("Fixture case deadline exceeded. Stop and tear down the approved instance. " + name), timeoutMs);
  // Application code must not print driver details during a fixture case.
  const levels = ["log", "error", "warn", "info", "debug"] as const;
  const saved = levels.map((level) => console[level]);
  for (const level of levels) console[level] = () => {};
  try {
    await work();
    writeOut("PASS " + name);
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error &&
      typeof error.code === "string" && /^[0-9][A-Z0-9]{4}$/.test(error.code) ? " (SQLSTATE " + error.code + ")" : "";
    throw new Error("Fixture case failed: " + name + code);
  } finally {
    clearTimeout(timeout);
    levels.forEach((level, index) => { console[level] = saved[index]; });
  }
};

async function main() {
  const [mode, stageValue] = process.argv.slice(2);
  const stage = stageValue as FixtureStage;
  if (process.argv.length !== 4 || !fixtureStages.includes(stage) || !["migrate", "mobile", "web"].includes(mode) ||
    (mode === "mobile" && stage === "web") || (mode === "web" && stage !== "web")) {
    return abort("Expected migrate fresh|upgrade|web, mobile fresh|upgrade, or web web");
  }
  const target = loadFixtureTarget(stage);
  const bridge = new URL("./bridges.ts", import.meta.url).href;
  const overrides = new Map([
    ["server-only", "data:text/javascript,export%20%7B%7D"],
    ["@/lib/auth/mobile/mobile-pool", bridge],
    ["@/lib/db", bridge],
    ["@/lib/auth/session", bridge],
    ["next/cache", bridge],
  ]);
  const resolver = "let overrides;" +
    "export function initialize(data) { overrides = data; }" +
    "export function resolve(s, c, next) { const url = overrides.get(s); return url ? { url, shortCircuit: true } : next(s,c); }";
  register("data:text/javascript," + encodeURIComponent(resolver), { data: overrides });

  const { connectFixture, requireTlsRejections } = await import("./fixture");
  const { migrateFixture, verifyFixtureSchema } = await import("./migrations");
  const owner = await connectFixture(target);
  const lostOwner = () => abort("Fixture stage lock connection ended. Stop and tear down the approved instance.");
  owner.on("error", lostOwner);
  owner.on("end", lostOwner);
  try {
    const lock = await owner.query<{ acquired: boolean }>("SELECT pg_try_advisory_lock(53942) AS acquired");
    if (!lock.rows[0]?.acquired) throw new Error("Fixture stage is already in use");
    await runCase("verified TLS, untrusted CA rejection and hostname mismatch", () => requireTlsRejections(target), 7_000);
    if (mode === "migrate") {
      await runCase("committed migration history and fixture schema", () => migrateFixture(target, stage), 80_000);
    } else {
      await runCase("fixture schema preflight", () => verifyFixtureSchema(owner, stage));
      if (mode === "mobile") {
        const { executorCases } = await import("./executor-cases");
        const { mobileCases } = await import("./mobile-cases");
        await executorCases(target, runCase);
        await mobileCases(target, runCase);
      } else {
        const { webCases } = await import("./web-cases");
        await webCases(target, runCase);
      }
    }
  } finally {
    owner.off("error", lostOwner);
    owner.off("end", lostOwner);
    await owner.end();
  }
  writeOut("Disposable PostgreSQL fixture cases completed.");
}

process.on("unhandledRejection", () => abort("Unclassified fixture rejection. Stop and tear down the approved instance."));
process.on("uncaughtException", () => abort("Unclassified fixture failure. Stop and tear down the approved instance."));
const suiteDeadline = setTimeout(() => abort("Fixture suite deadline exceeded. Stop and tear down the approved instance."), 540_000);
try {
  await main();
} catch (error) {
  const message = error instanceof Error && error.message.startsWith("Fixture case failed: ") ? error.message :
    "Fixture preparation rejected or failed. Check opt-in, identity, TLS, and the documented fixture stage.";
  abort(message);
} finally {
  clearTimeout(suiteDeadline);
}
