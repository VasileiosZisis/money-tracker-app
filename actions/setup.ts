"use server";

import { TransactionType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getUserIdOrThrow } from "@/lib/auth/session";
import { currencySchema } from "@/lib/validators/setup";

const defaultCategories: Array<{ name: string; type: TransactionType }> = [
  { name: "Salary", type: TransactionType.INCOME },
  { name: "Bonus", type: TransactionType.INCOME },
  { name: "Freelance", type: TransactionType.INCOME },
  { name: "Housing", type: TransactionType.EXPENSE },
  { name: "Groceries", type: TransactionType.EXPENSE },
  { name: "Transport", type: TransactionType.EXPENSE },
  { name: "Utilities", type: TransactionType.EXPENSE },
  { name: "Healthcare", type: TransactionType.EXPENSE },
  { name: "Entertainment", type: TransactionType.EXPENSE },
];

export async function setCurrency(currency: string) {
  const userId = await getUserIdOrThrow();
  const parsedCurrency = currencySchema.parse(currency);

  await db.user.update({
    where: { id: userId },
    data: { currency: parsedCurrency },
  });

  revalidatePath("/setup");
}

export async function createDefaultCategories() {
  const userId = await getUserIdOrThrow();

  await db.category.createMany({
    data: defaultCategories.map((category) => ({
      userId,
      name: category.name,
      type: category.type,
    })),
    skipDuplicates: true,
  });

  revalidatePath("/setup");
}

export async function completeSetup() {
  const userId = await getUserIdOrThrow();

  await db.user.update({
    where: { id: userId },
    data: { hasCompletedSetup: true },
  });

  revalidatePath("/dashboard");
}
