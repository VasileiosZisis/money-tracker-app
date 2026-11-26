import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type MobileDatabaseFailure = { status: "database_unavailable" };

export const mobileDatabaseClock = Prisma.sql`date_trunc('milliseconds', clock_timestamp())`;

export async function readMobileDatabase<T>(read: () => Promise<T>): Promise<T | MobileDatabaseFailure> {
  try {
    return await read();
  } catch {
    return { status: "database_unavailable" };
  }
}

export function runMobileTransaction<T>(
  transition: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T | MobileDatabaseFailure> {
  return readMobileDatabase(() => db.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL lock_timeout = '1500ms'`;
    await tx.$executeRaw`SET LOCAL statement_timeout = '3000ms'`;
    return transition(tx);
  }, { isolationLevel: "ReadCommitted", maxWait: 2_000, timeout: 5_000 }));
}

export async function readMobileDatabaseTime(tx: Prisma.TransactionClient): Promise<Date> {
  const [row] = await tx.$queryRaw<{ now: Date }[]>`SELECT ${mobileDatabaseClock} AS "now"`;
  if (!row || !(row.now instanceof Date) || !Number.isFinite(row.now.getTime())) {
    throw new Error("Invalid mobile database clock");
  }
  return row.now;
}

export function requireSingleMobileWrite({ count }: { count: number }): void {
  if (count !== 1) throw new Error("Unexpected mobile authentication write count");
}
