import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import type { MobileLease, MobileParameter, MobileTransaction } from "./mobile-transaction";
import type { MobileStatement } from "./mobile-statements";

// This wire double models the driver's result shape and committed application
// state. It does not simulate PostgreSQL locks, isolation, or socket cleanup.
export function mobileDatabaseDouble<State>({
  current, commit, record, query, onConnection,
}: {
  current: () => State;
  commit: (state: State) => void;
  record: (step: string, state: State) => void;
  query: (state: State, statement: MobileStatement, sql: string, values: MobileParameter[]) => object[] | number;
  onConnection?: (active: boolean) => void;
}) {
  let executor: ReturnType<typeof import("./mobile-transaction").createMobileTransactionExecutor> | undefined;

  return async function executeMobileDatabaseTransaction<T>(transition: (tx: MobileTransaction) => Promise<T>) {
    const { createMobileTransactionExecutor } = await import("./mobile-transaction");
    const { mobileStatements } = await import("./mobile-statements");
    executor ??= createMobileTransactionExecutor(() => ({
      async connect(): Promise<MobileLease> {
        const events = new EventEmitter();
        let draft: State;
        let finalized = false;

        return {
          on: events.on.bind(events),
          removeListener: events.removeListener.bind(events),
          async query(text, values = []) {
            assert.equal(finalized, false);
            if (text === "BEGIN ISOLATION LEVEL READ COMMITTED") {
              record("tx.begin", current());
              draft = structuredClone(current());
              onConnection?.(true);
              return { command: "BEGIN", rowCount: null, rows: [] };
            }
            if (text.startsWith("SET LOCAL ")) {
              assert.ok([
                "SET LOCAL lock_timeout = '1500ms'",
                "SET LOCAL statement_timeout = '3000ms'",
                "SET LOCAL idle_in_transaction_session_timeout = '7000ms'",
              ].includes(text));
              record("tx.settings", draft);
              return { command: "SET", rowCount: null, rows: [] };
            }
            if (text === "COMMIT") {
              record("tx.beforeCommit", draft);
              commit(draft);
              record("tx.commit", draft);
              record("tx.afterCommit", draft);
              return { command: "COMMIT", rowCount: null, rows: [] };
            }
            if (text === "ROLLBACK") {
              record("tx.rollback", draft);
              return { command: "ROLLBACK", rowCount: null, rows: [] };
            }
            const match = (Object.keys(mobileStatements) as MobileStatement[])
              .find((name) => mobileStatements[name][1] === text);
            assert.ok(match, "Unrecognized mobile SQL");
            const [command] = mobileStatements[match];
            const result = query(draft, match, text.replace(/\s+/g, " ").trim(), values);
            return { command, rows: Array.isArray(result) ? result : [], rowCount: typeof result === "number" ? result : result.length };
          },
          release() {
            assert.equal(finalized, false);
            finalized = true;
            onConnection?.(false);
          },
        };
      },
    }));
    return executor(transition);
  };
}
