import "server-only";

import { executeMobileDatabaseTransaction } from "@/lib/auth/mobile/mobile-pool";

import type { MobileTransaction } from "./mobile-transaction";

export type MobileDatabaseFailure = { status: "database_unavailable" };

export async function runMobileTransaction<T>(
  transition: (tx: MobileTransaction) => Promise<T>,
): Promise<T | MobileDatabaseFailure> {
  const result = await executeMobileDatabaseTransaction(transition);
  return result.status === "committed" ? result.value : { status: "database_unavailable" };
}

export function optionalMobileRow<T extends object>(rows: T[]): T | undefined {
  const [row] = rows;
  if (rows.length > 1 || (rows.length === 1 && (!row || typeof row !== "object" || Array.isArray(row)))) {
    throw new Error("Invalid mobile database row");
  }
  return row;
}

export function isMobileDatabaseDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

export function isMobileDatabaseId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

export async function readMobileDatabaseTime(tx: MobileTransaction): Promise<Date> {
  const row = optionalMobileRow((await tx.query<{ now: Date }>("clock")).rows);
  if (!row || !isMobileDatabaseDate(row.now)) throw new Error("Invalid mobile database clock");
  return row.now;
}

export function requireSingleMobileWrite({ rowCount }: { rowCount: number }): void {
  if (rowCount !== 1) throw new Error("Unexpected mobile authentication write count");
}
