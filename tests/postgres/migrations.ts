import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

import { connectFixture, type Actor } from "./fixture";
import type { FixtureStage, FixtureTarget } from "./target";

const migrationRoot = new URL("../../prisma/migrations/", import.meta.url);
const mobileMigrations = ["20261126120000_add_mobile_session_foundation", "20261126130000_add_mobile_rate_limits"];
const finalWebMigration = "20260817120000_add_user_time_zone";
const webTables = [
  "User", "Account", "Session", "VerificationToken", "Category", "Tag", "Transaction", "BalanceAdjustment",
  "PlannedBill", "PlannedBillOccurrence", "PlannedIncome", "PlannedIncomeOccurrence",
];
const mobileTables = [
  "MobileAuthChallenge", "MobileSession", "MobileRefreshCredential", "MobileRateLimitBucket", "MobileRateLimitCapacity",
];

function readMigrationFiles(stage: FixtureStage) {
  const dirs = readdirSync(migrationRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    .map((entry) => entry.name).sort();
  const split = dirs.indexOf(finalWebMigration) + 1;
  assert.ok(split > 0);
  assert.deepEqual(dirs.slice(split), mobileMigrations);
  assert.ok(dirs.every((name) => /^[0-9]{14}_[a-z0-9_]+$/.test(name)));
  const read = (name: string) => readFileSync(new URL(name + "/migration.sql", migrationRoot), "utf8");
  return { web: dirs.slice(0, split).map(read), mobile: stage === "web" ? [] : dirs.slice(split).map(read) };
}

async function existingWebRecords(client: Actor) {
  return (await client.query(`
    SELECT u."id", u."currency", u."timeZone", a."providerAccountId", t."id" AS "transactionId", t."categoryId",
      t."tagId", t."type"::text, t."amount"::text, t."localDate", sc."name" AS "tagName"
    FROM "User" u JOIN "Account" a ON a."userId" = u."id"
    JOIN "Transaction" t ON t."userId" = u."id" JOIN "Tag" sc ON sc."id" = t."tagId"
    JOIN "Category" c ON c."id" = t."categoryId" AND c."id" = sc."categoryId" AND c."userId" = u."id"
    WHERE u."id" = 'cc-web-existing'
  `)).rows;
}

async function seedExistingWebRecords(client: Actor) {
  await client.query(`
    INSERT INTO "User" ("id", "currency", "timeZone", "updatedAt")
    VALUES ('cc-web-existing', 'USD', 'UTC', now())
  `);
  await client.query(`
    INSERT INTO "Account" ("id", "userId", "type", "provider", "providerAccountId")
    VALUES ('cc-web-account', 'cc-web-existing', 'oauth', 'google', 'cc-existing-subject')
  `);
  await client.query(`
    INSERT INTO "Category" ("id", "userId", "type", "name", "updatedAt")
    VALUES ('cc-web-category', 'cc-web-existing', 'EXPENSE', 'Fixture category', now())
  `);
  await client.query(`
    INSERT INTO "Tag" ("id", "categoryId", "name", "updatedAt") VALUES
    ('cc-web-tag', 'cc-web-category', 'Fixture tag', now())
  `);
  await client.query(`
    INSERT INTO "Transaction" ("id", "userId", "categoryId", "tagId", "type", "amount", "localDate", "updatedAt")
    VALUES ('cc-web-transaction', 'cc-web-existing', 'cc-web-category', 'cc-web-tag',
            'EXPENSE', 999999999999.99, '2035-08-31', now())
  `);
}

export async function verifyFixtureSchema(client: Actor, stage: FixtureStage) {
  const tables = await client.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
  const expected = stage === "web" ? webTables : [...webTables, ...mobileTables];
  assert.deepEqual(tables.rows.map((row) => row.tablename).sort(), [...expected].sort());
  const { rows: indexes } = await client.query<{ indexname: string; indexdef: string }>(
    "SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = ANY($1::text[])", [expected],
  );
  const { rows: constraints } = await client.query<{ conname: string; definition: string }>(`
    SELECT c.conname, pg_get_constraintdef(c.oid) AS definition
    FROM pg_constraint c JOIN pg_class r ON r.oid = c.conrelid JOIN pg_namespace n ON n.oid = r.relnamespace
    WHERE n.nspname = 'public' AND r.relname = ANY($1::text[])
  `, [expected]);
  const normalize = (text: string) => text.replaceAll('"', "").replace(/\s+/g, " ").trim();
  const files = readMigrationFiles(stage);
  const ddl = [...files.web, ...files.mobile].join("\n");
  // The current committed history adds indexes and constraints without dropping or renaming them.
  assert.doesNotMatch(ddl, /\bDROP\s+(?:INDEX|CONSTRAINT)|ALTER\s+INDEX/i);
  for (const [, unique, name, table, columns] of ddl.matchAll(/CREATE\s+(UNIQUE\s+)?INDEX\s+"([^"]+)"\s+ON\s+"([^"]+)"\s*\(([^)]+)\)/gi)) {
    const definition = normalize(indexes.find((row) => row.indexname === name)?.indexdef ?? "");
    assert.equal(definition.startsWith("CREATE UNIQUE INDEX"), Boolean(unique));
    assert.ok(definition.includes(`ON public.${table} USING btree (${normalize(columns)})`));
  }
  for (const [, name, definition] of ddl.matchAll(/ADD CONSTRAINT "([^"]+)" (FOREIGN KEY [^;]+);/g)) {
    const actual = normalize(constraints.find((row) => row.conname === name)?.definition ?? "");
    const body = normalize(definition);
    assert.ok(actual.startsWith(body.split(" ON DELETE ")[0]));
    assert.match(actual, /ON UPDATE CASCADE/);
    assert.ok(actual.includes(/ON DELETE (?:CASCADE|RESTRICT|SET NULL)/.exec(body)?.[0] ?? "missing"));
  }
  for (const name of expected.filter((name) => name !== "VerificationToken")) {
    assert.ok(constraints.some((row) => row.conname === name + "_pkey" && row.definition.startsWith("PRIMARY KEY")));
  }
  const monetaryColumns = await client.query<{ table_name: string; numeric_precision: number; numeric_scale: number }>(`
    SELECT table_name, numeric_precision, numeric_scale FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'amount'
    AND table_name IN ('Transaction','PlannedBill','PlannedIncome','BalanceAdjustment')
  `);
  assert.equal(monetaryColumns.rowCount, 4);
  assert.ok(monetaryColumns.rows.every((row) => row.numeric_precision === 14 && row.numeric_scale === 2));
  if (stage === "web") return;
  assert.match(indexes.find((row) => row.indexname === "MobileRefreshCredential_current_session_key")?.indexdef ?? "",
    /UNIQUE.*WHERE.*"consumedAt" IS NULL/i);
  for (const name of [
    "MobileAuthChallenge_nonce_digest_length", "MobileAuthChallenge_timestamps", "MobileSession_access_digest_length",
    "MobileSession_timestamps", "MobileRefreshCredential_digest_length", "MobileRefreshCredential_timestamps",
    "MobileRateLimitBucket_policy_count", "MobileRateLimitBucket_window", "MobileRateLimitBucket_key_length",
    "MobileRateLimitCapacity_singleton", "MobileRateLimitCapacity_count",
  ]) assert.ok(constraints.some((row) => row.conname === name && row.definition.startsWith("CHECK")));
  for (const name of ["MobileSession_userId_fkey", "MobileRefreshCredential_sessionId_fkey"]) {
    assert.match(constraints.find((row) => row.conname === name)?.definition ?? "", /ON DELETE CASCADE/);
  }
  assert.deepEqual((await client.query('SELECT "id", "bucketCount" FROM "MobileRateLimitCapacity"')).rows,
    [{ id: 1, bucketCount: 0 }]);
}

export async function migrateFixture(target: FixtureTarget, stage: FixtureStage) {
  const files = readMigrationFiles(stage);
  const client = await connectFixture(target);
  try {
    await client.query("SET search_path TO public");
    assert.equal((await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'")).rowCount, 0);
    async function apply(statements: string[]) {
      for (const sql of statements) await client.query(sql);
    }
    await apply(files.web);
    if (stage === "upgrade" || stage === "web") await seedExistingWebRecords(client);
    await apply(files.mobile);
    await verifyFixtureSchema(client, stage);
    if (stage !== "fresh") {
      assert.deepEqual(await existingWebRecords(client), [{
        id: "cc-web-existing", currency: "USD", timeZone: "UTC",
        providerAccountId: "cc-existing-subject", transactionId: "cc-web-transaction",
        categoryId: "cc-web-category", tagId: "cc-web-tag", type: "EXPENSE", amount: "999999999999.99",
        localDate: "2035-08-31", tagName: "Fixture tag",
      }]);
    }
  } finally {
    await client.end();
  }
}
