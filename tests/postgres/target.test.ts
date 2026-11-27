import assert from "node:assert/strict";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { PeerCertificate } from "node:tls";

import { loadFixtureTarget, parseFixtureManifest, targetRejected, validateFixtureTarget } from "./target";
import { fixtureConnectionOptions } from "./tls";

const manifest = {
  runId: "01".repeat(16), marker: "ab".repeat(32), systemIdentifier: "8123456789012345678", caSha256: "cd".repeat(32),
};
const root = join(tmpdir(), "cashcontour-pg17-" + manifest.runId);
const password = "ae".repeat(32);
const url = new URL("postgresql://cc_pgtest_role_" + manifest.runId + ":" + password +
  "@127.0.0.1:55437/cc_pgtest_" + manifest.runId + "_fresh");
url.searchParams.set("sslmode", "verify-full");
url.searchParams.set("sslrootcert", join(root, "ca.crt"));
const good = { CASHCONTOUR_PG_TEST: "local-disposable", CASHCONTOUR_PG_TEST_URL: url.href };

test("disposable target requires explicit opt-in, manifest and dedicated URL", () => {
  assert.equal(validateFixtureTarget(good, manifest, "fresh", root).port, 55437);
  for (const env of [{}, { ...good, CASHCONTOUR_PG_TEST: "yes" }, { CASHCONTOUR_PG_TEST: "local-disposable" }]) {
    assert.throws(() => validateFixtureTarget(env, manifest, "fresh", root), { message: targetRejected });
  }
  assert.throws(() => loadFixtureTarget("fresh", good), { message: targetRejected });
  assert.throws(() => parseFixtureManifest({ ...manifest, marker: "" }), { message: targetRejected });
  assert.throws(() => parseFixtureManifest({ ...manifest, extra: password }), { message: targetRejected });
});

test("disposable target rejects ambient database, deployment and TLS override selections", () => {
  for (const key of ["DATABASE_URL", "DATABASE_URL_UNPOOLED", "PGHOST", "PGPORT", "PGSSLMODE", "VERCEL", "NEON_PROJECT_ID", "NODE_EXTRA_CA_CERTS"]) {
    assert.throws(() => validateFixtureTarget({ ...good, [key]: password }, manifest, "fresh", root), { message: targetRejected });
  }
  for (const env of [{ ...good, MOBILE_AUTH_API_ENABLED: "true" }, { ...good, NODE_TLS_REJECT_UNAUTHORIZED: "0" }]) {
    assert.throws(() => validateFixtureTarget(env, manifest, "fresh", root), { message: targetRejected });
  }
});

test("disposable target rejects remote hosts, wrong port, role, stage, database and TLS options", () => {
  const substitutions: [string, string][] = [
    ["127.0.0.1", "example.neon.tech"], ["127.0.0.1", "localhost"], ["55437", "5432"],
    ["cc_pgtest_role_" + manifest.runId, "postgres"], ["cc_pgtest_" + manifest.runId + "_fresh", "previewdb"],
    ["cc_pgtest_" + manifest.runId + "_fresh", "neondb"], ["_fresh", "_web"], ["verify-full", "require"],
    ["verify-full", "disable"], ["ca.crt", "other.crt"],
  ];
  const rejected = [
    ...substitutions.map(([from, to]) => url.href.replace(from, to)),
    ...["host=example.invalid", "port=5432", "user=postgres", "password=" + password,
      "database=neondb", "uselibpqcompat=true", "sslmode=verify-full", "ssl=0", "options=fixture"].map((extra) => url.href + "&" + extra),
    url.href + "#", url.href.replace(password, "short"),
  ];
  for (const connectionString of rejected) {
    assert.throws(() => validateFixtureTarget({ ...good, CASHCONTOUR_PG_TEST_URL: connectionString }, manifest, "fresh", root), { message: targetRejected });
  }
});

test("guarded pg options pin supplied CA bytes and check the explicit numeric loopback identity", () => {
  const target = validateFixtureTarget(good, manifest, "fresh", root);
  const ca = Buffer.from("fictional CA bytes");
  const pgConfig = fixtureConnectionOptions({ ...target, ca });
  assert.equal(pgConfig.host, "127.0.0.1");
  assert.equal(pgConfig.ssl.ca, ca);
  assert.equal(pgConfig.ssl.rejectUnauthorized, true);
  const certificate = (subjectaltname: string) => ({ subjectaltname } as PeerCertificate);
  assert.equal(pgConfig.ssl.checkServerIdentity("localhost", certificate("IP Address:127.0.0.1")), undefined);
  const mismatch = pgConfig.ssl.checkServerIdentity("localhost", certificate("DNS:localhost"));
  assert.equal((mismatch as NodeJS.ErrnoException | undefined)?.code, "ERR_TLS_CERT_ALTNAME_INVALID");
});
