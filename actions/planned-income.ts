"use server";

import {
  PlannedIncomeOccurrencePaymentSource,
  PlannedIncomeOccurrenceStatus,
  TransactionType,
} from "@/generated/prisma/enums";
import { revalidatePath } from "next/cache";

import {
  actionError,
  actionSuccess,
  type ActionResult,
} from "@/lib/actions/result";
import { getUserIdOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db";
import {
  linkExistingTransactionToPlannedIncomeSchema,
  markPlannedIncomeReceivedSchema,
  plannedIncomeIdSchema,
  plannedIncomeInputSchema,
  skipPlannedIncomeForMonthSchema,
  togglePlannedIncomeActiveSchema,
  undoPlannedIncomeOccurrenceSchema,
  updatePlannedIncomeSchema,
  type LinkExistingTransactionToPlannedIncomeInput,
  type MarkPlannedIncomeReceivedInput,
  type PlannedIncomeInput,
  type SkipPlannedIncomeForMonthInput,
  type TogglePlannedIncomeActiveInput,
  type UndoPlannedIncomeOccurrenceInput,
  type UpdatePlannedIncomeInput,
} from "@/lib/validators/planned-income";

type PlannedIncomeActionResult = ActionResult;

function getValidationError(message: string | undefined, fallback: string) {
  return actionError(message ?? fallback);
}

function getMutationError(fallback: string) {
  return actionError(fallback);
}

async function getValidatedPlannedIncomeCategoryAndSubcategory(
  userId: string,
  categoryId: string,
  subcategoryId: string | undefined,
) {
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

  if (category.type !== TransactionType.INCOME) {
    return {
      ok: false as const,
      error: "Planned income must use an income category.",
    };
  }

  if (!subcategoryId) {
    return { ok: true as const, subcategoryId: null as string | null };
  }

  const subcategory = await db.subcategory.findFirst({
    where: {
      id: subcategoryId,
      categoryId: category.id,
      category: {
        userId,
      },
    },
    select: { id: true },
  });

  if (!subcategory) {
    return {
      ok: false as const,
      error: "Subcategory does not belong to the selected category.",
    };
  }

  return { ok: true as const, subcategoryId: subcategory.id };
}

function revalidatePlannedIncomePaths() {
  revalidatePath("/planned-income");
  revalidatePath("/dashboard");
}

function revalidatePlannedIncomeOccurrencePaths() {
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/export");
  revalidatePath("/planned-income");
}

export async function listPlannedIncomes() {
  const userId = await getUserIdOrThrow();

  const plannedIncomes = await db.plannedIncome.findMany({
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
      subcategory: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: [
      { isActive: "desc" },
      { expectedDayOfMonth: "asc" },
      { name: "asc" },
    ],
  });

  return plannedIncomes.map((plannedIncome) => ({
    id: plannedIncome.id,
    userId: plannedIncome.userId,
    name: plannedIncome.name,
    amount: plannedIncome.amount.toString(),
    expectedDayOfMonth: plannedIncome.expectedDayOfMonth,
    categoryId: plannedIncome.categoryId,
    subcategoryId: plannedIncome.subcategoryId,
    isActive: plannedIncome.isActive,
    createdAt: plannedIncome.createdAt,
    updatedAt: plannedIncome.updatedAt,
    category: {
      id: plannedIncome.category.id,
      name: plannedIncome.category.name,
      type: plannedIncome.category.type,
      isArchived: plannedIncome.category.isArchived,
    },
    subcategory: plannedIncome.subcategory,
  }));
}

export async function createPlannedIncome(
  input: PlannedIncomeInput,
): Promise<PlannedIncomeActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = plannedIncomeInputSchema.safeParse(input);

  if (!parsed.success) {
    return getValidationError(
      parsed.error.issues[0]?.message,
      "Invalid planned income input.",
    );
  }

  const categoryResult = await getValidatedPlannedIncomeCategoryAndSubcategory(
    userId,
    parsed.data.categoryId,
    parsed.data.subcategoryId,
  );

  if (!categoryResult.ok) {
    return categoryResult;
  }

  try {
    await db.plannedIncome.create({
      data: {
        userId,
        name: parsed.data.name,
        amount: parsed.data.amount,
        expectedDayOfMonth: parsed.data.expectedDayOfMonth,
        categoryId: parsed.data.categoryId,
        subcategoryId: categoryResult.subcategoryId,
        isActive: parsed.data.isActive,
      },
    });
  } catch {
    return getMutationError("Could not save planned income. Please try again.");
  }

  revalidatePlannedIncomePaths();
  return actionSuccess();
}

export async function updatePlannedIncome(
  input: UpdatePlannedIncomeInput,
): Promise<PlannedIncomeActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = updatePlannedIncomeSchema.safeParse(input);

  if (!parsed.success) {
    return getValidationError(
      parsed.error.issues[0]?.message,
      "Invalid planned income input.",
    );
  }

  const existing = await db.plannedIncome.findFirst({
    where: {
      id: parsed.data.id,
      userId,
    },
    select: { id: true },
  });

  if (!existing) {
    return actionError("Planned income not found.");
  }

  const categoryResult = await getValidatedPlannedIncomeCategoryAndSubcategory(
    userId,
    parsed.data.categoryId,
    parsed.data.subcategoryId,
  );

  if (!categoryResult.ok) {
    return categoryResult;
  }

  try {
    await db.plannedIncome.update({
      where: { id: existing.id },
      data: {
        name: parsed.data.name,
        amount: parsed.data.amount,
        expectedDayOfMonth: parsed.data.expectedDayOfMonth,
        categoryId: parsed.data.categoryId,
        subcategoryId: categoryResult.subcategoryId,
        isActive: parsed.data.isActive,
      },
    });
  } catch {
    return getMutationError("Could not save planned income. Please try again.");
  }

  revalidatePlannedIncomePaths();
  return actionSuccess();
}

export async function togglePlannedIncomeActive(
  input: TogglePlannedIncomeActiveInput,
): Promise<PlannedIncomeActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = togglePlannedIncomeActiveSchema.safeParse(input);

  if (!parsed.success) {
    return getValidationError(
      parsed.error.issues[0]?.message,
      "Invalid planned income input.",
    );
  }

  let updated: { count: number };

  try {
    updated = await db.plannedIncome.updateMany({
      where: {
        id: parsed.data.id,
        userId,
      },
      data: {
        isActive: parsed.data.isActive,
      },
    });
  } catch {
    return getMutationError("Could not update planned income. Please try again.");
  }

  if (updated.count === 0) {
    return actionError("Planned income not found.");
  }

  revalidatePlannedIncomePaths();
  return actionSuccess();
}

export async function deletePlannedIncome(
  id: string,
): Promise<PlannedIncomeActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = plannedIncomeIdSchema.safeParse(id);

  if (!parsed.success) {
    return actionError("Invalid planned income id.");
  }

  let deleted: { count: number };

  try {
    deleted = await db.plannedIncome.deleteMany({
      where: {
        id: parsed.data,
        userId,
      },
    });
  } catch {
    return getMutationError("Could not delete planned income. Please try again.");
  }

  if (deleted.count === 0) {
    return actionError("Planned income not found.");
  }

  revalidatePlannedIncomePaths();
  return actionSuccess();
}

export async function markPlannedIncomeReceived(
  input: MarkPlannedIncomeReceivedInput,
): Promise<PlannedIncomeActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = markPlannedIncomeReceivedSchema.safeParse(input);

  if (!parsed.success) {
    return getValidationError(
      parsed.error.issues[0]?.message,
      "Invalid planned income received input.",
    );
  }

  const plannedIncome = await db.plannedIncome.findFirst({
    where: {
      id: parsed.data.plannedIncomeId,
      userId,
    },
    include: {
      category: {
        select: {
          id: true,
          userId: true,
          type: true,
        },
      },
      occurrences: {
        where: {
          month: parsed.data.month,
        },
        select: {
          id: true,
          status: true,
          transactionId: true,
          paymentSource: true,
        },
        take: 1,
      },
    },
  });

  if (!plannedIncome) {
    return actionError("Planned income not found.");
  }

  if (
    plannedIncome.category.userId !== userId ||
    plannedIncome.category.type !== TransactionType.INCOME
  ) {
    return actionError("Planned income must use an income category.");
  }

  const existingOccurrence = plannedIncome.occurrences[0];

  if (
    existingOccurrence?.status === PlannedIncomeOccurrenceStatus.RECEIVED &&
    existingOccurrence.transactionId
  ) {
    return actionError("This planned income is already marked received for the selected month.");
  }

  try {
    await db.$transaction(async (tx) => {
      const createdTransaction = await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.INCOME,
          amount: parsed.data.amount,
          localDate: parsed.data.localDate,
          categoryId: plannedIncome.categoryId,
          subcategoryId: plannedIncome.subcategoryId,
          source: plannedIncome.name,
          note: parsed.data.note ?? null,
        },
        select: { id: true },
      });

      if (existingOccurrence) {
        await tx.plannedIncomeOccurrence.update({
          where: { id: existingOccurrence.id },
          data: {
            status: PlannedIncomeOccurrenceStatus.RECEIVED,
            transactionId: createdTransaction.id,
            receivedAtLocalDate: parsed.data.localDate,
            paymentSource: PlannedIncomeOccurrencePaymentSource.GENERATED,
          },
        });
        return;
      }

      await tx.plannedIncomeOccurrence.create({
        data: {
          userId,
          plannedIncomeId: plannedIncome.id,
          month: parsed.data.month,
          status: PlannedIncomeOccurrenceStatus.RECEIVED,
          transactionId: createdTransaction.id,
          receivedAtLocalDate: parsed.data.localDate,
          paymentSource: PlannedIncomeOccurrencePaymentSource.GENERATED,
        },
      });
    });
  } catch {
    return getMutationError("Could not mark planned income as received. Please try again.");
  }

  revalidatePlannedIncomeOccurrencePaths();
  return actionSuccess();
}

export async function skipPlannedIncomeForMonth(
  input: SkipPlannedIncomeForMonthInput,
): Promise<PlannedIncomeActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = skipPlannedIncomeForMonthSchema.safeParse(input);

  if (!parsed.success) {
    return getValidationError(
      parsed.error.issues[0]?.message,
      "Invalid planned income skip input.",
    );
  }

  const plannedIncome = await db.plannedIncome.findFirst({
    where: {
      id: parsed.data.plannedIncomeId,
      userId,
    },
    select: {
      id: true,
      occurrences: {
        where: {
          month: parsed.data.month,
        },
        select: {
          id: true,
          status: true,
          transactionId: true,
          paymentSource: true,
        },
        take: 1,
      },
    },
  });

  if (!plannedIncome) {
    return actionError("Planned income not found.");
  }

  const existingOccurrence = plannedIncome.occurrences[0];

  if (
    existingOccurrence?.status === PlannedIncomeOccurrenceStatus.RECEIVED &&
    existingOccurrence.transactionId
  ) {
    return actionError("Undo the received occurrence before skipping this income.");
  }

  try {
    await db.plannedIncomeOccurrence.upsert({
      where: {
        plannedIncomeId_month: {
          plannedIncomeId: plannedIncome.id,
          month: parsed.data.month,
        },
      },
      create: {
        userId,
        plannedIncomeId: plannedIncome.id,
        month: parsed.data.month,
        status: PlannedIncomeOccurrenceStatus.SKIPPED,
        paymentSource: null,
      },
      update: {
        status: PlannedIncomeOccurrenceStatus.SKIPPED,
        transactionId: null,
        receivedAtLocalDate: null,
        paymentSource: null,
      },
    });
  } catch {
    return getMutationError("Could not skip planned income. Please try again.");
  }

  revalidatePlannedIncomeOccurrencePaths();
  return actionSuccess();
}

export async function undoPlannedIncomeOccurrence(
  input: UndoPlannedIncomeOccurrenceInput,
): Promise<PlannedIncomeActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = undoPlannedIncomeOccurrenceSchema.safeParse(input);

  if (!parsed.success) {
    return getValidationError(
      parsed.error.issues[0]?.message,
      "Invalid planned income undo input.",
    );
  }

  const occurrence = await db.plannedIncomeOccurrence.findFirst({
    where: {
      userId,
      plannedIncomeId: parsed.data.plannedIncomeId,
      month: parsed.data.month,
    },
    select: {
      id: true,
      transactionId: true,
      paymentSource: true,
    },
  });

  if (!occurrence) {
    return actionError("Planned income occurrence not found.");
  }

  try {
    await db.$transaction(async (tx) => {
      if (occurrence.transactionId) {
        if (occurrence.paymentSource === PlannedIncomeOccurrencePaymentSource.LINKED) {
          await tx.plannedIncomeOccurrence.deleteMany({
            where: {
              id: occurrence.id,
              userId,
            },
          });
          return;
        }

        await tx.transaction.deleteMany({
          where: {
            id: occurrence.transactionId,
            userId,
          },
        });
        return;
      }

      await tx.plannedIncomeOccurrence.deleteMany({
        where: {
          id: occurrence.id,
          userId,
        },
      });
    });
  } catch {
    return getMutationError("Could not undo planned income status. Please try again.");
  }

  revalidatePlannedIncomeOccurrencePaths();
  return actionSuccess();
}

export async function linkExistingTransactionToPlannedIncome(
  input: LinkExistingTransactionToPlannedIncomeInput,
): Promise<PlannedIncomeActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = linkExistingTransactionToPlannedIncomeSchema.safeParse(input);

  if (!parsed.success) {
    return getValidationError(
      parsed.error.issues[0]?.message,
      "Invalid planned income link input.",
    );
  }

  const plannedIncome = await db.plannedIncome.findFirst({
    where: {
      id: parsed.data.plannedIncomeId,
      userId,
    },
    select: {
      id: true,
      occurrences: {
        where: {
          month: parsed.data.month,
        },
        select: {
          id: true,
          status: true,
          transactionId: true,
          paymentSource: true,
        },
        take: 1,
      },
    },
  });

  if (!plannedIncome) {
    return actionError("Planned income not found.");
  }

  const transaction = await db.transaction.findFirst({
    where: {
      id: parsed.data.transactionId,
      userId,
    },
    select: {
      id: true,
      type: true,
      localDate: true,
      plannedIncomeOccurrence: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!transaction) {
    return actionError("Transaction not found.");
  }

  if (transaction.type !== TransactionType.INCOME) {
    return actionError("Only income transactions can be linked to planned income.");
  }

  if (!transaction.localDate.startsWith(`${parsed.data.month}-`)) {
    return actionError("Transaction must be inside the selected month.");
  }

  if (transaction.plannedIncomeOccurrence) {
    return actionError("This transaction is already linked to planned income.");
  }

  const existingOccurrence = plannedIncome.occurrences[0];

  if (
    existingOccurrence?.status === PlannedIncomeOccurrenceStatus.RECEIVED &&
    existingOccurrence.transactionId
  ) {
    return actionError("Undo the received occurrence before linking another transaction.");
  }

  try {
    await db.plannedIncomeOccurrence.upsert({
      where: {
        plannedIncomeId_month: {
          plannedIncomeId: plannedIncome.id,
          month: parsed.data.month,
        },
      },
      create: {
        userId,
        plannedIncomeId: plannedIncome.id,
        month: parsed.data.month,
        status: PlannedIncomeOccurrenceStatus.RECEIVED,
        transactionId: transaction.id,
        receivedAtLocalDate: transaction.localDate,
        paymentSource: PlannedIncomeOccurrencePaymentSource.LINKED,
      },
      update: {
        status: PlannedIncomeOccurrenceStatus.RECEIVED,
        transactionId: transaction.id,
        receivedAtLocalDate: transaction.localDate,
        paymentSource: PlannedIncomeOccurrencePaymentSource.LINKED,
      },
    });
  } catch {
    return getMutationError("Could not link transaction to planned income. Please try again.");
  }

  revalidatePlannedIncomeOccurrencePaths();
  return actionSuccess();
}
