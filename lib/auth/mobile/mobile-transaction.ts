import "server-only";

import { performance } from "node:perf_hooks";

import { mobileStatements, type MobileStatement } from "./mobile-statements";

export type MobileParameter = string | number | Date | Uint8Array | readonly string[];
type DriverResult = { command: string; rowCount: number | null; rows: unknown[] };

export type MobileLease = {
  query(text: string, values?: MobileParameter[]): Promise<DriverResult>;
  on(event: "error", callback: () => void): unknown;
  removeListener(event: "error", callback: () => void): unknown;
  release(destroy?: boolean): void;
};

export type MobilePool = { connect(): Promise<MobileLease> };

export type MobileTransaction = {
  query<Row extends object = Record<string, unknown>>(
    statement: MobileStatement, values?: readonly MobileParameter[],
  ): Promise<{ rows: Row[]; rowCount: number }>;
};

type FailureReason =
  | "admission_full" | "acquisition_failed" | "startup_timeout" | "initialization_failed"
  | "execution_timeout" | "transaction_failed" | "connection_lost"
  | "rollback_unconfirmed" | "invalid_commit" | "uncertain_commit" | "disposition_failed";

export type MobileTransactionOutcome<T> =
  | { status: "committed"; value: T }
  | { status: "failed"; reason: FailureReason };

type DeadlineClock = {
  now(): number;
  schedule(callback: () => void, delayMs: number): () => void;
};

const monotonicClock: DeadlineClock = {
  now: () => performance.now(),
  schedule(callback, delayMs) {
    const timer = setTimeout(callback, delayMs);
    return () => clearTimeout(timer);
  },
};

const maximumAdmitted = 4;
const startupMs = 2_000;
const executionMs = 5_000;
const cleanupMs = 2_000;
const initialization = [
  ["BEGIN", "BEGIN ISOLATION LEVEL READ COMMITTED"],
  ["SET", "SET LOCAL lock_timeout = '1500ms'"],
  ["SET", "SET LOCAL statement_timeout = '3000ms'"],
  ["SET", "SET LOCAL idle_in_transaction_session_timeout = '7000ms'"],
] as const;

type Phase = "acquiring" | "initializing" | "active" | "closing" | "done";
const failed = (reason: FailureReason) => ({ status: "failed" as const, reason });

function observedRejection<T>(promise: Promise<T>): Promise<T> {
  // The owner also handles callers that accidentally drop a query promise.
  void promise.catch(() => {});
  return promise;
}

export function createMobileTransactionExecutor(getPool: () => MobilePool, clock = monotonicClock) {
  let admitted = 0;

  return function execute<T>(
    transition: (transaction: MobileTransaction) => Promise<T>,
  ): Promise<MobileTransactionOutcome<T>> {
    if (admitted >= maximumAdmitted) return Promise.resolve(failed("admission_full"));
    admitted++;

    return new Promise((resolve) => {
      const startedAt = clock.now();
      const startupDeadline = startedAt + startupMs;
      const overallDeadline = startupDeadline + executionMs + cleanupMs;
      const state: { phase: Phase } = { phase: "acquiring" };
      let deadline = startupDeadline;
      let cancelTimer: (() => void) | undefined;
      let awaitingCheckout = true;
      let lease: MobileLease | undefined;
      let inFlight = false;
      let poisoned = false;
      let commitAttempted = false;

      function dispose(reuse: boolean) {
        const client = lease;
        lease = undefined;
        if (!client) return;
        client.removeListener("error", connectionLost);
        client.release(!reuse);
      }

      function finish(outcome: MobileTransactionOutcome<T>, reuse = false) {
        if (state.phase === "done") return;
        state.phase = "done";
        cancelTimer?.();
        try {
          dispose(reuse);
        } catch {
          if (outcome.status === "committed") outcome = failed("disposition_failed");
        } finally {
          // A timed-out acquire continues to occupy its slot until connect settles.
          if (!awaitingCheckout) admitted--;
        }
        resolve(outcome);
      }

      function connectionLost() {
        finish(failed(commitAttempted ? "uncertain_commit" : "connection_lost"));
      }

      function expire() {
        switch (state.phase) {
          case "acquiring":
          case "initializing":
            finish(failed("startup_timeout"));
            break;
          case "active":
            if (inFlight) finish(failed("execution_timeout"));
            else void close(failed("execution_timeout"));
            break;
          case "closing":
            finish(failed(commitAttempted ? "uncertain_commit" : "rollback_unconfirmed"));
        }
      }

      function arm(phase: Phase, until: number) {
        cancelTimer?.();
        state.phase = phase;
        deadline = until;
        cancelTimer = clock.schedule(() => {
          if (state.phase === phase) expire();
        }, Math.max(0, Math.ceil(until - clock.now())));
      }

      async function close(outcome: MobileTransactionOutcome<T>) {
        const client = lease;
        if (!client || inFlight) {
          finish(failed("transaction_failed"));
          return;
        }
        const terminalDeadline = Math.min(clock.now() + cleanupMs, overallDeadline);
        if (clock.now() >= terminalDeadline) {
          finish(failed("rollback_unconfirmed"));
          return;
        }
        arm("closing", terminalDeadline);
        const command = outcome.status === "committed" ? "COMMIT" : "ROLLBACK";
        commitAttempted = command === "COMMIT";
        try {
          const result = await client.query(command);
          if (state.phase !== "closing") return;
          if (clock.now() >= deadline) {
            expire();
          } else if (result.command === command) {
            finish(outcome, true);
          } else {
            finish(failed(commitAttempted
              ? result.command === "ROLLBACK" ? "invalid_commit" : "uncertain_commit"
              : "rollback_unconfirmed"));
          }
        } catch {
          finish(failed(commitAttempted ? "uncertain_commit" : "rollback_unconfirmed"));
        }
      }

      const transaction: MobileTransaction = Object.freeze({
        query<Row extends object>(name: MobileStatement, values: readonly MobileParameter[] = []) {
          const client = lease;
          if (state.phase === "active" && clock.now() >= deadline) expire();
          if (state.phase !== "active" || !client || inFlight || poisoned || !Object.hasOwn(mobileStatements, name)) {
            if (state.phase === "active") poisoned = true;
            return observedRejection(Promise.reject(new Error("Mobile transaction query unavailable")));
          }
          const [command, text] = mobileStatements[name];
          inFlight = true;
          return observedRejection((async () => {
            try {
              const result = await client.query(text, [...values]);
              if (state.phase !== "active" || clock.now() >= deadline || result.command !== command ||
                !Array.isArray(result.rows) || result.rowCount === null ||
                !Number.isSafeInteger(result.rowCount) || result.rowCount < 0 ||
                (command === "SELECT" && result.rowCount !== result.rows.length)) {
                throw new Error("Invalid mobile transaction query result");
              }
              return { rows: result.rows as Row[], rowCount: result.rowCount };
            } catch {
              poisoned = true;
              throw new Error("Mobile transaction query failed");
            } finally {
              inFlight = false;
            }
          })());
        },
      });

      async function run() {
        try {
          lease = await getPool().connect();
        } catch {
          awaitingCheckout = false;
          if (state.phase === "done") admitted--;
          else finish(failed("acquisition_failed"));
          return;
        }
        awaitingCheckout = false;
        if (state.phase === "done") {
          try {
            dispose(false);
          } catch {
            // A late checkout can never affect the already returned result.
          } finally {
            admitted--;
          }
          return;
        }

        try {
          lease.on("error", connectionLost);
          if (clock.now() >= startupDeadline) {
            expire();
            return;
          }
          const client = lease;
          arm("initializing", startupDeadline);
          for (const [command, sql] of initialization) {
            const result = await client.query(sql);
            if (state.phase !== "initializing") return;
            if (clock.now() >= deadline) {
              expire();
              return;
            }
            if (result.command !== command) throw new Error("Invalid mobile transaction initialization");
          }
          arm("active", Math.min(clock.now() + executionMs, overallDeadline - cleanupMs));
          const value = await transition(transaction);
          if (state.phase !== "active") return;
          if (clock.now() >= deadline) expire();
          else await close(poisoned ? failed("transaction_failed") : { status: "committed", value });
        } catch {
          if (state.phase === "initializing" || state.phase === "acquiring") {
            finish(failed("initialization_failed"));
          } else if (state.phase === "active") {
            if (clock.now() >= deadline) expire();
            else await close(failed("transaction_failed"));
          }
        }
      }

      arm("acquiring", startupDeadline);
      void run();
    });
  };
}
