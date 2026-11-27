import { setTimeout as delay } from "node:timers/promises";

export type RunCase = (name: string, work: () => Promise<void>, timeoutMs?: number) => Promise<void>;

export async function waitCondition(predicate: () => Promise<boolean> | boolean, timeoutMs: number) {
  const deadline = performance.now() + timeoutMs;
  do {
    if (await predicate()) return;
    await delay(Math.min(25, Math.max(0, deadline - performance.now())));
  } while (performance.now() < deadline);
  throw new Error("Fixture condition timed out");
}
