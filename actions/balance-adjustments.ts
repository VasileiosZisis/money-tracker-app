"use server";

import { revalidatePath } from "next/cache";

import {
  actionError,
  actionSuccess,
  type ActionResult,
} from "@/lib/actions/result";
import { getUserIdOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { getTodayLocalDate } from "@/lib/forecast";
import {
  createBalanceAdjustmentSchema,
  deleteBalanceAdjustmentSchema,
  updateBalanceAdjustmentSchema,
  type CreateBalanceAdjustmentInput,
  type DeleteBalanceAdjustmentInput,
  type UpdateBalanceAdjustmentInput,
} from "@/lib/validators/balance-adjustment";

export type BalanceAdjustmentListItem = {
  id: string;
  amount: string;
  effectiveMonth: string;
  note: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function getValidationError(message: string | undefined) {
  return actionError(message ?? "Invalid balance adjustment input.");
}

function revalidateBalanceAdjustmentPaths() {
  revalidatePath("/dashboard");
}

export async function listBalanceAdjustments(): Promise<
  BalanceAdjustmentListItem[]
> {
  const userId = await getUserIdOrThrow();

  const adjustments = await db.balanceAdjustment.findMany({
    where: { userId },
    select: {
      id: true,
      amount: true,
      effectiveMonth: true,
      note: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ effectiveMonth: "desc" }, { createdAt: "desc" }],
  });

  return adjustments.map((adjustment) => ({
    ...adjustment,
    amount: adjustment.amount.toString(),
  }));
}

export async function createBalanceAdjustment(
  input: CreateBalanceAdjustmentInput,
): Promise<ActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = createBalanceAdjustmentSchema(getTodayLocalDate()).safeParse(
    input,
  );

  if (!parsed.success) {
    return getValidationError(parsed.error.issues[0]?.message);
  }

  try {
    await db.balanceAdjustment.create({
      data: {
        userId,
        amount: parsed.data.amount,
        effectiveMonth: parsed.data.effectiveMonth,
        note: parsed.data.note ?? null,
      },
    });
  } catch {
    return actionError(
      "Could not save balance adjustment. Please try again.",
    );
  }

  revalidateBalanceAdjustmentPaths();
  return actionSuccess();
}

export async function updateBalanceAdjustment(
  input: UpdateBalanceAdjustmentInput,
): Promise<ActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = updateBalanceAdjustmentSchema(getTodayLocalDate()).safeParse(
    input,
  );

  if (!parsed.success) {
    return getValidationError(parsed.error.issues[0]?.message);
  }

  let updated: { count: number };

  try {
    updated = await db.balanceAdjustment.updateMany({
      where: {
        id: parsed.data.id,
        userId,
      },
      data: {
        amount: parsed.data.amount,
        effectiveMonth: parsed.data.effectiveMonth,
        note: parsed.data.note ?? null,
      },
    });
  } catch {
    return actionError(
      "Could not save balance adjustment. Please try again.",
    );
  }

  if (updated.count === 0) {
    return actionError("Balance adjustment not found.");
  }

  revalidateBalanceAdjustmentPaths();
  return actionSuccess();
}

export async function deleteBalanceAdjustment(
  input: DeleteBalanceAdjustmentInput,
): Promise<ActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = deleteBalanceAdjustmentSchema.safeParse(input);

  if (!parsed.success) {
    return getValidationError(parsed.error.issues[0]?.message);
  }

  let deleted: { count: number };

  try {
    deleted = await db.balanceAdjustment.deleteMany({
      where: {
        id: parsed.data.id,
        userId,
      },
    });
  } catch {
    return actionError(
      "Could not delete balance adjustment. Please try again.",
    );
  }

  if (deleted.count === 0) {
    return actionError("Balance adjustment not found.");
  }

  revalidateBalanceAdjustmentPaths();
  return actionSuccess();
}
