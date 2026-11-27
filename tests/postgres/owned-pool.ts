import assert from "node:assert/strict";

import type { MobileLease, MobileParameter } from "../../lib/auth/mobile/mobile-transaction";
import { verifyFixtureIdentity, type Fixture } from "./fixture";

type Result = Awaited<ReturnType<MobileLease["query"]>>;
type Forward = (replacement?: string) => Promise<Result>;
type Hooks = {
  checkout?: () => Promise<void>;
  query?: (text: string, pid: number, forward: Forward) => Promise<Result>;
};

export function gate() {
  const entered = Promise.withResolvers<void>();
  const released = Promise.withResolvers<void>();
  return {
    entered: entered.promise,
    open: () => released.resolve(),
    async wait() { entered.resolve(); await released.promise; },
  };
}

export async function ownedPool(fixture: Fixture, hooks: Hooks = {}) {
  const { createMobileTransactionExecutor } = await import("../../lib/auth/mobile/mobile-transaction");
  const pids = new Set<number>();
  const events: { pid: number; command: string }[] = [];
  const dispositions: { pid: number; destroyed: boolean }[] = [];
  let attempts = 0;

  const execute = createMobileTransactionExecutor(() => ({
    async connect(): Promise<MobileLease> {
      attempts++;
      const client = await fixture.pool.connect();
      const ignore = () => {};
      client.on("error", ignore);
      let pid: number;
      try {
        pid = await verifyFixtureIdentity(client, fixture.target);
        pids.add(pid);
        await hooks.checkout?.();
      } catch (error) {
        client.removeListener("error", ignore);
        client.release(true);
        throw error;
      }
      let released = false;
      return {
        on: (event, fn) => client.on(event, fn),
        removeListener: (event, fn) => client.removeListener(event, fn),
        async query(text: string, values?: MobileParameter[]) {
          assert.equal(released, false);
          events.push({ pid, command: text.trim().split(/\s+/, 1)[0] });
          const forward: Forward = async (replacement) => {
            if (released) throw new Error("Synthetic checkout already closed");
            return client.query(replacement ?? text, replacement ? undefined : values);
          };
          return hooks.query ? hooks.query(text, pid, forward) : forward();
        },
        release(destroyed = false) {
          assert.equal(released, false);
          released = true;
          dispositions.push({ pid, destroyed });
          client.removeListener("error", ignore);
          client.release(destroyed);
        },
      };
    },
  }));

  return { execute, pids, events, dispositions, attempts: () => attempts };
}
