"use server";

import { TransactionType } from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";

import { getUserIdOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  plannedBillIdSchema,
  plannedBillInputSchema,
  togglePlannedBillActiveSchema,
  updatePlannedBillSchema,
  type PlannedBillInput,
  type TogglePlannedBillActiveInput,
  type UpdatePlannedBillInput,
} from "@/lib/validators/planned-bill";

type PlannedBillActionResult =
  | { ok: true }
  | { ok: false; error: string };

function getValidationError(message: string | undefined, fallback: string) {
  return { ok: false as const, error: message ?? fallback };
}

function getMutationError(fallback: string) {
  return { ok: false as const, error: fallback };
}

async function assertExpenseCategoryForPlannedBill(userId: string, categoryId: string) {
  const category = await db.category.findFirst({
    where: {
      id: categoryId,
      userId,
    },
    select: {
      id: true,
      type: true,
    },
  });

  if (!category) {
    return { ok: false as const, error: "Category not found." };
  }

  if (category.type !== TransactionType.EXPENSE) {
    return {
      ok: false as const,
      error: "Planned bills must use an expense category.",
    };
  }

  return { ok: true as const };
}

function revalidatePlannedBillPaths() {
  revalidatePath("/planned");
}

export async function listPlannedBills() {
  const userId = await getUserIdOrThrow();

  const plannedBills = await db.plannedBill.findMany({
    where: { userId },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          type: true,
          isArchived: true,
        },
      },
    },
    orderBy: [
      { isActive: "desc" },
      { dueDayOfMonth: "asc" },
      { name: "asc" },
    ],
  });

  return plannedBills.map((plannedBill) => ({
    id: plannedBill.id,
    userId: plannedBill.userId,
    name: plannedBill.name,
    amount: plannedBill.amount.toString(),
    dueDayOfMonth: plannedBill.dueDayOfMonth,
    categoryId: plannedBill.categoryId,
    isActive: plannedBill.isActive,
    createdAt: plannedBill.createdAt,
    updatedAt: plannedBill.updatedAt,
    category: {
      id: plannedBill.category.id,
      name: plannedBill.category.name,
      type: plannedBill.category.type,
      isArchived: plannedBill.category.isArchived,
    },
  }));
}

export async function createPlannedBill(
  input: PlannedBillInput,
): Promise<PlannedBillActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = plannedBillInputSchema.safeParse(input);

  if (!parsed.success) {
    return getValidationError(
      parsed.error.issues[0]?.message,
      "Invalid planned bill input.",
    );
  }

  const categoryResult = await assertExpenseCategoryForPlannedBill(
    userId,
    parsed.data.categoryId,
  );

  if (!categoryResult.ok) {
    return categoryResult;
  }

  try {
    await db.plannedBill.create({
      data: {
        userId,
        name: parsed.data.name,
        amount: parsed.data.amount,
        dueDayOfMonth: parsed.data.dueDayOfMonth,
        categoryId: parsed.data.categoryId,
        isActive: parsed.data.isActive,
      },
    });
  } catch {
    return getMutationError("Could not save planned bill. Please try again.");
  }

  revalidatePlannedBillPaths();
  return { ok: true };
}

export async function updatePlannedBill(
  input: UpdatePlannedBillInput,
): Promise<PlannedBillActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = updatePlannedBillSchema.safeParse(input);

  if (!parsed.success) {
    return getValidationError(
      parsed.error.issues[0]?.message,
      "Invalid planned bill input.",
    );
  }

  const existing = await db.plannedBill.findFirst({
    where: {
      id: parsed.data.id,
      userId,
    },
    select: { id: true },
  });

  if (!existing) {
    return { ok: false, error: "Planned bill not found." };
  }

  const categoryResult = await assertExpenseCategoryForPlannedBill(
    userId,
    parsed.data.categoryId,
  );

  if (!categoryResult.ok) {
    return categoryResult;
  }

  try {
    await db.plannedBill.update({
      where: { id: existing.id },
      data: {
        name: parsed.data.name,
        amount: parsed.data.amount,
        dueDayOfMonth: parsed.data.dueDayOfMonth,
        categoryId: parsed.data.categoryId,
        isActive: parsed.data.isActive,
      },
    });
  } catch {
    return getMutationError("Could not save planned bill. Please try again.");
  }

  revalidatePlannedBillPaths();
  return { ok: true };
}

export async function togglePlannedBillActive(
  input: TogglePlannedBillActiveInput,
): Promise<PlannedBillActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = togglePlannedBillActiveSchema.safeParse(input);

  if (!parsed.success) {
    return getValidationError(
      parsed.error.issues[0]?.message,
      "Invalid planned bill input.",
    );
  }

  let updated: { count: number };

  try {
    updated = await db.plannedBill.updateMany({
      where: {
        id: parsed.data.id,
        userId,
      },
      data: {
        isActive: parsed.data.isActive,
      },
    });
  } catch {
    return getMutationError("Could not update planned bill. Please try again.");
  }

  if (updated.count === 0) {
    return { ok: false, error: "Planned bill not found." };
  }

  revalidatePlannedBillPaths();
  return { ok: true };
}

export async function deletePlannedBill(id: string): Promise<PlannedBillActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = plannedBillIdSchema.safeParse(id);

  if (!parsed.success) {
    return { ok: false, error: "Invalid planned bill id." };
  }

  let deleted: { count: number };

  try {
    deleted = await db.plannedBill.deleteMany({
      where: {
        id: parsed.data,
        userId,
      },
    });
  } catch {
    return getMutationError("Could not delete planned bill. Please try again.");
  }

  if (deleted.count === 0) {
    return { ok: false, error: "Planned bill not found." };
  }

  revalidatePlannedBillPaths();
  return { ok: true };
}
