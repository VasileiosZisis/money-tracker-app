"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import {
  actionError,
  actionSuccess,
  actionSuccessWithData,
  type ActionResult,
  type ActionResultWithData,
} from "@/lib/actions/result";
import { getMonthRange } from "@/lib/dates/month";
import { getUserIdOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { transactionInputSchema, transactionTypeSchema } from "@/lib/validators/transaction";

const listTransactionsParamsSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  type: transactionTypeSchema.optional(),
  categoryId: z.string().trim().min(1).optional(),
});

const transactionIdSchema = z.string().trim().min(1, "Invalid transaction id.");

type TransactionWriteResult = ActionResultWithData<{ id: string }>;

export async function listTransactions(params: {
  month: string;
  type?: "INCOME" | "EXPENSE";
  categoryId?: string;
}) {
  const userId = await getUserIdOrThrow();
  const parsed = listTransactionsParamsSchema.parse(params);
  const { start, endExclusive } = getMonthRange(parsed.month);

  const transactions = await db.transaction.findMany({
    where: {
      userId,
      localDate: {
        gte: start,
        lt: endExclusive,
      },
      type: parsed.type,
      categoryId: parsed.categoryId,
    },
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
    orderBy: [{ localDate: "desc" }, { createdAt: "desc" }],
  });

  return transactions.map((transaction) => ({
    id: transaction.id,
    type: transaction.type,
    amount: transaction.amount.toString(),
    localDate: transaction.localDate,
    categoryId: transaction.categoryId,
    source: transaction.source,
    note: transaction.note,
    category: {
      id: transaction.category.id,
      name: transaction.category.name,
      type: transaction.category.type,
      isArchived: transaction.category.isArchived,
    },
  }));
}

export async function getTransactionFormMeta() {
  const userId = await getUserIdOrThrow();

  const [categories, user] = await Promise.all([
    db.category.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        type: true,
        isArchived: true,
      },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
    db.user.findUnique({
      where: { id: userId },
      select: { currency: true },
    }),
  ]);

  return {
    categories,
    currency: user?.currency ?? "USD",
  };
}

async function assertCategoryForTransaction(
  userId: string,
  categoryId: string,
  type: "INCOME" | "EXPENSE"
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
    return "Category not found.";
  }

  if (category.type !== type) {
    return "Category type does not match transaction type.";
  }

  return null;
}

function revalidateTransactionPaths() {
  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/export");
}

export async function createTransaction(input: {
  type: "INCOME" | "EXPENSE";
  amount: string | number;
  localDate: string;
  categoryId: string;
  source?: string;
  note?: string;
}): Promise<TransactionWriteResult> {
  const userId = await getUserIdOrThrow();
  const parsed = transactionInputSchema.safeParse(input);

  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid transaction input.");
  }

  const categoryError = await assertCategoryForTransaction(
    userId,
    parsed.data.categoryId,
    parsed.data.type,
  );

  if (categoryError) {
    return actionError(categoryError);
  }

  try {
    const created = await db.transaction.create({
      data: {
        userId,
        type: parsed.data.type,
        amount: parsed.data.amount as Prisma.Decimal,
        localDate: parsed.data.localDate,
        categoryId: parsed.data.categoryId,
        source: parsed.data.source ?? null,
        note: parsed.data.note ?? null,
      },
      select: { id: true },
    });

    revalidateTransactionPaths();
    return actionSuccessWithData(created);
  } catch {
    return actionError("Could not save transaction. Please try again.");
  }
}

export async function updateTransaction(
  id: string,
  input: {
    type: "INCOME" | "EXPENSE";
    amount: string | number;
    localDate: string;
    categoryId: string;
    source?: string;
    note?: string;
  },
): Promise<TransactionWriteResult> {
  const userId = await getUserIdOrThrow();
  const parsedId = transactionIdSchema.safeParse(id);
  const parsed = transactionInputSchema.safeParse(input);

  if (!parsedId.success) {
    return actionError(parsedId.error.issues[0]?.message ?? "Invalid transaction id.");
  }

  if (!parsed.success) {
    return actionError(parsed.error.issues[0]?.message ?? "Invalid transaction input.");
  }

  const existing = await db.transaction.findFirst({
    where: {
      id: parsedId.data,
      userId,
    },
    select: { id: true },
  });

  if (!existing) {
    return actionError("Transaction not found.");
  }

  const categoryError = await assertCategoryForTransaction(
    userId,
    parsed.data.categoryId,
    parsed.data.type,
  );

  if (categoryError) {
    return actionError(categoryError);
  }

  try {
    const updated = await db.transaction.update({
      where: { id: parsedId.data },
      data: {
        type: parsed.data.type,
        amount: parsed.data.amount as Prisma.Decimal,
        localDate: parsed.data.localDate,
        categoryId: parsed.data.categoryId,
        source: parsed.data.source ?? null,
        note: parsed.data.note ?? null,
      },
      select: { id: true },
    });

    revalidateTransactionPaths();
    return actionSuccessWithData(updated);
  } catch {
    return actionError("Could not save transaction. Please try again.");
  }
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const userId = await getUserIdOrThrow();
  const parsedId = transactionIdSchema.safeParse(id);

  if (!parsedId.success) {
    return actionError(parsedId.error.issues[0]?.message ?? "Invalid transaction id.");
  }

  try {
    const deleted = await db.transaction.deleteMany({
      where: {
        id: parsedId.data,
        userId,
      },
    });

    if (deleted.count === 0) {
      return actionError("Transaction not found.");
    }

    revalidateTransactionPaths();
    return actionSuccess();
  } catch {
    return actionError("Could not delete transaction. Please try again.");
  }
}
