"use server";

import {
  PlannedBillOccurrencePaymentSource,
  PlannedBillOccurrenceStatus,
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
  linkExistingTransactionToPlannedBillSchema,
  markPlannedBillPaidSchema,
  plannedBillIdSchema,
  plannedBillInputSchema,
  skipPlannedBillForMonthSchema,
  togglePlannedBillActiveSchema,
  undoPlannedBillOccurrenceSchema,
  updatePlannedBillSchema,
  type LinkExistingTransactionToPlannedBillInput,
  type MarkPlannedBillPaidInput,
  type PlannedBillInput,
  type SkipPlannedBillForMonthInput,
  type TogglePlannedBillActiveInput,
  type UndoPlannedBillOccurrenceInput,
  type UpdatePlannedBillInput,
} from "@/lib/validators/planned-bill";

type PlannedBillActionResult = ActionResult;

function getValidationError(message: string | undefined, fallback: string) {
  return actionError(message ?? fallback);
}

function getMutationError(fallback: string) {
  return actionError(fallback);
}

async function getValidatedPlannedBillCategoryAndSubcategory(
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

  if (category.type !== TransactionType.EXPENSE) {
    return {
      ok: false as const,
      error: "Planned bills must use an expense category.",
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

function revalidatePlannedBillPaths() {
  revalidatePath("/planned");
  revalidatePath("/dashboard");
}

function revalidatePlannedBillOccurrencePaths() {
  revalidatePath("/dashboard");
  revalidatePath("/transactions");
  revalidatePath("/export");
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
      subcategory: {
        select: {
          id: true,
          name: true,
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
    subcategoryId: plannedBill.subcategoryId,
    isActive: plannedBill.isActive,
    createdAt: plannedBill.createdAt,
    updatedAt: plannedBill.updatedAt,
    category: {
      id: plannedBill.category.id,
      name: plannedBill.category.name,
      type: plannedBill.category.type,
      isArchived: plannedBill.category.isArchived,
    },
    subcategory: plannedBill.subcategory,
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

  const categoryResult = await getValidatedPlannedBillCategoryAndSubcategory(
    userId,
    parsed.data.categoryId,
    parsed.data.subcategoryId,
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
        subcategoryId: categoryResult.subcategoryId,
        isActive: parsed.data.isActive,
      },
    });
  } catch {
    return getMutationError("Could not save planned bill. Please try again.");
  }

  revalidatePlannedBillPaths();
  return actionSuccess();
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
    return actionError("Planned bill not found.");
  }

  const categoryResult = await getValidatedPlannedBillCategoryAndSubcategory(
    userId,
    parsed.data.categoryId,
    parsed.data.subcategoryId,
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
        subcategoryId: categoryResult.subcategoryId,
        isActive: parsed.data.isActive,
      },
    });
  } catch {
    return getMutationError("Could not save planned bill. Please try again.");
  }

  revalidatePlannedBillPaths();
  return actionSuccess();
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
    return actionError("Planned bill not found.");
  }

  revalidatePlannedBillPaths();
  return actionSuccess();
}

export async function deletePlannedBill(id: string): Promise<PlannedBillActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = plannedBillIdSchema.safeParse(id);

  if (!parsed.success) {
    return actionError("Invalid planned bill id.");
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
    return actionError("Planned bill not found.");
  }

  revalidatePlannedBillPaths();
  return actionSuccess();
}

export async function markPlannedBillPaid(
  input: MarkPlannedBillPaidInput,
): Promise<PlannedBillActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = markPlannedBillPaidSchema.safeParse(input);

  if (!parsed.success) {
    return getValidationError(
      parsed.error.issues[0]?.message,
      "Invalid planned bill payment input.",
    );
  }

  const plannedBill = await db.plannedBill.findFirst({
    where: {
      id: parsed.data.plannedBillId,
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
      subcategory: {
        select: {
          id: true,
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

  if (!plannedBill) {
    return actionError("Planned bill not found.");
  }

  if (
    plannedBill.category.userId !== userId ||
    plannedBill.category.type !== TransactionType.EXPENSE
  ) {
    return actionError("Planned bills must use an expense category.");
  }

  const existingOccurrence = plannedBill.occurrences[0];

  if (
    existingOccurrence?.status === PlannedBillOccurrenceStatus.PAID &&
    existingOccurrence.transactionId
  ) {
    return actionError("This planned bill is already marked paid for the selected month.");
  }

  try {
    await db.$transaction(async (tx) => {
      const createdTransaction = await tx.transaction.create({
        data: {
          userId,
          type: TransactionType.EXPENSE,
          amount: parsed.data.amount,
          localDate: parsed.data.localDate,
          categoryId: plannedBill.categoryId,
          subcategoryId: plannedBill.subcategoryId,
          source: plannedBill.name,
          note: parsed.data.note ?? null,
        },
        select: { id: true },
      });

      if (existingOccurrence) {
        await tx.plannedBillOccurrence.update({
          where: { id: existingOccurrence.id },
          data: {
            status: PlannedBillOccurrenceStatus.PAID,
            transactionId: createdTransaction.id,
            paidAtLocalDate: parsed.data.localDate,
            paymentSource: PlannedBillOccurrencePaymentSource.GENERATED,
          },
        });
        return;
      }

      await tx.plannedBillOccurrence.create({
        data: {
          userId,
          plannedBillId: plannedBill.id,
          month: parsed.data.month,
          status: PlannedBillOccurrenceStatus.PAID,
          transactionId: createdTransaction.id,
          paidAtLocalDate: parsed.data.localDate,
          paymentSource: PlannedBillOccurrencePaymentSource.GENERATED,
        },
      });
    });
  } catch {
    return getMutationError("Could not mark planned bill as paid. Please try again.");
  }

  revalidatePlannedBillOccurrencePaths();
  return actionSuccess();
}

export async function skipPlannedBillForMonth(
  input: SkipPlannedBillForMonthInput,
): Promise<PlannedBillActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = skipPlannedBillForMonthSchema.safeParse(input);

  if (!parsed.success) {
    return getValidationError(
      parsed.error.issues[0]?.message,
      "Invalid planned bill skip input.",
    );
  }

  const plannedBill = await db.plannedBill.findFirst({
    where: {
      id: parsed.data.plannedBillId,
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

  if (!plannedBill) {
    return actionError("Planned bill not found.");
  }

  const existingOccurrence = plannedBill.occurrences[0];

  if (
    existingOccurrence?.status === PlannedBillOccurrenceStatus.PAID &&
    existingOccurrence.transactionId
  ) {
    return actionError("Undo the paid occurrence before skipping this bill.");
  }

  try {
    await db.plannedBillOccurrence.upsert({
      where: {
        plannedBillId_month: {
          plannedBillId: plannedBill.id,
          month: parsed.data.month,
        },
      },
      create: {
        userId,
        plannedBillId: plannedBill.id,
        month: parsed.data.month,
        status: PlannedBillOccurrenceStatus.SKIPPED,
        paymentSource: null,
      },
      update: {
        status: PlannedBillOccurrenceStatus.SKIPPED,
        transactionId: null,
        paidAtLocalDate: null,
        paymentSource: null,
      },
    });
  } catch {
    return getMutationError("Could not skip planned bill. Please try again.");
  }

  revalidatePlannedBillOccurrencePaths();
  return actionSuccess();
}

export async function undoPlannedBillOccurrence(
  input: UndoPlannedBillOccurrenceInput,
): Promise<PlannedBillActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = undoPlannedBillOccurrenceSchema.safeParse(input);

  if (!parsed.success) {
    return getValidationError(
      parsed.error.issues[0]?.message,
      "Invalid planned bill undo input.",
    );
  }

  const occurrence = await db.plannedBillOccurrence.findFirst({
    where: {
      userId,
      plannedBillId: parsed.data.plannedBillId,
      month: parsed.data.month,
    },
    select: {
      id: true,
      transactionId: true,
      paymentSource: true,
    },
  });

  if (!occurrence) {
    return actionError("Planned bill occurrence not found.");
  }

  try {
    await db.$transaction(async (tx) => {
      if (occurrence.transactionId) {
        if (occurrence.paymentSource === PlannedBillOccurrencePaymentSource.LINKED) {
          await tx.plannedBillOccurrence.deleteMany({
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

      await tx.plannedBillOccurrence.deleteMany({
        where: {
          id: occurrence.id,
          userId,
        },
      });
    });
  } catch {
    return getMutationError("Could not undo planned bill status. Please try again.");
  }

  revalidatePlannedBillOccurrencePaths();
  return actionSuccess();
}

export async function linkExistingTransactionToPlannedBill(
  input: LinkExistingTransactionToPlannedBillInput,
): Promise<PlannedBillActionResult> {
  const userId = await getUserIdOrThrow();
  const parsed = linkExistingTransactionToPlannedBillSchema.safeParse(input);

  if (!parsed.success) {
    return getValidationError(
      parsed.error.issues[0]?.message,
      "Invalid planned bill link input.",
    );
  }

  const plannedBill = await db.plannedBill.findFirst({
    where: {
      id: parsed.data.plannedBillId,
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

  if (!plannedBill) {
    return actionError("Planned bill not found.");
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
      plannedBillOccurrence: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!transaction) {
    return actionError("Transaction not found.");
  }

  if (transaction.type !== TransactionType.EXPENSE) {
    return actionError("Only expense transactions can be linked to planned bills.");
  }

  if (!transaction.localDate.startsWith(`${parsed.data.month}-`)) {
    return actionError("Transaction must be inside the selected month.");
  }

  if (transaction.plannedBillOccurrence) {
    return actionError("This transaction is already linked to a planned bill.");
  }

  const existingOccurrence = plannedBill.occurrences[0];

  if (
    existingOccurrence?.status === PlannedBillOccurrenceStatus.PAID &&
    existingOccurrence.transactionId
  ) {
    return actionError("Undo the paid occurrence before linking another transaction.");
  }

  try {
    await db.plannedBillOccurrence.upsert({
      where: {
        plannedBillId_month: {
          plannedBillId: plannedBill.id,
          month: parsed.data.month,
        },
      },
      create: {
        userId,
        plannedBillId: plannedBill.id,
        month: parsed.data.month,
        status: PlannedBillOccurrenceStatus.PAID,
        transactionId: transaction.id,
        paidAtLocalDate: transaction.localDate,
        paymentSource: PlannedBillOccurrencePaymentSource.LINKED,
      },
      update: {
        status: PlannedBillOccurrenceStatus.PAID,
        transactionId: transaction.id,
        paidAtLocalDate: transaction.localDate,
        paymentSource: PlannedBillOccurrencePaymentSource.LINKED,
      },
    });
  } catch {
    return getMutationError("Could not link transaction to planned bill. Please try again.");
  }

  revalidatePlannedBillOccurrencePaths();
  return actionSuccess();
}
