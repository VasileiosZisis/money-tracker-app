"use server";

import { Prisma } from "@prisma/client";
import { z } from "zod";

import { getMonthRange } from "@/lib/dates/month";
import { getUserIdOrThrow } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { transactionInputSchema, transactionTypeSchema } from "@/lib/validators/transaction";

const listTransactionsParamsSchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  type: transactionTypeSchema.optional(),
  categoryId: z.string().trim().min(1).optional(),
});

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
    throw new Error("Category not found.");
  }

  if (category.type !== type) {
    throw new Error("Category type does not match transaction type.");
  }

  return category;
}

export async function createTransaction(input: {
  type: "INCOME" | "EXPENSE";
  amount: string | number;
  localDate: string;
  categoryId: string;
  source?: string;
  note?: string;
}) {
  const userId = await getUserIdOrThrow();
  const parsed = transactionInputSchema.parse(input);

  await assertCategoryForTransaction(userId, parsed.categoryId, parsed.type);

  const created = await db.transaction.create({
    data: {
      userId,
      type: parsed.type,
      amount: parsed.amount as Prisma.Decimal,
      localDate: parsed.localDate,
      categoryId: parsed.categoryId,
      source: parsed.source ?? null,
      note: parsed.note ?? null,
    },
    select: { id: true },
  });

  return created;
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
  }
) {
  const userId = await getUserIdOrThrow();
  const parsedId = z.string().trim().min(1).parse(id);
  const parsed = transactionInputSchema.parse(input);

  const existing = await db.transaction.findFirst({
    where: {
      id: parsedId,
      userId,
    },
    select: { id: true },
  });

  if (!existing) {
    throw new Error("Transaction not found.");
  }

  await assertCategoryForTransaction(userId, parsed.categoryId, parsed.type);

  const updated = await db.transaction.update({
    where: { id: parsedId },
    data: {
      type: parsed.type,
      amount: parsed.amount as Prisma.Decimal,
      localDate: parsed.localDate,
      categoryId: parsed.categoryId,
      source: parsed.source ?? null,
      note: parsed.note ?? null,
    },
    select: { id: true },
  });

  return updated;
}

export async function deleteTransaction(id: string) {
  const userId = await getUserIdOrThrow();
  const parsedId = z.string().trim().min(1).parse(id);

  const deleted = await db.transaction.deleteMany({
    where: {
      id: parsedId,
      userId,
    },
  });

  if (deleted.count === 0) {
    throw new Error("Transaction not found.");
  }

  return { deleted: true };
}
