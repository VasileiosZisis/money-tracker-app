import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const configUrl = new URL("./prisma.config.ts", import.meta.url).href;
const loaderPath = pathToFileURL(require.resolve("tsx/esm")).href;
const readConfig = `const { default: config } = await import(${JSON.stringify(configUrl)}); process.stdout.write(config.datasource.url);`;

function readDatasource(files: Record<string, string>, exported: Record<string, string> = {}) {
  const cwd = mkdtempSync(path.join(tmpdir(), "money-tracker-prisma-config-"));
  const env = { ...process.env };
  delete env.APP_ENV;
  delete env.DATABASE_URL;
  delete env.DATABASE_URL_UNPOOLED;
  Object.assign(env, exported);

  try {
    for (const [name, content] of Object.entries(files)) {
      writeFileSync(path.join(cwd, name), content);
    }

    return execFileSync(
      process.execPath,
      ["--import", loaderPath, "--input-type=module", "--eval", readConfig],
      { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}

test("exported migration URL wins over both dotenv files", () => {
  assert.equal(readDatasource({
    ".env": "DATABASE_URL_UNPOOLED=default-direct\n",
    ".env.local": "DATABASE_URL_UNPOOLED=local-direct\n",
  }, { DATABASE_URL_UNPOOLED: "exported-direct" }), "exported-direct");
});

test("local direct URL wins over default direct URL", () => {
  assert.equal(readDatasource({
    ".env": "DATABASE_URL_UNPOOLED=default-direct\n",
    ".env.local": "DATABASE_URL=local-pooled\nDATABASE_URL_UNPOOLED=local-direct\n",
  }), "local-direct");
});

test("exported runtime URL wins when no direct URL is configured", () => {
  assert.equal(readDatasource({
    ".env": "DATABASE_URL=default-pooled\n",
    ".env.local": "DATABASE_URL=local-pooled\n",
  }, { DATABASE_URL: "exported-pooled" }), "exported-pooled");
});

test("runtime URL falls back to local and then default dotenv values", () => {
  assert.equal(readDatasource({
    ".env": "DATABASE_URL=default-pooled\n",
    ".env.local": "DATABASE_URL=local-pooled\nDATABASE_URL_UNPOOLED=\n",
  }), "local-pooled");
  assert.equal(readDatasource({ ".env": "DATABASE_URL=default-pooled\n" }), "default-pooled");
});

test("test dotenv target overrides exported and non-test database targets", () => {
  assert.equal(readDatasource({
    ".env": "DATABASE_URL=default-production\n",
    ".env.local": "DATABASE_URL=local-production\nDATABASE_URL_UNPOOLED=local-direct\n",
    ".env.test.local": "DATABASE_URL=test-database\nDATABASE_URL_UNPOOLED=unsafe-direct\n",
  }, {
    APP_ENV: "test",
    DATABASE_URL: "exported-production",
    DATABASE_URL_UNPOOLED: "exported-direct",
  }), "test-database");
});

test("test mode accepts an explicit exported target but ignores direct URLs", () => {
  assert.equal(readDatasource({
    ".env.local": "DATABASE_URL=local-production\n",
  }, {
    APP_ENV: "test",
    DATABASE_URL: "explicit-test",
    DATABASE_URL_UNPOOLED: "production-direct",
  }), "explicit-test");
});

test("test mode fails closed without an explicit test database", () => {
  const testFiles: Record<string, string>[] = [{}, { ".env.test.local": "DATABASE_URL=\n" }];
  for (const testFile of testFiles) {
    assert.throws(() => readDatasource({
      ".env.local": "DATABASE_URL=local-production\n",
      ...testFile,
    }, { APP_ENV: "test" }), /APP_ENV=test requires DATABASE_URL/);
  }
});

test("blank test-file URL falls back to an explicitly exported test URL", () => {
  assert.equal(readDatasource({
    ".env.local": "DATABASE_URL=local-production\n",
    ".env.test.local": "DATABASE_URL=\n",
  }, { APP_ENV: "test", DATABASE_URL: "explicit-test" }), "explicit-test");
});

test("configuration rejects a missing non-test database target", () => {
  assert.throws(() => readDatasource({}), /DATABASE_URL/);
});
