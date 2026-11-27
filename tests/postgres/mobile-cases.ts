import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID, sign } from "node:crypto";

import { mobileContext } from "./bridges";
import { waitCondition, type RunCase } from "./cases";
import { withFixture, type Fixture } from "./fixture";
import { gate, ownedPool } from "./owned-pool";
import type { FixtureTarget } from "./target";

const audience = "100000000011-fixture-mobile.apps.googleusercontent.com";
const presenter = "100000000012-fixture-android.apps.googleusercontent.com";
const kid = "disposable-postgres-fixture";
const secret = Buffer.alloc(32, 37).toString("base64url");
const challengeDay = 86_400_000;

async function resetMobile(fixture: Fixture) {
  await fixture.observer.query('TRUNCATE "MobileAuthChallenge", "MobileRefreshCredential", "MobileSession", "MobileRateLimitBucket"');
  await fixture.observer.query('UPDATE "MobileRateLimitCapacity" SET "bucketCount" = 0 WHERE "id" = 1');
}

export async function mobileCases(target: FixtureTarget, run: RunCase) {
  const session = await import("../../lib/auth/mobile/session-service");
  const limiter = await import("../../lib/auth/mobile/rate-limit");
  const { cleanupExpiredMobileAuthRecords } = await import("../../lib/auth/mobile/cleanup-service");
  const { digestMobileToken } = await import("../../lib/auth/mobile/credentials");
  const { identifyMobileRequestSource } = await import("../../lib/auth/mobile/request-source");
  const { deriveMobileRateLimitKey, readMobileRateLimitSecret } = await import("../../lib/auth/mobile/rate-limit-keys");
  const keys = generateKeyPairSync("rsa", { modulusLength: 2048 });
  let observeBeforeGoogle: (() => Promise<void>) | undefined;
  const originalFetch = globalThis.fetch;

  process.env.MOBILE_GOOGLE_AUDIENCE = audience;
  process.env.MOBILE_GOOGLE_ALLOWED_PRESENTERS = presenter;
  process.env.MOBILE_RATE_LIMIT_KEY_SECRET = secret;
  // This is process-local fixture configuration for the source parser. No route is enabled.
  process.env.VERCEL = "1";
  process.env.VERCEL_ENV = "preview";
  globalThis.fetch = async (url) => {
    assert.equal(url.toString(), "https://www.googleapis.com/oauth2/v1/certs");
    await observeBeforeGoogle?.();
    return Response.json({ [kid]: keys.publicKey.export({ type: "spki", format: "pem" }).toString() },
      { headers: { "cache-control": "max-age=0" } });
  };

  function proof(subject: string, nonce: string) {
    const now = Math.floor(Date.now() / 1_000);
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const message = encode({ alg: "RS256", kid }) + "." + encode({
      sub: subject, nonce, iss: "https://accounts.google.com", aud: audience, azp: presenter, iat: now - 1, exp: now + 120,
    });
    return message + "." + sign("RSA-SHA256", Buffer.from(message), keys.privateKey).toString("base64url");
  }

  function withMobileExecutor<T>(owned: Awaited<ReturnType<typeof ownedPool>>, call: () => Promise<T>) {
    return mobileContext.run(owned.execute, call);
  }

  async function challenge(owned: Awaited<ReturnType<typeof ownedPool>>, subject: string) {
    const issued = await withMobileExecutor(owned, session.issueMobileAuthChallenge);
    assert.ok(issued.status === "issued");
    return { challengeId: issued.challengeId, idToken: proof(subject, issued.nonce) };
  }

  async function fixtureUser(fixture: Fixture, users: string[]) {
    const userId = randomUUID();
    const subject = "fixture-google-" + randomUUID();
    await fixture.observer.query('INSERT INTO "User" ("id", "updatedAt") VALUES ($1, now())', [userId]);
    users.push(userId);
    await fixture.observer.query(
      'INSERT INTO "Account" ("id","userId","type","provider","providerAccountId") VALUES ($1,$2,\'oauth\',\'google\',$3)',
      [randomUUID(), userId, subject],
    );
    return { userId, subject };
  }

  async function signedIn(owned: Awaited<ReturnType<typeof ownedPool>>, subject: string) {
    const request = await challenge(owned, subject);
    const result = await withMobileExecutor(owned, () => session.exchangeMobileGoogleProof(request));
    assert.ok(result.status === "authenticated");
    const identity = await withMobileExecutor(owned, () => session.authenticateMobileAccess(result.tokens.accessToken));
    assert.ok(identity.status === "authenticated");
    return { ...result.tokens, ...identity };
  }

  async function mobile(name: string, body: (fixture: Fixture, users: string[], owned: Awaited<ReturnType<typeof ownedPool>>) => Promise<void>) {
    await run(name, () => withFixture(target, async (fixture) => {
      const users: string[] = [];
      const owned = await ownedPool(fixture);
      await resetMobile(fixture);
      try {
        await body(fixture, users, owned);
        await fixture.clean(owned.pids);
      } finally {
        observeBeforeGoogle = undefined;
        await resetMobile(fixture);
        await fixture.observer.query('DELETE FROM "User" WHERE "id" = ANY($1::text[])', [users]);
      }
    }, 2), 30_000);
  }

  try {
    await mobile("concurrent challenge consumption, exact subject and unlinked proof", async (fixture, users, owned) => {
      const user = await fixtureUser(fixture, users);
      const input = await challenge(owned, user.subject);
      const results = await Promise.all([1, 2].map(() => withMobileExecutor(owned, () => session.exchangeMobileGoogleProof(input))));
      assert.deepEqual(results.map((result) => result.status).sort(), ["authenticated", "invalid_proof"]);
      const unmatched = await challenge(owned, user.subject.toUpperCase());
      assert.equal((await withMobileExecutor(owned, () => session.exchangeMobileGoogleProof(unmatched))).status, "account_not_linked");
      assert.equal((await fixture.observer.query(
        'SELECT 1 FROM "MobileAuthChallenge" WHERE "id" = $1 AND "consumedAt" IS NOT NULL', [unmatched.challengeId],
      )).rowCount, 1);
      assert.equal((await fixture.observer.query('SELECT 1 FROM "MobileSession"')).rowCount, 1);
    });

    for (const phase of ["unlink", "delete", "insert-failure"] as const) {
      await mobile("exchange rollback after " + phase, async (fixture, users, owned) => {
        const user = await fixtureUser(fixture, users);
        const input = await challenge(owned, user.subject);
        const latch = gate();
        const actor = await ownedPool(fixture, { async query(text, _pid, forward) {
          if (phase === "insert-failure" && text.includes('INSERT INTO "MobileSession"')) return forward("SELECT 1 / 0");
          if ((phase === "unlink" && text.includes("FOR SHARE")) || (phase === "delete" && text.includes("FOR KEY SHARE"))) {
            await latch.wait();
          }
          return forward();
        } });
        const exchange = withMobileExecutor(actor, () => session.exchangeMobileGoogleProof(input));
        if (phase !== "insert-failure") {
          try {
            await latch.entered;
            if (phase === "unlink") await fixture.observer.query('DELETE FROM "Account" WHERE "userId" = $1', [user.userId]);
            else await fixture.observer.query('DELETE FROM "User" WHERE "id" = $1', [user.userId]);
          } finally { latch.open(); }
        }
        assert.equal((await exchange).status, "database_unavailable");
        assert.equal((await fixture.observer.query(
          'SELECT 1 FROM "MobileAuthChallenge" WHERE "id" = $1 AND "consumedAt" IS NULL', [input.challengeId],
        )).rowCount, 1);
        assert.equal((await fixture.observer.query('SELECT 1 FROM "MobileSession"')).rowCount, 0);
        await fixture.clean(actor.pids);
      });
    }

    await mobile("concurrent refresh, replay revocation and independent users and devices", async (fixture, users, owned) => {
      const user = await fixtureUser(fixture, users);
      const otherUser = await fixtureUser(fixture, users);
      const device = await signedIn(owned, user.subject);
      const sameUser = await signedIn(owned, user.subject);
      const another = await signedIn(owned, otherUser.subject);
      const results = await Promise.all([1, 2].map(() => withMobileExecutor(owned, () => session.rotateMobileRefresh(device.refreshToken))));
      assert.deepEqual(results.map((result) => result.status).sort(), ["credential_reused", "rotated"]);
      const [revoked] = (await fixture.observer.query('SELECT "revokedAt" FROM "MobileSession" WHERE "id" = $1', [device.sessionId])).rows;
      assert.ok(revoked?.revokedAt instanceof Date);
      assert.equal((await withMobileExecutor(owned, () => session.authenticateMobileAccess(sameUser.accessToken))).status, "authenticated");
      const fresh = await withMobileExecutor(owned, () => session.authenticateMobileAccess(another.accessToken));
      assert.ok(fresh.status === "authenticated" && fresh.userId === otherUser.userId);
    });

    await mobile("refresh admission and rotation rollback together, replay beats a saturated budget", async (fixture, users, owned) => {
      const device = await signedIn(owned, (await fixtureUser(fixture, users)).subject);
      const actor = await ownedPool(fixture, { query(text, _pid, forward) {
        return text.includes('SET "accessTokenDigest"') ? forward("SELECT 1 / 0") : forward();
      } });
      assert.equal((await withMobileExecutor(actor, () => session.rotateMobileRefresh(device.refreshToken))).status, "database_unavailable");
      assert.equal((await fixture.observer.query('SELECT 1 FROM "MobileRateLimitBucket"')).rowCount, 0);
      assert.equal((await fixture.observer.query(
        'SELECT 1 FROM "MobileRefreshCredential" WHERE "tokenDigest" = $1 AND "consumedAt" IS NULL',
        [digestMobileToken("refresh", device.refreshToken)],
      )).rowCount, 1);
      const rotated = await withMobileExecutor(owned, () => session.rotateMobileRefresh(device.refreshToken));
      assert.ok(rotated.status === "rotated");
      const key = deriveMobileRateLimitKey(readMobileRateLimitSecret() ?? assert.fail(), "refresh_session", "session", device.sessionId);
      assert.equal((await fixture.observer.query(
        'UPDATE "MobileRateLimitBucket" SET "admittedCount" = 10 WHERE "policy" = $1 AND "bucketKey" = $2', ["refresh_session", key],
      )).rowCount, 1);
      const replay = await ownedPool(fixture, { query(text, _pid, forward) {
        assert.doesNotMatch(text, /MobileRateLimitBucket/);
        return forward();
      } });
      assert.equal((await withMobileExecutor(replay, () => session.rotateMobileRefresh(device.refreshToken))).status, "credential_reused");
      assert.equal((await withMobileExecutor(owned, () => session.authenticateMobileAccess(rotated.tokens.accessToken))).status, "invalid_credential");
      await fixture.clean(new Set([...actor.pids, ...replay.pids]));
    });

    for (const first of ["refresh", "logout"] as const) {
      await mobile(first + " locks the device before its competing request", async (fixture, users, owned) => {
        const device = await signedIn(owned, (await fixtureUser(fixture, users)).subject);
        const latch = gate();
        const actor = await ownedPool(fixture, { async query(text, _pid, forward) {
          const result = await forward();
          if (text.includes('FROM "MobileSession"') && text.includes("FOR UPDATE")) await latch.wait();
          return result;
        } });
        const mutate = (kind: "refresh" | "logout", selected: typeof actor) => kind === "refresh"
          ? withMobileExecutor(selected, () => session.rotateMobileRefresh(device.refreshToken))
          : withMobileExecutor(selected, () => session.logoutMobileSession(device.refreshToken));
        const one = mutate(first, actor);
        let two: ReturnType<typeof mutate>;
        try {
          await latch.entered;
          two = mutate(first === "refresh" ? "logout" : "refresh", owned);
          await waitCondition(async () => (await fixture.observer.query(
            "SELECT 1 FROM pg_stat_activity WHERE pid = ANY($1::integer[]) AND wait_event_type = 'Lock'",
            [[...owned.pids].filter((pid) => !actor.pids.has(pid))],
          )).rowCount === 1, 900);
        } finally { latch.open(); }
        assert.equal((await one).status, first === "refresh" ? "rotated" : "logged_out");
        assert.equal((await two).status, first === "refresh" ? "logged_out" : "invalid_credential");
        await fixture.clean(actor.pids);
      });
    }

    await mobile("database wall clock rejects a refresh that expires during a device lock wait", async (fixture, users, owned) => {
      const device = await signedIn(owned, (await fixtureUser(fixture, users)).subject);
      await fixture.blocker.query("BEGIN");
      let rotation: ReturnType<typeof session.rotateMobileRefresh>;
      try {
        await fixture.blocker.query('SELECT 1 FROM "MobileSession" WHERE "id" = $1 FOR UPDATE', [device.sessionId]);
        const { rows: [row] } = await fixture.observer.query<{ expiresAt: Date }>(
          'UPDATE "MobileRefreshCredential" SET "expiresAt" = clock_timestamp() + interval \'650 milliseconds\' WHERE "sessionId" = $1 RETURNING "expiresAt"',
          [device.sessionId],
        );
        rotation = withMobileExecutor(owned, () => session.rotateMobileRefresh(device.refreshToken));
        await waitCondition(async () => (await fixture.observer.query<{ expired: boolean }>(
          'SELECT clock_timestamp() >= $1::timestamptz AS expired', [row.expiresAt],
        )).rows[0].expired, 1_100);
      } finally { await fixture.blocker.query("ROLLBACK"); }
      assert.equal((await rotation).status, "invalid_credential");
      assert.equal((await fixture.observer.query('SELECT 1 FROM "MobileRateLimitBucket"')).rowCount, 0);
    });

    await mobile("source and challenge admissions commit before Google, concurrent challenge budget is exact", async (fixture, users, owned) => {
      const source = identifyMobileRequestSource(new Headers({ "x-vercel-forwarded-for": "192.0.2.12" }));
      assert.ok(source.status === "identified");
      const input = await challenge(owned, (await fixtureUser(fixture, users)).subject);
      assert.equal((await withMobileExecutor(owned, () => limiter.admitMobileRateLimit({ policy: "exchange_source", source: source.source }))).status, "allowed");
      const consume = () => withMobileExecutor(owned, () => limiter.admitMobileRateLimit({ policy: "exchange_challenge", challengeId: input.challengeId }));
      let allowed = 0;
      for (let batch = 0; batch < 4; batch++) {
        allowed += (await Promise.all([consume(), consume()])).filter((result) => result.status === "allowed").length;
      }
      assert.equal(allowed, 5);
      observeBeforeGoogle = async () => {
        const counts = (await fixture.observer.query('SELECT "policy","admittedCount" FROM "MobileRateLimitBucket" ORDER BY "policy"')).rows;
        assert.deepEqual(counts, [{ policy: "exchange_challenge", admittedCount: 5 }, { policy: "exchange_source", admittedCount: 1 }]);
      };
      assert.equal((await withMobileExecutor(owned, () => session.exchangeMobileGoogleProof(input))).status, "authenticated");
    });

    await mobile("concurrent missing buckets at capacity and bounded cleanup racing admission", async (fixture, _users, owned) => {
      await fixture.observer.query(`
        INSERT INTO "MobileRateLimitBucket" ("policy","bucketKey","windowStartedAt","expiresAt","admittedCount")
        SELECT 'financial_write_account', decode(lpad(to_hex(i),64,'0'),'hex'),
               date_trunc('minute',clock_timestamp()) - interval '2 minutes',
               date_trunc('minute',clock_timestamp()) - interval '1 minute', 1
        FROM generate_series(1,9999) i
      `);
      await fixture.observer.query('UPDATE "MobileRateLimitCapacity" SET "bucketCount" = 9999 WHERE "id" = 1');
      const a = await challenge(owned, "unused-a");
      const b = await challenge(owned, "unused-b");
      const admit = (challengeId: string) => withMobileExecutor(owned, () => limiter.admitMobileRateLimit({ policy: "exchange_challenge", challengeId }));
      const started = await Promise.all([admit(a.challengeId), admit(b.challengeId)]);
      assert.deepEqual(started.map((result) => result.status).sort(), ["allowed", "capacity_unavailable"]);
      const cleanup = withMobileExecutor(owned, limiter.cleanupExpiredMobileRateLimits);
      const extra = admit(started[0].status === "allowed" ? b.challengeId : a.challengeId);
      assert.deepEqual(await cleanup, { status: "cleaned", bucketsDeleted: 200 });
      const outcome = await extra;
      assert.ok(outcome.status === "allowed" || outcome.status === "capacity_unavailable");
      const { rows: [ledger] } = await fixture.observer.query(
        'SELECT "bucketCount", (SELECT count(*)::int FROM "MobileRateLimitBucket") AS actual FROM "MobileRateLimitCapacity"',
      );
      assert.equal(ledger.bucketCount, ledger.actual);
      assert.equal(ledger.actual, outcome.status === "allowed" ? 9_801 : 9_800);
      assert.equal((await fixture.observer.query('SELECT 1 FROM "MobileRateLimitBucket" WHERE "policy" = $1', ["exchange_challenge"])).rowCount,
        outcome.status === "allowed" ? 2 : 1);
    });

    await mobile("auth cleanup leaves retained history, bounds each batch and cascades user deletion", async (fixture, users, owned) => {
      const user = await fixtureUser(fixture, users);
      const active = await signedIn(owned, user.subject);
      const cutoff = new Date(Date.now() - challengeDay);
      await fixture.observer.query(`
        INSERT INTO "MobileAuthChallenge" ("id","nonceDigest","createdAt","expiresAt")
        SELECT 'fixture-expired-challenge-' || i, decode(repeat('01',32),'hex'),
               $1::timestamptz - interval '5 minutes', $1::timestamptz
        FROM generate_series(1,52) i
      `, [cutoff]);
      await fixture.observer.query(`
        INSERT INTO "MobileSession" ("id","userId","createdAt","accessTokenDigest","accessExpiresAt","absoluteExpiresAt")
        SELECT 'fixture-expired-session-' || i, $1, $2::timestamptz - interval '1 minute',
               decode(lpad(to_hex(i),64,'0'),'hex'), $2, $2 FROM generate_series(1,21) i
      `, [user.userId, cutoff]);
      await fixture.observer.query(`
        INSERT INTO "MobileRefreshCredential" ("tokenDigest","sessionId","issuedAt","expiresAt","consumedAt")
        SELECT decode(lpad(to_hex(i),64,'0'),'hex'), 'fixture-expired-session-1',
               $1::timestamptz - interval '1 minute', $1, $1::timestamptz - interval '1 second'
        FROM generate_series(1,205) i
      `, [cutoff]);
      const result = await withMobileExecutor(owned, cleanupExpiredMobileAuthRecords);
      assert.deepEqual(result, { status: "cleaned", challengesDeleted: 50, sessionsDeleted: 19, refreshCredentialsDeleted: 200 });
      assert.equal((await fixture.observer.query('SELECT 1 FROM "MobileRefreshCredential" WHERE "sessionId" = $1', ["fixture-expired-session-1"])).rowCount, 5);
      assert.equal((await withMobileExecutor(owned, () => session.authenticateMobileAccess(active.accessToken))).status, "authenticated");
      await fixture.observer.query('DELETE FROM "User" WHERE "id" = $1', [user.userId]);
      assert.equal((await fixture.observer.query('SELECT 1 FROM "MobileSession"')).rowCount, 0);
      assert.equal((await fixture.observer.query('SELECT 1 FROM "MobileRefreshCredential"')).rowCount, 0);
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
}
