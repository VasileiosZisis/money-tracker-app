import { AsyncLocalStorage } from "node:async_hooks";

import type { PrismaClient } from "../../generated/prisma/client";
import type { createMobileTransactionExecutor } from "../../lib/auth/mobile/mobile-transaction";

export const mobileContext = new AsyncLocalStorage<ReturnType<typeof createMobileTransactionExecutor>>();

export const executeMobileDatabaseTransaction: ReturnType<typeof createMobileTransactionExecutor> = (transition) => {
  const execute = mobileContext.getStore();
  if (!execute) throw new Error("Missing guarded mobile fixture scope");
  return execute(transition);
};

export let db: PrismaClient;
export let fixtureUserId: string;

export function bindWebFixture(client: PrismaClient, userId: string) {
  db = client;
  fixtureUserId = userId;
}

export async function getUserIdOrThrow() {
  if (!fixtureUserId) throw new Error("Missing fictional web fixture identity");
  return fixtureUserId;
}

export function revalidatePath() {}
